/// <reference types="vite/client" />

// Type definitions for environment variables
interface ImportMetaEnv {
  // Database Configuration
  // Mode: 'supabase-cloud' | 'supabase-local' | 'custom-server'
  readonly VITE_DATABASE_MODE?: 'supabase-cloud' | 'supabase-local' | 'custom-server';
  
  // Supabase Configuration (Required for supabase-cloud and supabase-local modes)
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  
  // Custom Server Configuration (Required for custom-server mode)
  // For company-hosted PostgreSQL server via PostgREST
  readonly VITE_CUSTOM_DB_URL?: string; // e.g., http://localhost:3000 or http://company-server:3000
  readonly VITE_CUSTOM_DB_KEY?: string; // PostgREST anon key or API key
  readonly VITE_CUSTOM_DB_SCHEMA?: string; // Database schema (default: 'public')
  
  // App Configuration
  readonly VITE_APP_NAME?: string;
  readonly VITE_APP_ENV?: 'development' | 'staging' | 'production';
  
  // Feature Flags
  readonly VITE_ENABLE_WHATSAPP?: string;
  readonly VITE_ENABLE_AI_COACH?: string;
  readonly VITE_ENABLE_CALL_RECORDING?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
