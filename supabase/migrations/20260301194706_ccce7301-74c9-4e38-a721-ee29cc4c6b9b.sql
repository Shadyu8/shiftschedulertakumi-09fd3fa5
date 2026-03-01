
-- Allow kiosk users to look up profiles in the same org (for PIN lookup)
CREATE POLICY "Kiosk users view org profiles"
ON public.profiles
FOR SELECT
USING (
  has_role(auth.uid(), 'kiosk'::app_role)
  AND organization_id = get_user_org(auth.uid())
);

-- Allow kiosk users to read time_punches for their location
CREATE POLICY "Kiosk users manage punches"
ON public.time_punches
FOR ALL
USING (
  has_role(auth.uid(), 'kiosk'::app_role)
  AND location_id IN (
    SELECT ka.location_id FROM kiosk_accounts ka WHERE ka.user_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'kiosk'::app_role)
  AND location_id IN (
    SELECT ka.location_id FROM kiosk_accounts ka WHERE ka.user_id = auth.uid()
  )
);

-- Allow kiosk users to read shifts at their location
CREATE POLICY "Kiosk users view shifts"
ON public.shifts
FOR SELECT
USING (
  has_role(auth.uid(), 'kiosk'::app_role)
  AND location_id IN (
    SELECT ka.location_id FROM kiosk_accounts ka WHERE ka.user_id = auth.uid()
  )
);

-- Kiosk users need to read locations for the join in kiosk_accounts query
CREATE POLICY "Kiosk users view own location"
ON public.locations
FOR SELECT
USING (
  has_role(auth.uid(), 'kiosk'::app_role)
  AND id IN (
    SELECT ka.location_id FROM kiosk_accounts ka WHERE ka.user_id = auth.uid()
  )
);
