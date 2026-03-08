
CREATE TABLE public.typing_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  chapter_id text NOT NULL,
  wpm integer NOT NULL DEFAULT 0,
  accuracy integer NOT NULL DEFAULT 0,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.typing_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own typing progress" ON public.typing_progress
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own typing progress" ON public.typing_progress
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own typing progress" ON public.typing_progress
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
