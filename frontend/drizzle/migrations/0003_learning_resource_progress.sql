CREATE TABLE public.learning_resource_progress (
  user_id uuid NOT NULL,
  resource_url text NOT NULL CHECK (char_length(resource_url) BETWEEN 8 AND 500),
  saved boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_url)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.learning_resource_progress TO authenticated;
GRANT ALL ON public.learning_resource_progress TO service_role;
ALTER TABLE public.learning_resource_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own resource progress" ON public.learning_resource_progress FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);