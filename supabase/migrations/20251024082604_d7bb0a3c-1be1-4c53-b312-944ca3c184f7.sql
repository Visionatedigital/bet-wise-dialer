-- Allow leads to be unassigned (null user_id for initial import)
ALTER TABLE public.leads ALTER COLUMN user_id DROP NOT NULL;

-- Update RLS policies to handle unassigned leads
DROP POLICY IF EXISTS "Agents can view assigned leads" ON public.leads;

CREATE POLICY "Agents can view assigned leads"
ON public.leads
FOR SELECT
USING (
  (EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.approved = true
  )) 
  AND (
    auth.uid() = user_id 
    OR has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'management'::app_role)
  )
);

-- Add policy for admins to see unassigned leads
CREATE POLICY "Admins can view all leads including unassigned"
ON public.leads
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'management'::app_role)
);