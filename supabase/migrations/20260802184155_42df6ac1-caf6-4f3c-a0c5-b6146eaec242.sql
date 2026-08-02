CREATE TABLE public.practice_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('lesson','critique','module')),
  subject text NOT NULL DEFAULT '',
  skills text[] NOT NULL DEFAULT '{}',
  source_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.practice_events TO authenticated;
GRANT ALL ON public.practice_events TO service_role;

ALTER TABLE public.practice_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY practice_events_own_all ON public.practice_events
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX practice_events_user_created_idx ON public.practice_events (user_id, created_at DESC);