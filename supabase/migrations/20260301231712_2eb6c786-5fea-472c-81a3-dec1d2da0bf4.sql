
-- Add location_id to availability table
ALTER TABLE public.availability
ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE;

-- Add location_id to availability_exceptions table
ALTER TABLE public.availability_exceptions
ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE;

-- Add location_id to availability_templates table
ALTER TABLE public.availability_templates
ADD COLUMN location_id uuid REFERENCES public.locations(id) ON DELETE CASCADE;

-- Update RLS: managers view availability for their assigned locations
DROP POLICY IF EXISTS "Managers view availability" ON public.availability;
CREATE POLICY "Managers view availability"
ON public.availability
FOR SELECT
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND user_id IN (
    SELECT p.user_id FROM profiles p
    WHERE p.organization_id = get_user_org(auth.uid())
  )
);

-- Update RLS: managers view availability exceptions for their assigned locations
DROP POLICY IF EXISTS "Managers view exceptions" ON public.availability_exceptions;
CREATE POLICY "Managers view exceptions"
ON public.availability_exceptions
FOR SELECT
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND user_id IN (
    SELECT p.user_id FROM profiles p
    WHERE p.organization_id = get_user_org(auth.uid())
  )
);
