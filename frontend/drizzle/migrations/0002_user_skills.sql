CREATE TABLE public.user_skills (
  user_id uuid NOT NULL,
  skill text NOT NULL CHECK (char_length(skill) BETWEEN 1 AND 80),
  level smallint NOT NULL CHECK (level BETWEEN 0 AND 4),
  source text NOT NULL DEFAULT 'self' CHECK (source IN ('self','assessment','project')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_skills TO authenticated;
GRANT ALL ON public.user_skills TO service_role;
ALTER TABLE public.user_skills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own skills all" ON public.user_skills FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);