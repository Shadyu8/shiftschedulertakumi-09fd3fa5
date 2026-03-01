
-- Add 'kiosk' to the app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'kiosk';

-- Create kiosk_accounts table to link kiosk auth users to specific locations
CREATE TABLE public.kiosk_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  location_id uuid NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  created_by uuid NOT NULL
);

-- Enable RLS
ALTER TABLE public.kiosk_accounts ENABLE ROW LEVEL SECURITY;

-- Managers and admins can manage kiosk accounts
CREATE POLICY "Managers manage kiosk accounts"
ON public.kiosk_accounts
FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role)
);

-- Kiosk users can view their own record (to get location_id)
CREATE POLICY "Kiosk users view own account"
ON public.kiosk_accounts
FOR SELECT
USING (user_id = auth.uid());
