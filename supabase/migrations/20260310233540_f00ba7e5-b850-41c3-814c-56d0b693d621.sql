
-- Add 'fulltimer' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'fulltimer';

-- Add staff_type to profiles (floor or kitchen)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS staff_type text NOT NULL DEFAULT 'floor';

-- Create fulltimer_schedules table for recurring weekly schedules
CREATE TABLE IF NOT EXISTS public.fulltimer_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time text NOT NULL DEFAULT '09:00',
  end_time text NOT NULL DEFAULT '17:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, location_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.fulltimer_schedules ENABLE ROW LEVEL SECURITY;

-- Managers can manage fulltimer schedules
CREATE POLICY "Managers manage fulltimer schedules"
ON public.fulltimer_schedules
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Fulltimers can view their own schedules
CREATE POLICY "Users view own fulltimer schedules"
ON public.fulltimer_schedules
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Workers/shiftleaders can view fulltimer schedules in their locations
CREATE POLICY "Users view location fulltimer schedules"
ON public.fulltimer_schedules
FOR SELECT
TO authenticated
USING (location_id IN (
  SELECT ul.location_id FROM user_locations ul WHERE ul.user_id = auth.uid()
));
