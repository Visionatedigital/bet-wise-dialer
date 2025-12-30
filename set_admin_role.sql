-- ============================================
-- Quick Script: Set Admin Role for Existing User
-- ============================================
-- INSTRUCTIONS:
-- 1. First, create the user in Supabase Dashboard:
--    Authentication → Users → Add User
--    (Set email, password, and check "Auto Confirm User")
--
-- 2. Replace 'admin@example.com' below with the email you used
--    (Search and replace all 3 occurrences)
--
-- 3. Run this script in Supabase SQL Editor
-- ============================================

-- STEP 1: Approve the user profile
UPDATE public.profiles 
SET approved = true, 
    updated_at = now(),
    full_name = COALESCE(full_name, 'Admin User')
WHERE email = 'admin@example.com';  -- ⬅️ CHANGE THIS EMAIL

-- STEP 2: Remove any existing roles for this user
DELETE FROM public.user_roles 
WHERE user_id = (SELECT id FROM public.profiles WHERE email = 'admin@example.com');  -- ⬅️ CHANGE THIS EMAIL

-- STEP 3: Add admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM public.profiles
WHERE email = 'admin@example.com'  -- ⬅️ CHANGE THIS EMAIL
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
WHERE p.email = 'admin@example.com'  -- ⬅️ CHANGE THIS EMAIL
GROUP BY p.id, p.email, p.full_name, p.approved;

