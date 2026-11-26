CREATE TABLE public.calendar_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  type text NOT NULL DEFAULT 'OTHER',
  title text NOT NULL,
  notes text,
  location text,
  all_day boolean NOT NULL DEFAULT false,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz,
  application_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.calendar_events TO authenticated;
GRANT ALL ON public.calendar_events TO service_role;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own calendar events" ON public.calendar_events FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX calendar_events_user_start ON public.calendar_events (user_id, starts_at);
CREATE OR REPLACE FUNCTION public.validate_calendar_event() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF length(btrim(NEW.title)) = 0 THEN RAISE EXCEPTION 'Title is required'; END IF;
  IF NEW.ends_at IS NOT NULL AND NEW.ends_at < NEW.starts_at THEN RAISE EXCEPTION 'End must not precede start'; END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER calendar_events_validate BEFORE INSERT OR UPDATE ON public.calendar_events
  FOR EACH ROW EXECUTE FUNCTION public.validate_calendar_event();