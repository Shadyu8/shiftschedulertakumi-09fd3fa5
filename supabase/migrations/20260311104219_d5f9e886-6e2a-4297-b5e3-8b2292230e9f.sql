
CREATE TABLE public.fulltimer_schedule_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  location_id UUID NOT NULL REFERENCES public.locations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  removed BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, location_id, date)
);

ALTER TABLE public.fulltimer_schedule_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Managers manage fulltimer overrides"
ON public.fulltimer_schedule_overrides
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'manager'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users view own overrides"
ON public.fulltimer_schedule_overrides
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
