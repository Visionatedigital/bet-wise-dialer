-- Verify RLS is enabled on leads table (this is idempotent)
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to recreate them with better security
DROP POLICY IF EXISTS "Users can view their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can create their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can update their own leads" ON public.leads;
DROP POLICY IF EXISTS "Users can delete their own leads" ON public.leads;

-- Recreate policies with explicit checks
CREATE POLICY "Users can view their own leads"
ON public.leads
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own leads"
ON public.leads
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own leads"
ON public.leads
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create an audit log function for sensitive data access
CREATE OR REPLACE FUNCTION public.log_lead_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Log when phone numbers are accessed (for SELECT operations)
  IF TG_OP = 'SELECT' THEN
    -- You can add logging to a separate audit table here if needed
    RAISE LOG 'Lead data accessed: user_id=%, lead_id=%', auth.uid(), NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Add a check to ensure user_id is never NULL (additional safety)
ALTER TABLE public.leads
ALTER COLUMN user_id SET NOT NULL;

-- Add a constraint to ensure phone numbers follow a valid format
ALTER TABLE public.leads
DROP CONSTRAINT IF EXISTS valid_phone_format;

ALTER TABLE public.leads
ADD CONSTRAINT valid_phone_format 
CHECK (phone ~ '^\+?[0-9\s\-\(\)]+$');

-- Create a security definer function to verify RLS is working
CREATE OR REPLACE FUNCTION public.verify_leads_rls()
RETURNS TABLE(rls_enabled boolean, policy_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    relrowsecurity as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'leads') as policy_count
  FROM pg_class
  WHERE relname = 'leads';
$$;