// Supabase Client Configuration
// Environment variables are loaded from .env file (VITE_ prefix required for Vite)
// Supports: Supabase Cloud, Local Supabase, and Custom PostgreSQL Server (via PostgREST)
import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Database connection mode
export type DatabaseMode = 'supabase-cloud' | 'supabase-local' | 'custom-server';

// Get database configuration from environment variables
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const DATABASE_MODE = (import.meta.env.VITE_DATABASE_MODE || 'supabase-cloud') as DatabaseMode;

// Custom server configuration (for local PostgreSQL server with PostgREST)
// This allows connecting to a company-hosted PostgreSQL server via PostgREST API
const CUSTOM_DB_URL = import.meta.env.VITE_CUSTOM_DB_URL; // e.g., http://localhost:3000 or http://company-server:3000
const CUSTOM_DB_KEY = import.meta.env.VITE_CUSTOM_DB_KEY; // API key for custom server (PostgREST anon key)
const CUSTOM_DB_SCHEMA = import.meta.env.VITE_CUSTOM_DB_SCHEMA || 'public'; // Database schema name

// Determine which URL and key to use based on mode
const getDatabaseUrl = (): string => {
  if (DATABASE_MODE === 'custom-server') {
    if (!CUSTOM_DB_URL) {
      throw new Error(
        'Custom server mode requires VITE_CUSTOM_DB_URL to be set in your .env file.'
      );
    }
    return CUSTOM_DB_URL;
  }
  
  if (!SUPABASE_URL) {
    throw new Error(
      'Missing Supabase URL. Please ensure VITE_SUPABASE_URL is set in your .env file.'
    );
  }
  
  return SUPABASE_URL;
};

const getDatabaseKey = (): string => {
  if (DATABASE_MODE === 'custom-server') {
    if (!CUSTOM_DB_KEY) {
      throw new Error(
        'Custom server mode requires VITE_CUSTOM_DB_KEY to be set in your .env file.'
      );
    }
    return CUSTOM_DB_KEY;
  }
  
  if (!SUPABASE_ANON_KEY) {
    throw new Error(
      'Missing Supabase API key. Please ensure VITE_SUPABASE_ANON_KEY is set in your .env file.'
    );
  }
  
  return SUPABASE_ANON_KEY;
};

const DB_URL = getDatabaseUrl();
const DB_KEY = getDatabaseKey();

// Import the supabase client like this:
// import { supabase } from "@/integrations/supabase/client";

export const supabase = createClient<Database>(DB_URL, DB_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
    // For custom servers, auth might be handled differently
    // If your local server doesn't support Supabase Auth, you may need to implement custom auth
    detectSessionInUrl: DATABASE_MODE !== 'custom-server',
  },
  // For custom servers, we may need to adjust these settings
  db: {
    schema: DATABASE_MODE === 'custom-server' ? CUSTOM_DB_SCHEMA : 'public',
  },
  global: {
    headers: DATABASE_MODE === 'custom-server' ? {
      'apikey': DB_KEY,
      'Content-Type': 'application/json',
    } : undefined,
  },
});

// Export environment helpers for use in other parts of the app
export const getSupabaseUrl = () => DB_URL;
export const getDatabaseMode = () => DATABASE_MODE;
export const isProduction = () => import.meta.env.VITE_APP_ENV === 'production';
export const isCustomServer = () => DATABASE_MODE === 'custom-server';