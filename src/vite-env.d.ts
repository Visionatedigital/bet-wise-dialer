/// <reference types="vite/client" />

// Type definitions for environment variables
interface ImportMetaEnv {
  // Supabase Configuration (Required)
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  
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
