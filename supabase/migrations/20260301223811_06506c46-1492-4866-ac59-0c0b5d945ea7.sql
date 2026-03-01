
-- Add separate From/To time range columns for custom availability
-- "From" dropdown range: e.g. 12:00 to 18:00
-- "To" dropdown range: e.g. 15:00 to 22:00
ALTER TABLE public.location_settings
  ADD COLUMN IF NOT EXISTS availability_from_start text NOT NULL DEFAULT '12:00',
  ADD COLUMN IF NOT EXISTS availability_from_end text NOT NULL DEFAULT '18:00',
  ADD COLUMN IF NOT EXISTS availability_to_start text NOT NULL DEFAULT '15:00',
  ADD COLUMN IF NOT EXISTS availability_to_end text NOT NULL DEFAULT '22:00';

-- Migrate existing data: use old earliest/latest as reasonable defaults
UPDATE public.location_settings
SET availability_from_start = availability_earliest_time,
    availability_to_end = availability_latest_time;
