-- Add approved column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS approved boolean NOT NULL DEFAULT false;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_approved ON public.profiles(approved);

-- Update trigger to auto-approve agents on signup and create default agent role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile with approved=false by default
  INSERT INTO public.profiles (id, full_name, email, approved)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.email,
    false
  );
  
  -- Assign default 'agent' role to new users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'agent');
  
  RETURN NEW;
END;
$$;

-- Update RLS policies to check approval status
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;
CREATE POLICY "Users can view profiles"
ON public.profiles
FOR SELECT
USING (
  approved = true AND (
    auth.uid() = id 
    OR has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'management'::app_role)
  )
);

-- Allow admins to see all profiles including unapproved
CREATE POLICY "Admins can view all profiles including unapproved"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update approval status
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id OR has_role(auth.uid(), 'admin'::app_role));

-- Update leads RLS to also check approval
DROP POLICY IF EXISTS "Agents can view assigned leads" ON public.leads;
CREATE POLICY "Agents can view assigned leads"
ON public.leads
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.approved = true
  ) AND (
    auth.uid() = user_id 
    OR has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'management'::app_role)
  )
);