-- Confirm emails for approved users (admin operation)
-- This allows approved users to login without email confirmation
UPDATE auth.users
SET email_confirmed_at = now()
WHERE id IN (
  SELECT id FROM public.profiles WHERE approved = true
)
AND email_confirmed_at IS NULL;

-- Update old 'user' roles to 'agent' roles
-- The old default was 'user' but should be 'agent'
UPDATE public.user_roles
SET role = 'agent'
WHERE role = 'user';