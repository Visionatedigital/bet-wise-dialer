-- Approve and set admin role for shammahkahangi@gmail.com
-- Update profile to approved
UPDATE public.profiles 
SET approved = true, updated_at = now()
WHERE email = 'shammahkahangi@gmail.com';

-- Remove any existing roles for this user
DELETE FROM public.user_roles 
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'shammahkahangi@gmail.com');

-- Add admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM public.profiles
WHERE email = 'shammahkahangi@gmail.com';