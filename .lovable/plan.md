
## Goal

Replace the in-memory mock in `src/lib/swiggyMcp.ts` with real calls to `https://mcp.swiggy.com/food` and `/im`, brokered by a Lovable Cloud edge function that owns OAuth 2.1 + PKCE + Dynamic Client Registration and the JSON-RPC tool-call transport. Tokens never reach the browser.

## Architecture

```text
Browser (SwiggyAgent.tsx)
  │  fetch supabase.functions.invoke('swiggy-mcp', { action })
  ▼
Edge function `swiggy-mcp`  ──►  DB: oauth_clients / oauth_sessions / tokens
  │
  ├─ start    → DCR (once per server) + PKCE + state → returns authorize URL
  ├─ callback → exchange code → store access_token + expires_at
  ├─ status   → which servers this user has live tokens for
  ├─ call     → JSON-RPC `tools/call` to mcp.swiggy.com/{server} with Bearer
  └─ logout   → POST /auth/logout + delete row
```

The existing `supabase/functions/swiggy-chat` (Gemini tool-loop) keeps working — it returns `tool_calls` to the browser; the browser now routes each one through `swiggy-mcp?action=call` instead of the mock dispatcher.

## Database (one migration)

- `swiggy_oauth_clients(server text pk, client_id text, client_secret text, registered_at)` — app-wide DCR record, one row per `food`/`im`. Service-role only (no anon/auth grants).
- `swiggy_oauth_sessions(state text pk, user_id uuid, server text, code_verifier text, redirect_uri text, created_at)` — short-lived PKCE state.
- `swiggy_tokens(user_id uuid, server text, access_token text, expires_at timestamptz, scope text, primary key(user_id, server))` — per-user-per-server token. RLS: users may `select` their own row (to read `expires_at`/`scope` — never the token), edge function uses service role for writes/reads of `access_token`.

## Edge function `supabase/functions/swiggy-mcp/index.ts`

- Requires JWT (uses `Authorization` header to identify the user via `supabase.auth.getUser`).
- `SWIGGY_REDIRECT_URI` secret: the exact-match HTTPS URI Swiggy has on file (defaults to the function's own callback URL). User must email `builders@swiggy.in` to register it before OAuth works — surface this clearly in the UI.
- `action=start`: ensures DCR row exists (POST `/auth/register` with `redirect_uris`, `token_endpoint_auth_method: none`), mints PKCE S256, persists `state`, returns the `/auth/authorize` URL with `scope=mcp:tools mcp:resources`.
- `action=callback`: GET handler that reads `code`+`state`, looks up session, POSTs `/auth/token`, stores token, returns a tiny HTML page that posts a `message` to the opener and closes.
- `action=call`: body `{ server, tool, args }` → POST `https://mcp.swiggy.com/{server}` with JSON-RPC `tools/call`. On 401, delete the token row and return `{ needs_reauth: true }`. Headers include `Accept: application/json, text/event-stream` per MCP spec.
- `action=status` / `action=logout` as described.

## Client changes

- `src/lib/swiggyMcp.ts` — keep the exported type signatures and `callTool(name, args)` shape, but route every call to `swiggy-mcp?action=call` and translate the JSON-RPC `{ success, data }` envelope into today's flatter shape so `SwiggyAgent.tsx` and the cart drawer don't change. Drop the mock state. Map tool names that differ in scope to the right server (`/food` vs `/im`).
- `src/pages/SwiggyAgent.tsx` — add a small "Connect Swiggy" panel (per server) showing connected/disconnected, a Connect button that opens the authorize URL in a popup, and a Disconnect button. Listen for the `postMessage` from the callback page to refresh status. Show a one-time banner when `SWIGGY_REDIRECT_URI` is unregistered (detected via a 400 from `/auth/authorize`).
- On `needs_reauth` from any tool call, surface a toast with a Reconnect button.

## What you'll need to do once (outside the build)

1. Apply at `mcp.swiggy.com/builders/access/` (staging is auto-approved with a demo video).
2. Email `builders@swiggy.in` with the callback URL the function prints on first load so Swiggy adds it to the exact-match allowlist.
3. Paste any custom value into `SWIGGY_REDIRECT_URI` if it differs from the default.

## Out of scope

- Refresh tokens (Swiggy v1 doesn't issue them — users re-auth every 5 days).
- Dineout server.
- Replacing the agent loop in `supabase/functions/swiggy-chat` — it stays on Gemini and continues to emit `tool_calls`.
