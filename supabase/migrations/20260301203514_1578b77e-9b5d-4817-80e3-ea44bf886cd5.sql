
-- Battle rooms
CREATE TABLE public.battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL,
  opponent_id uuid,
  status text NOT NULL DEFAULT 'waiting',
  category text NOT NULL DEFAULT 'general',
  question text NOT NULL,
  difficulty text NOT NULL DEFAULT 'medium',
  winner_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  join_code text NOT NULL DEFAULT substr(md5(random()::text), 1, 6)
);

ALTER TABLE public.battles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view battles" ON public.battles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can create battles" ON public.battles FOR INSERT TO authenticated WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Participants can update battles" ON public.battles FOR UPDATE TO authenticated USING (auth.uid() = creator_id OR auth.uid() = opponent_id);

-- Battle submissions
CREATE TABLE public.battle_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES public.battles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  answer text NOT NULL,
  score integer DEFAULT 0,
  feedback text,
  submitted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.battle_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view submissions" ON public.battle_submissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own submissions" ON public.battle_submissions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "System can update submissions" ON public.battle_submissions FOR UPDATE TO authenticated USING (true);

-- Leaderboard table
CREATE TABLE public.battle_leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  draws integer NOT NULL DEFAULT 0,
  total_score integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.battle_leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view leaderboard" ON public.battle_leaderboard FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own leaderboard" ON public.battle_leaderboard FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own leaderboard" ON public.battle_leaderboard FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Enable realtime for battles and submissions
ALTER PUBLICATION supabase_realtime ADD TABLE public.battles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.battle_submissions;
