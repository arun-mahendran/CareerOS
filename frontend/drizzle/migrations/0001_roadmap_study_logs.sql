CREATE TABLE public.roadmap_study_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  step_id text NOT NULL,
  minutes integer NOT NULL CHECK (minutes BETWEEN 1 AND 1440),
  logged_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX roadmap_study_logs_user_idx ON public.roadmap_study_logs(user_id, logged_on);
GRANT SELECT, INSERT, DELETE ON public.roadmap_study_logs TO authenticated;
GRANT ALL ON public.roadmap_study_logs TO service_role;
ALTER TABLE public.roadmap_study_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own logs all" ON public.roadmap_study_logs FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
COMMENT ON COLUMN public.roadmap_progress.minutes_logged IS 'DEPRECATED: study time lives in roadmap_study_logs';