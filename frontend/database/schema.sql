-- CareerOS complete database setup.
-- Run this ONCE in the SQL editor of your own database project
-- (only needed if you point the app at a new/empty database).
-- Safe to re-run: uses IF NOT EXISTS everywhere.

-- PROFILES -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  target_role text DEFAULT 'Frontend Engineer',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own profile select" ON public.profiles;
DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- APPLICATIONS (saved jobs) -------------------------------------------
CREATE TABLE IF NOT EXISTS public.saved_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  job_id text NOT NULL,
  status text NOT NULL DEFAULT 'saved',
  company text, title text, location text, job_type text,
  job_url text, career_url text, salary text, notes text,
  applied_on date, follow_up_on date,
  follow_up_done boolean NOT NULL DEFAULT false,
  follow_up_note text,
  interview_at timestamptz,
  resume_id uuid,
  history jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, job_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_jobs TO authenticated;
GRANT ALL ON public.saved_jobs TO service_role;
ALTER TABLE public.saved_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own saved all" ON public.saved_jobs;
CREATE POLICY "own saved all" ON public.saved_jobs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- RESUMES ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  title text NOT NULL DEFAULT 'Untitled resume',
  target_role text,
  template text NOT NULL DEFAULT 'ats',
  target_job_id text,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.resumes TO authenticated;
GRANT ALL ON public.resumes TO service_role;
ALTER TABLE public.resumes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own resumes select" ON public.resumes;
DROP POLICY IF EXISTS "Own resumes insert" ON public.resumes;
DROP POLICY IF EXISTS "Own resumes update" ON public.resumes;
DROP POLICY IF EXISTS "Own resumes delete" ON public.resumes;
CREATE POLICY "Own resumes select" ON public.resumes FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Own resumes insert" ON public.resumes FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own resumes update" ON public.resumes FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Own resumes delete" ON public.resumes FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ROADMAP ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.roadmap_progress (
  user_id uuid NOT NULL,
  step_id text NOT NULL,
  status text NOT NULL DEFAULT 'completed' CHECK (status IN ('in_progress','completed','skipped')),
  completed_at timestamptz,
  minutes_logged integer NOT NULL DEFAULT 0 CHECK (minutes_logged >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, step_id)
);
CREATE TABLE IF NOT EXISTS public.roadmap_preferences (
  user_id uuid PRIMARY KEY,
  weekly_hours integer NOT NULL DEFAULT 6 CHECK (weekly_hours BETWEEN 1 AND 60),
  pace text NOT NULL DEFAULT 'steady' CHECK (pace IN ('relaxed','steady','intensive')),
  skill_level text NOT NULL DEFAULT 'beginner' CHECK (skill_level IN ('beginner','intermediate','advanced')),
  target_date date,
  priority_skills text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.roadmap_study_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  step_id text NOT NULL,
  minutes integer NOT NULL CHECK (minutes BETWEEN 1 AND 1440),
  logged_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- SKILL GAPS ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_skills (
  user_id uuid NOT NULL,
  skill text NOT NULL CHECK (char_length(skill) BETWEEN 1 AND 80),
  level smallint NOT NULL CHECK (level BETWEEN 0 AND 4),
  source text NOT NULL DEFAULT 'self' CHECK (source IN ('self','assessment','project')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, skill)
);

-- LEARNING HUB ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.learning_resource_progress (
  user_id uuid NOT NULL,
  resource_url text NOT NULL CHECK (char_length(resource_url) BETWEEN 8 AND 500),
  saved boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started','in_progress','completed')),
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, resource_url)
);

-- INTERVIEW PREP --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.interview_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  interview_type text NOT NULL CHECK (interview_type IN ('technical','hr','role','company')),
  target_role text, company text, job_id text,
  difficulty text NOT NULL DEFAULT 'Intermediate',
  practice_mode text NOT NULL DEFAULT 'guided' CHECK (practice_mode IN ('guided','mock')),
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  feedback jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','completed')),
  current_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Owner-only access for the per-user tables above
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['roadmap_progress','roadmap_preferences','roadmap_study_logs',
                           'user_skills','learning_resource_progress','interview_sessions'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "owner only" ON public.%I', t);
    EXECUTE format('CREATE POLICY "owner only" ON public.%I FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', t);
  END LOOP;
END $$;
