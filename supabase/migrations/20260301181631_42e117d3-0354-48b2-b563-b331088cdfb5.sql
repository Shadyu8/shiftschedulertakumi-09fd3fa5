
-- Add configurable availability time range to location_settings
ALTER TABLE public.location_settings
  ADD COLUMN IF NOT EXISTS availability_earliest_time text NOT NULL DEFAULT '12:00',
  ADD COLUMN IF NOT EXISTS availability_latest_time text NOT NULL DEFAULT '19:00';

-- Create availability templates table (one template per user)
CREATE TABLE public.availability_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT 'My Template',
  entries jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.availability_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own templates"
  ON public.availability_templates
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
