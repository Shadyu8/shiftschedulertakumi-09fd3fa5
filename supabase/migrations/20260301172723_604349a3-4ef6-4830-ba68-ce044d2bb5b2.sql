
-- 1. Fix profiles RLS: remove redundant admin check from manager policy
DROP POLICY IF EXISTS "Managers view org profiles" ON public.profiles;
CREATE POLICY "Managers view org profiles"
  ON public.profiles
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'manager'::app_role)
    AND organization_id = public.get_user_org(auth.uid())
  );

-- 2. Fix handle_new_user: always assign 'worker' role on self-signup, add input length limits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, full_name, unique_key)
  VALUES (
    NEW.id,
    substring(COALESCE(NEW.raw_user_meta_data->>'username', NEW.email), 1, 100),
    substring(COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), 1, 100),
    public.generate_unique_key()
  );
  -- Always assign 'worker' role for self-signups; admin-create-user edge function handles other roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'worker');
  RETURN NEW;
END;
$$;
