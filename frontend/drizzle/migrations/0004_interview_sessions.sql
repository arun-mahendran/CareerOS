CREATE TABLE public.interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  interview_type text NOT NULL CHECK (interview_type IN ('technical','hr','role','company')),
  target_role text,
  company text,
  job_id text,
  difficulty text NOT NULL DEFAULT 'Intermediate',
  practice_mode text NOT NULL DEFAULT 'guided' CHECK (practice_mode IN ('guided','mock')),
  questions jsonb NOT NULL DEFAULT '[]',
  answers jsonb NOT NULL DEFAULT '{}',
  feedback jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  current_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interview_sessions_user_idx ON public.interview_sessions(user_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interview_sessions TO authenticated;
GRANT ALL ON public.interview_sessions TO service_role;
ALTER TABLE public.interview_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own sessions" ON public.interview_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);