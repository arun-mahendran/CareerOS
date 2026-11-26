ALTER TABLE public.roadmap_progress
  ADD COLUMN status text NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress','completed','skipped')),
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN minutes_logged integer NOT NULL DEFAULT 0 CHECK (minutes_logged >= 0),
  ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();
UPDATE public.roadmap_progress SET completed_at = created_at WHERE status = 'completed' AND completed_at IS NULL;
GRANT UPDATE ON public.roadmap_progress TO authenticated;

CREATE TABLE public.roadmap_preferences (
  user_id uuid PRIMARY KEY,
  weekly_hours integer NOT NULL DEFAULT 6 CHECK (weekly_hours BETWEEN 1 AND 60),
  pace text NOT NULL DEFAULT 'steady' CHECK (pace IN ('relaxed','steady','intensive')),
  skill_level text NOT NULL DEFAULT 'beginner' CHECK (skill_level IN ('beginner','intermediate','advanced')),
  target_date date,
  priority_skills text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.roadmap_preferences TO authenticated;
GRANT ALL ON public.roadmap_preferences TO service_role;
ALTER TABLE public.roadmap_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own prefs all" ON public.roadmap_preferences FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);