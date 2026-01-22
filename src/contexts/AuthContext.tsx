import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

// Check if running in Tauri
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string, role?: string) => Promise<{ error: any; message?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  };

  const signUp = async (email: string, password: string, fullName?: string, role?: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
          role: role || 'agent'
        }
      }
    });
    
    // Return specific message for pending approval
    if (!error) {
      return { 
        error: null,
        message: 'Account created successfully! Your account is pending approval. An administrator will review and approve your access.'
      };
    }
    
    return { error };
  };

  const signOut = async () => {
    try {
      console.log('[Auth] Sign out initiated');
      
      // Clear admin view mode on logout first
      localStorage.removeItem('adminViewMode');
      
      // Clear WebRTC token on logout
      if (user?.id) {
        try {
          await supabase.from('webrtc_tokens').delete().eq('user_id', user.id);
        } catch (e) {
          console.warn('[Auth] Error clearing WebRTC token:', e);
        }
      }
      
      // Manually clear user state immediately to prevent race condition
      setUser(null);
      setSession(null);
      
      // Sign out from Supabase
      const { error } = await supabase.auth.signOut();
      if (error) {
        console.error('[Auth] Sign out error:', error);
        // Even if there's an error, we've cleared local state, so continue with redirect
      } else {
        console.log('[Auth] Sign out successful');
      }
      
      // Wait a brief moment to ensure auth state has propagated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Force clear any remaining session data
      await supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          console.warn('[Auth] Session still exists after signOut, forcing clear');
          setUser(null);
          setSession(null);
        }
      });
      
      // Clear all localStorage items that might cause issues
      localStorage.removeItem('adminViewMode');
      // Set a flag to prevent Auth page from redirecting back
      sessionStorage.setItem('signingOut', 'true');
      // Clear sessionStorage after a delay to allow redirect
      setTimeout(() => {
        sessionStorage.removeItem('signingOut');
      }, 1000);
      
      // In Tauri, use window.location for reliable navigation
      // In browser, we could use React Router, but window.location is more reliable
      if (isTauri) {
        // For Tauri, we need to use window.location to ensure proper navigation
        window.location.href = '/auth';
      } else {
        window.location.replace('/auth');
      }
    } catch (error) {
      console.error('[Auth] Sign out failed:', error);
      // Clear state even on error
      setUser(null);
      setSession(null);
      localStorage.removeItem('adminViewMode');
      sessionStorage.clear();
      
      // Even if there's an error, redirect to auth page
      if (isTauri) {
        window.location.href = '/auth';
      } else {
        window.location.replace('/auth');
      }
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};