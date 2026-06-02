-- Tighten battle_submissions SELECT to participants only
DROP POLICY IF EXISTS "Participants can view submissions" ON public.battle_submissions;
CREATE POLICY "Participants can view submissions"
ON public.battle_submissions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  OR EXISTS (
    SELECT 1 FROM public.battles b
    WHERE b.id = battle_submissions.battle_id
      AND (auth.uid() = b.creator_id OR auth.uid() = b.opponent_id)
  )
);

-- Remove permissive UPDATE policy (scoring should be server-side via service_role)
DROP POLICY IF EXISTS "System can update submissions" ON public.battle_submissions;

-- Allow users to delete their own user_skills row
CREATE POLICY "Users can delete own skills"
ON public.user_skills
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);