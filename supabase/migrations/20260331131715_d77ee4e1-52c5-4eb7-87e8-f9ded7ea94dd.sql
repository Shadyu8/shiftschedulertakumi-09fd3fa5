
-- Fix 1: shifts - Managers manage shifts (add org scope)
DROP POLICY IF EXISTS "Managers manage shifts" ON shifts;
CREATE POLICY "Managers manage shifts" ON shifts
FOR ALL TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND location_id IN (
    SELECT id FROM locations WHERE organization_id = get_user_org(auth.uid())
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND location_id IN (
    SELECT id FROM locations WHERE organization_id = get_user_org(auth.uid())
  )
);

-- Fix 2: user_locations - Managers manage user locations (add org scope)
DROP POLICY IF EXISTS "Managers manage user locations" ON user_locations;
CREATE POLICY "Managers manage user locations" ON user_locations
FOR ALL TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND location_id IN (
    SELECT id FROM locations WHERE organization_id = get_user_org(auth.uid())
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND location_id IN (
    SELECT id FROM locations WHERE organization_id = get_user_org(auth.uid())
  )
);

-- Fix 3: kiosk_accounts - Managers manage kiosk accounts (add org scope)
DROP POLICY IF EXISTS "Managers manage kiosk accounts" ON kiosk_accounts;
CREATE POLICY "Managers manage kiosk accounts" ON kiosk_accounts
FOR ALL TO public
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND location_id IN (
    SELECT id FROM locations WHERE organization_id = get_user_org(auth.uid())
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND location_id IN (
    SELECT id FROM locations WHERE organization_id = get_user_org(auth.uid())
  )
);

-- Fix 4: fulltimer_schedules - Managers manage fulltimer schedules (add org scope)
DROP POLICY IF EXISTS "Managers manage fulltimer schedules" ON fulltimer_schedules;
CREATE POLICY "Managers manage fulltimer schedules" ON fulltimer_schedules
FOR ALL TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND location_id IN (
    SELECT id FROM locations WHERE organization_id = get_user_org(auth.uid())
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND location_id IN (
    SELECT id FROM locations WHERE organization_id = get_user_org(auth.uid())
  )
);

-- Fix 5: fulltimer_schedule_overrides - Managers manage fulltimer overrides (add org scope)
DROP POLICY IF EXISTS "Managers manage fulltimer overrides" ON fulltimer_schedule_overrides;
CREATE POLICY "Managers manage fulltimer overrides" ON fulltimer_schedule_overrides
FOR ALL TO authenticated
USING (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND location_id IN (
    SELECT id FROM locations WHERE organization_id = get_user_org(auth.uid())
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND location_id IN (
    SELECT id FROM locations WHERE organization_id = get_user_org(auth.uid())
  )
);

-- Fix 6: location_settings - Admins manage location settings (add org scope)
DROP POLICY IF EXISTS "Admins manage location settings" ON location_settings;
CREATE POLICY "Admins manage location settings" ON location_settings
FOR ALL TO authenticated
USING (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND location_id IN (
    SELECT id FROM locations WHERE organization_id = get_user_org(auth.uid())
  )
)
WITH CHECK (
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'manager'::app_role))
  AND location_id IN (
    SELECT id FROM locations WHERE organization_id = get_user_org(auth.uid())
  )
);
