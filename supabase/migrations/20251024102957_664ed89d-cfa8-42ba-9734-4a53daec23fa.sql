-- Clear all call activities to start fresh
DELETE FROM public.call_activities;

-- Delete the user and related data
-- First, get the user_id for btahoora1@gmail.com
DO $$
DECLARE
  target_user_id uuid;
BEGIN
  -- Find the user ID from profiles
  SELECT id INTO target_user_id
  FROM public.profiles
  WHERE email = 'btahoora1@gmail.com';

  IF target_user_id IS NOT NULL THEN
    -- Delete related data (cascade should handle most, but being explicit)
    DELETE FROM public.user_roles WHERE user_id = target_user_id;
    DELETE FROM public.profiles WHERE id = target_user_id;
    DELETE FROM public.leads WHERE user_id = target_user_id OR assigned_by = target_user_id;
    DELETE FROM public.callbacks WHERE user_id = target_user_id;
    DELETE FROM public.campaigns WHERE user_id = target_user_id;
    DELETE FROM public.daily_metrics WHERE user_id = target_user_id;
    DELETE FROM public.webrtc_tokens WHERE user_id = target_user_id;
    
    -- Delete from auth.users (this will cascade delete the profile if not already deleted)
    DELETE FROM auth.users WHERE id = target_user_id;
    
    RAISE NOTICE 'Deleted user with email btahoora1@gmail.com';
  ELSE
    RAISE NOTICE 'User with email btahoora1@gmail.com not found';
  END IF;
END $$;

-- Reset daily metrics to reflect the cleared call activities
DELETE FROM public.daily_metrics;