
CREATE POLICY "Users view org profiles"
ON public.profiles
FOR SELECT
USING (organization_id = get_user_org(auth.uid()));
