
-- Role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'shiftleader', 'worker');

-- Organizations
CREATE TABLE public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Locations
CREATE TABLE public.locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  timezone TEXT NOT NULL DEFAULT 'Europe/Amsterdam',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Location settings
CREATE TABLE public.location_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL UNIQUE REFERENCES public.locations(id) ON DELETE CASCADE,
  time_entry_mode TEXT NOT NULL DEFAULT 'QUARTER_HOUR_ONLY',
  time_entry_increment_mins INTEGER NOT NULL DEFAULT 15,
  breaks_enabled BOOLEAN NOT NULL DEFAULT false,
  availability_deadline_day INTEGER NOT NULL DEFAULT 4,
  availability_deadline_time TEXT NOT NULL DEFAULT '23:59',
  earliest_shift_start TEXT NOT NULL DEFAULT '11:30',
  latest_shift_end TEXT NOT NULL DEFAULT '23:00',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.location_settings ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  username TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  profile_picture TEXT,
  unique_key TEXT UNIQUE,
  active BOOLEAN NOT NULL DEFAULT true,
  availability_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- User roles (separate table per security requirements)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- User locations (which locations a user is assigned to)
CREATE TABLE public.user_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, location_id)
);

ALTER TABLE public.user_locations ENABLE ROW LEVEL SECURITY;

-- Time punches (clock in/out)
CREATE TABLE public.time_punches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  punch_in TEXT NOT NULL,
  punch_out TEXT,
  recorded_in_by_id UUID REFERENCES auth.users(id),
  recorded_out_by_id UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_punches_user_date ON public.time_punches(user_id, date);
CREATE INDEX idx_punches_location_date ON public.time_punches(location_id, date);

ALTER TABLE public.time_punches ENABLE ROW LEVEL SECURITY;

-- Shifts
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  published BOOLEAN NOT NULL DEFAULT false,
  standby BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shifts_user_date ON public.shifts(user_id, date);
CREATE INDEX idx_shifts_location_date ON public.shifts(location_id, date);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Availability (weekly recurring)
CREATE TABLE public.availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL DEFAULT '1970-01-05',
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  available BOOLEAN NOT NULL DEFAULT true,
  start_time TEXT,
  end_time TEXT,
  preset TEXT,
  availability_type TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_start, day_of_week)
);

CREATE INDEX idx_availability_user ON public.availability(user_id);
CREATE INDEX idx_availability_user_week ON public.availability(user_id, week_start);

ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;

-- Availability exceptions (specific date overrides)
CREATE TABLE public.availability_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  available BOOLEAN NOT NULL DEFAULT false,
  start_time TEXT,
  end_time TEXT,
  preset TEXT,
  availability_type TEXT,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

ALTER TABLE public.availability_exceptions ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Function to get user's organization_id
CREATE OR REPLACE FUNCTION public.get_user_org(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- ============ RLS POLICIES ============

-- Organizations: admins see all, others see their own org
CREATE POLICY "Admins manage organizations" ON public.organizations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view own organization" ON public.organizations
  FOR SELECT TO authenticated
  USING (id = public.get_user_org(auth.uid()));

-- Locations: admins see all, managers/workers see locations in their org
CREATE POLICY "Admins manage locations" ON public.locations
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users view org locations" ON public.locations
  FOR SELECT TO authenticated
  USING (organization_id = public.get_user_org(auth.uid()));

-- Location settings: admins and managers can manage
CREATE POLICY "Admins manage location settings" ON public.location_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Users view location settings" ON public.location_settings
  FOR SELECT TO authenticated
  USING (
    location_id IN (
      SELECT id FROM public.locations WHERE organization_id = public.get_user_org(auth.uid())
    )
  );

-- Profiles: users see own, managers see org users, admins see all
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers view org profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'))
    AND organization_id = public.get_user_org(auth.uid())
  );

CREATE POLICY "Admins manage all profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- User roles: admins manage, users view own
CREATE POLICY "Users view own role" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Managers view org user roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND user_id IN (
      SELECT p.user_id FROM public.profiles p WHERE p.organization_id = public.get_user_org(auth.uid())
    )
  );

-- User locations: admins/managers manage, users view own
CREATE POLICY "Users view own locations" ON public.user_locations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Managers manage user locations" ON public.user_locations
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin')
  );

-- Time punches: users see own, managers/shiftleaders manage for org
CREATE POLICY "Users view own punches" ON public.time_punches
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users insert own punches" ON public.time_punches
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.has_role(auth.uid(), 'shiftleader') OR public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Managers manage punches" ON public.time_punches
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'shiftleader')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'shiftleader')
  );

-- Shifts: users see own published, managers manage all
CREATE POLICY "Users view own shifts" ON public.shifts
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users view published shifts" ON public.shifts
  FOR SELECT TO authenticated
  USING (published = true AND location_id IN (
    SELECT location_id FROM public.user_locations WHERE user_id = auth.uid()
  ));

CREATE POLICY "Managers manage shifts" ON public.shifts
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'admin'));

-- Availability: users manage own, managers view org
CREATE POLICY "Users manage own availability" ON public.availability
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers view availability" ON public.availability
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND user_id IN (
      SELECT p.user_id FROM public.profiles p WHERE p.organization_id = public.get_user_org(auth.uid())
    )
  );

-- Availability exceptions: same pattern
CREATE POLICY "Users manage own exceptions" ON public.availability_exceptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Managers view exceptions" ON public.availability_exceptions
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'manager')
    AND user_id IN (
      SELECT p.user_id FROM public.profiles p WHERE p.organization_id = public.get_user_org(auth.uid())
    )
  );

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, username, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  -- Default role is worker
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'worker'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_location_settings_updated_at BEFORE UPDATE ON public.location_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_time_punches_updated_at BEFORE UPDATE ON public.time_punches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_shifts_updated_at BEFORE UPDATE ON public.shifts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_availability_updated_at BEFORE UPDATE ON public.availability FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_availability_exceptions_updated_at BEFORE UPDATE ON public.availability_exceptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
