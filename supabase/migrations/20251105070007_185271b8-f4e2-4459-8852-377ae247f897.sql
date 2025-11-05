-- Fix 1: Lock down notifications table to prevent fake notification injection
-- Drop the permissive policy that allows anyone to create notifications
DROP POLICY IF EXISTS "System can create notifications" ON public.notifications;

-- Create a restrictive policy that blocks all client-side inserts
-- Only backend functions with service role key can create notifications (bypasses RLS)
CREATE POLICY "Only backend can create notifications" ON public.notifications
FOR INSERT WITH CHECK (false);

-- Fix 2: Strengthen lead access policy to properly verify authentication and roles
-- Drop the existing weak policy
DROP POLICY IF EXISTS "Agents can view assigned leads" ON public.leads;

-- Create a more secure policy with proper authentication and role checks
CREATE POLICY "Agents can view assigned leads" ON public.leads
FOR SELECT USING (
  auth.uid() IS NOT NULL -- Must be authenticated
  AND EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() AND approved = true
  )
  AND (
    (has_role(auth.uid(), 'agent') AND auth.uid() = user_id) -- Agents see only their own leads
    OR has_role(auth.uid(), 'admin') -- Admins see all leads
    OR has_role(auth.uid(), 'management') -- Management sees all leads
    OR EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = leads.user_id AND manager_id = auth.uid() -- Managers see their team's leads
    )
  )
);