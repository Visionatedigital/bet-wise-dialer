// Supabase Client Configuration
// Environment variables are loaded from .env file (VITE_ prefix required for Vite)
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Get Supabase URL and Key from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validate environment variables are set
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    'Missing Supabase environment variables. Please ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in your .env file.'
  );
}

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Export environment helpers for use in other parts of the app
export const getSupabaseUrl = () => SUPABASE_URL;
export const isProduction = () => import.meta.env.VITE_APP_ENV === 'production';