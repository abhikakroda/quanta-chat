
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS starred boolean NOT NULL DEFAULT false;

ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS feedback text DEFAULT NULL;
