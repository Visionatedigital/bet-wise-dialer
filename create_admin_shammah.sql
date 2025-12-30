-- ============================================
-- Create Admin User: shammahgordon@gmail.com
-- ============================================
-- INSTRUCTIONS:
-- 1. First create the user in Supabase Dashboard:
--    Authentication → Users → Add User
--    Email: shammahgordon@gmail.com
--    Password: Sundaylover12
--    ✅ Check "Auto Confirm User"
--    Click "Create User"
--
-- 2. Then run this script in SQL Editor
-- ============================================

-- STEP 1: Approve the user profile
UPDATE public.profiles 
SET approved = true, 
    updated_at = now(),
    full_name = COALESCE(full_name, 'Admin User')
WHERE email = 'shammahgordon@gmail.com';

-- STEP 2: Remove any existing roles for this user
DELETE FROM public.user_roles 
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'shammahgordon@gmail.com');

-- STEP 3: Add admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM public.profiles
WHERE email = 'shammahgordon@gmail.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- STEP 4: Verify the admin user was created successfully
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.approved,
  array_agg(ur.role) as roles
FROM public.profiles p
LEFT JOIN public.user_roles ur ON p.id = ur.user_id
WHERE p.email = 'shammahgordon@gmail.com'
GROUP BY p.id, p.email, p.full_name, p.approved;

