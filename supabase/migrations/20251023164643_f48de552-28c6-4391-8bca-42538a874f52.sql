-- First, add new enum values (they will be committed automatically in this transaction)
DO $$ 
BEGIN
  -- Add 'management' value if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'management' AND enumtypid = 'app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'management';
  END IF;
END $$;

DO $$ 
BEGIN
  -- Add 'agent' value if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'agent' AND enumtypid = 'app_role'::regtype) THEN
    ALTER TYPE public.app_role ADD VALUE 'agent';
  END IF;
END $$;