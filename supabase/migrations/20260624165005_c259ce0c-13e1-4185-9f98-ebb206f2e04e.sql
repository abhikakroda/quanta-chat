
-- 1. App-wide DCR records (one per Swiggy MCP server)
CREATE TABLE public.swiggy_oauth_clients (
  server text PRIMARY KEY CHECK (server IN ('food','im')),
  client_id text NOT NULL,
  client_secret text,
  redirect_uri text NOT NULL,
  registration_response jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.swiggy_oauth_clients TO service_role;
ALTER TABLE public.swiggy_oauth_clients ENABLE ROW LEVEL SECURITY;
-- No policies: only service role (which bypasses RLS) may access.

-- 2. Per-user OAuth flow state (PKCE verifier + state, short-lived)
CREATE TABLE public.swiggy_oauth_sessions (
  state text PRIMARY KEY,
  user_id uuid NOT NULL,
  server text NOT NULL CHECK (server IN ('food','im')),
  code_verifier text NOT NULL,
  redirect_uri text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.swiggy_oauth_sessions TO service_role;
ALTER TABLE public.swiggy_oauth_sessions ENABLE ROW LEVEL SECURITY;
-- No policies: service role only.

-- 3. Per-user access tokens
CREATE TABLE public.swiggy_tokens (
  user_id uuid NOT NULL,
  server text NOT NULL CHECK (server IN ('food','im')),
  access_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  scope text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, server)
);
GRANT ALL ON public.swiggy_tokens TO service_role;
ALTER TABLE public.swiggy_tokens ENABLE ROW LEVEL SECURITY;
-- No client-side access at all. A safe view below exposes non-secret columns.

-- Safe view: users may see their own connection status (no access_token)
CREATE OR REPLACE VIEW public.swiggy_token_status
WITH (security_invoker = true)
AS
SELECT user_id, server, expires_at, scope, updated_at
FROM public.swiggy_tokens;

GRANT SELECT ON public.swiggy_token_status TO authenticated;

-- A policy on the underlying table so the security_invoker view can read for the current user
CREATE POLICY "Users can read their own token status"
ON public.swiggy_tokens
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Note: this SELECT policy would also expose access_token if queried directly,
-- but we never grant SELECT on the table to authenticated. Only the view is granted.

-- updated_at triggers
CREATE TRIGGER trg_swiggy_oauth_clients_updated_at
BEFORE UPDATE ON public.swiggy_oauth_clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_swiggy_tokens_updated_at
BEFORE UPDATE ON public.swiggy_tokens
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
