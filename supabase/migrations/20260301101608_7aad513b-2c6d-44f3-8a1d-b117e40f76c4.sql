
-- Add approved column to time_punches (null = pending, true = approved, false = rejected)
ALTER TABLE public.time_punches ADD COLUMN approved boolean DEFAULT null;

-- Add approved_by column
ALTER TABLE public.time_punches ADD COLUMN approved_by uuid DEFAULT null;

-- Add approved_at timestamp
ALTER TABLE public.time_punches ADD COLUMN approved_at timestamp with time zone DEFAULT null;
