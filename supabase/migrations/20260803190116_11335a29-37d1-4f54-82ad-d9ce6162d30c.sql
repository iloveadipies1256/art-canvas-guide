CREATE TABLE public.skill_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  artwork_id uuid,
  subject text NOT NULL DEFAULT '',
  line_control real,
  proportion real,
  shading real,
  perspective real,
  overall real NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.skill_snapshots TO authenticated;
GRANT ALL ON public.skill_snapshots TO service_role;

ALTER TABLE public.skill_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY skill_snapshots_own_all ON public.skill_snapshots
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX skill_snapshots_user_created_idx ON public.skill_snapshots (user_id, created_at DESC);

CREATE TABLE public.daily_drills (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  drill_date date NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  subject text NOT NULL,
  focus_skill text NOT NULL DEFAULT 'lineControl',
  payload jsonb,
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, drill_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_drills TO authenticated;
GRANT ALL ON public.daily_drills TO service_role;

ALTER TABLE public.daily_drills ENABLE ROW LEVEL SECURITY;

CREATE POLICY daily_drills_own_all ON public.daily_drills
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER daily_drills_set_updated
  BEFORE UPDATE ON public.daily_drills
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();