
-- Fix time_punches RLS: add organization boundary for managers/shiftleaders

DROP POLICY IF EXISTS "Managers manage punches" ON public.time_punches;
DROP POLICY IF EXISTS "Users insert own punches" ON public.time_punches;

-- Managers/shiftleaders can only manage punches at locations in their org
CREATE POLICY "Managers manage punches in org"
  ON public.time_punches
  FOR ALL
  TO authenticated
  USING (
    (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'shiftleader'::app_role))
    AND location_id IN (
      SELECT id FROM public.locations WHERE organization_id = public.get_user_org(auth.uid())
    )
  )
  WITH CHECK (
    (public.has_role(auth.uid(), 'manager'::app_role) OR public.has_role(auth.uid(), 'shiftleader'::app_role))
    AND location_id IN (
      SELECT id FROM public.locations WHERE organization_id = public.get_user_org(auth.uid())
    )
  );

-- Users can insert own punches, or managers/shiftleaders for their org locations
CREATE POLICY "Users insert own punches"
  ON public.time_punches
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR (
      (public.has_role(auth.uid(), 'shiftleader'::app_role) OR public.has_role(auth.uid(), 'manager'::app_role))
      AND location_id IN (
        SELECT id FROM public.locations WHERE organization_id = public.get_user_org(auth.uid())
      )
    )
  );
