
-- Function to generate a unique 5-digit key
CREATE OR REPLACE FUNCTION public.generate_unique_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_key text;
  key_exists boolean;
BEGIN
  LOOP
    new_key := lpad(floor(random() * 100000)::text, 5, '0');
    SELECT EXISTS(SELECT 1 FROM profiles WHERE unique_key = new_key) INTO key_exists;
    EXIT WHEN NOT key_exists;
  END LOOP;
  RETURN new_key;
END;
$$;

-- Add unique constraint on unique_key
ALTER TABLE public.profiles ADD CONSTRAINT profiles_unique_key_unique UNIQUE (unique_key);

-- Backfill existing profiles that don't have a unique_key
DO $$
DECLARE
  rec RECORD;
  new_key text;
  key_exists boolean;
BEGIN
  FOR rec IN SELECT id FROM profiles WHERE unique_key IS NULL LOOP
    LOOP
      new_key := lpad(floor(random() * 100000)::text, 5, '0');
      SELECT EXISTS(SELECT 1 FROM profiles WHERE unique_key = new_key) INTO key_exists;
      EXIT WHEN NOT key_exists;
    END LOOP;
    UPDATE profiles SET unique_key = new_key WHERE id = rec.id;
  END LOOP;
END;
$$;

-- Update handle_new_user to auto-generate unique_key
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, full_name, unique_key)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    public.generate_unique_key()
  );
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'worker'));
  RETURN NEW;
END;
$$;
