// Swiggy MCP OAuth proxy + JSON-RPC tool dispatcher.
//
// Actions (all over HTTP, dispatched by the `action` query param OR JSON body field):
//   GET  ?action=callback      — OAuth redirect target, public, no JWT
//   POST { action: "status" }  — { connections: [{server, expires_at, scope}] }
//   POST { action: "start", server } — returns { authorize_url }
//   POST { action: "call", server, tool, args } — JSON-RPC tools/call → { result } or { needs_reauth }
//   POST { action: "logout", server }
//
// Auth model: SUPABASE_ANON for getUser(), service role for token storage.
// The callback endpoint is public because the browser is redirected to it by Swiggy
// with no app session header. We rely on the cryptographic `state` to look up the
// user_id that started the flow.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SWIGGY_BASE = "https://mcp.swiggy.com";
const SCOPES = "mcp:tools mcp:resources";

function admin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

async function getUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: auth } } },
  );
  const token = auth.replace("Bearer ", "");
  const { data, error } = await sb.auth.getClaims(token);
  if (error || !data?.claims) return null;
  return (data.claims as { sub?: string }).sub ?? null;
}

function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
async function sha256(s: string): Promise<string> {
  return b64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}
function randomB64Url(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function functionOrigin(req: Request): string {
  // e.g. https://<ref>.functions.supabase.co or the local dev URL
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
function callbackUri(req: Request): string {
  const override = Deno.env.get("SWIGGY_REDIRECT_URI");
  if (override) return override;
  return `${functionOrigin(req)}/swiggy-mcp?action=callback`;
}

async function ensureDcrClient(req: Request, server: "food" | "im"): Promise<{ client_id: string; redirect_uri: string }> {
  const sb = admin();
  const { data: existing } = await sb.from("swiggy_oauth_clients").select("*").eq("server", server).maybeSingle();
  const desiredRedirect = callbackUri(req);
  if (existing && existing.redirect_uri === desiredRedirect) {
    return { client_id: existing.client_id, redirect_uri: existing.redirect_uri };
  }

  // Register (or re-register because redirect changed)
  const regResp = await fetch(`${SWIGGY_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_name: "Lovable Swiggy Agent",
      redirect_uris: [desiredRedirect],
      grant_types: ["authorization_code"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPES,
    }),
  });
  if (!regResp.ok) {
    const txt = await regResp.text();
    throw new Error(`DCR failed (${regResp.status}): ${txt.slice(0, 300)}`);
  }
  const reg = await regResp.json();
  await sb.from("swiggy_oauth_clients").upsert({
    server,
    client_id: reg.client_id,
    client_secret: reg.client_secret ?? null,
    redirect_uri: desiredRedirect,
    registration_response: reg,
  });
  return { client_id: reg.client_id, redirect_uri: desiredRedirect };
}

async function handleStart(req: Request, userId: string, server: "food" | "im") {
  const { client_id, redirect_uri } = await ensureDcrClient(req, server);
  const verifier = randomB64Url(32);
  const challenge = await sha256(verifier);
  const state = randomB64Url(24);
  await admin().from("swiggy_oauth_sessions").insert({
    state, user_id: userId, server, code_verifier: verifier, redirect_uri,
  });
  const params = new URLSearchParams({
    response_type: "code",
    client_id,
    redirect_uri,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    scope: SCOPES,
  });
  return { authorize_url: `${SWIGGY_BASE}/auth/authorize?${params}` };
}

async function handleCallback(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const sb = admin();

  const html = (ok: boolean, msg: string) => new Response(
    `<!doctype html><meta charset=utf-8><title>Swiggy connection</title>
<style>body{font-family:system-ui;padding:32px;text-align:center;background:#0f172a;color:#e2e8f0}
.card{max-width:420px;margin:auto;background:#1e293b;border-radius:16px;padding:32px;border:1px solid #334155}
h1{margin:0 0 8px;font-size:18px}p{color:#94a3b8;font-size:14px;margin:8px 0 0}
.ok{color:#22c55e}.err{color:#ef4444}</style>
<div class=card><h1 class="${ok ? "ok" : "err"}">${ok ? "✓ Connected" : "✗ Failed"}</h1>
<p>${msg}</p><p>You can close this window.</p></div>
<script>try{window.opener&&window.opener.postMessage({type:"swiggy-oauth",ok:${ok}},"*")}catch(e){}setTimeout(()=>window.close(),1200)</script>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" } },
  );

  if (err) return html(false, err);
  if (!code || !state) return html(false, "Missing code or state");

  const { data: session, error: sessErr } = await sb
    .from("swiggy_oauth_sessions").select("*").eq("state", state).maybeSingle();
  if (sessErr || !session) return html(false, "Unknown or expired state");

  const { data: client } = await sb
    .from("swiggy_oauth_clients").select("*").eq("server", session.server).maybeSingle();
  if (!client) return html(false, "Client registration missing");

  const tokenResp = await fetch(`${SWIGGY_BASE}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      code_verifier: session.code_verifier,
      redirect_uri: session.redirect_uri,
      client_id: client.client_id,
    }),
  });
  if (!tokenResp.ok) {
    const t = await tokenResp.text();
    return html(false, `Token exchange failed (${tokenResp.status}): ${t.slice(0, 200)}`);
  }
  const tok = await tokenResp.json();
  const expiresAt = new Date(Date.now() + (Number(tok.expires_in ?? 432000) * 1000)).toISOString();
  await sb.from("swiggy_tokens").upsert({
    user_id: session.user_id,
    server: session.server,
    access_token: tok.access_token,
    expires_at: expiresAt,
    scope: tok.scope ?? SCOPES,
  });
  await sb.from("swiggy_oauth_sessions").delete().eq("state", state);
  return html(true, `Connected to Swiggy ${session.server === "food" ? "Food" : "Instamart"}.`);
}

async function handleStatus(userId: string) {
  const { data } = await admin()
    .from("swiggy_tokens")
    .select("server, expires_at, scope")
    .eq("user_id", userId);
  return { connections: data ?? [] };
}

async function handleLogout(userId: string, server: "food" | "im") {
  const sb = admin();
  const { data: tok } = await sb.from("swiggy_tokens")
    .select("access_token").eq("user_id", userId).eq("server", server).maybeSingle();
  if (tok?.access_token) {
    try {
      await fetch(`${SWIGGY_BASE}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok.access_token}` },
      });
    } catch { /* ignore */ }
  }
  await sb.from("swiggy_tokens").delete().eq("user_id", userId).eq("server", server);
  return { ok: true };
}

async function handleCall(userId: string, server: "food" | "im", tool: string, args: Record<string, unknown>) {
  const sb = admin();
  const { data: tok } = await sb.from("swiggy_tokens")
    .select("access_token, expires_at")
    .eq("user_id", userId).eq("server", server).maybeSingle();
  if (!tok) return { needs_reauth: true, server, reason: "not_connected" };
  if (new Date(tok.expires_at).getTime() < Date.now()) {
    await sb.from("swiggy_tokens").delete().eq("user_id", userId).eq("server", server);
    return { needs_reauth: true, server, reason: "expired" };
  }

  const rpcResp = await fetch(`${SWIGGY_BASE}/${server}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // MCP Streamable HTTP spec — servers reject without this with 406
      "Accept": "application/json, text/event-stream",
      "Authorization": `Bearer ${tok.access_token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name: tool, arguments: args },
    }),
  });

  if (rpcResp.status === 401 || rpcResp.status === 419) {
    await sb.from("swiggy_tokens").delete().eq("user_id", userId).eq("server", server);
    return { needs_reauth: true, server, reason: rpcResp.status === 419 ? "session_revoked" : "unauthorized" };
  }

  // Response may be JSON or text/event-stream; handle both.
  const ct = rpcResp.headers.get("content-type") ?? "";
  let payload: unknown;
  if (ct.includes("text/event-stream")) {
    const text = await rpcResp.text();
    // Parse last "data: ..." line of the SSE stream
    const lines = text.split("\n").filter((l) => l.startsWith("data: "));
    const last = lines[lines.length - 1]?.slice(6).trim();
    payload = last ? JSON.parse(last) : {};
  } else {
    payload = await rpcResp.json().catch(() => ({}));
  }

  if (!rpcResp.ok) {
    return { error: `Swiggy returned ${rpcResp.status}`, detail: payload };
  }
  const env = payload as { result?: unknown; error?: unknown };
  if (env.error) return { error: env.error };
  return { result: env.result };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action") ?? "";

    // Public OAuth callback — Swiggy redirects the user's browser here
    if (req.method === "GET" && action === "callback") {
      return await handleCallback(req);
    }

    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const userId = await getUserId(req);
    if (!userId) {
      return new Response(JSON.stringify({ error: "Sign in required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const act = (body.action ?? action) as string;
    const server = body.server as "food" | "im" | undefined;

    let out: unknown;
    switch (act) {
      case "status":
        out = await handleStatus(userId);
        break;
      case "start":
        if (server !== "food" && server !== "im") throw new Error("server must be food|im");
        out = await handleStart(req, userId, server);
        break;
      case "logout":
        if (server !== "food" && server !== "im") throw new Error("server must be food|im");
        out = await handleLogout(userId, server);
        break;
      case "call": {
        if (server !== "food" && server !== "im") throw new Error("server must be food|im");
        const tool = String(body.tool ?? "");
        if (!tool) throw new Error("tool required");
        out = await handleCall(userId, server, tool, (body.args as Record<string, unknown>) ?? {});
        break;
      }
      case "callback_uri":
        out = { redirect_uri: callbackUri(req) };
        break;
      default:
        throw new Error(`Unknown action: ${act}`);
    }

    return new Response(JSON.stringify(out), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});