
-- Add phone column to profiles
ALTER TABLE public.profiles ADD COLUMN phone text;

-- Create function to look up email by username (case-insensitive) for login
CREATE OR REPLACE FUNCTION public.get_email_by_username(_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email
  FROM auth.users u
  JOIN public.profiles p ON p.user_id = u.id
  WHERE lower(p.username) = lower(_username)
  AND p.active = true
  LIMIT 1
$$;
