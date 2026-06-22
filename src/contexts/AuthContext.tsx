import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '@/integrations/supabase/client';

// Check if running in Tauri
const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

interface BangbetUser {
  id: string;
  email: string;
  full_name: string;
  role: string;
  avatar_url?: string;
  approved?: boolean;
  country?: string;
}

interface AuthContextType {
  user: BangbetUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName?: string, role?: string, country?: string) => Promise<{ error: any; message?: string }>;
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
  const [user, setUser] = useState<BangbetUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Determine if we have a valid token on load
    const token = localStorage.getItem('bangbet_token');
    if (!token) {
      setLoading(false);
      return;
    }

    // Fetch user details
    api.get<BangbetUser>('/auth/me')
      .then((userData) => {
        setUser(userData);
        if (userData.country) {
          localStorage.setItem('bangbet_user_country', userData.country);
        }
      })
      .catch((err) => {
        console.warn('[Auth] Initial check failed (token possibly expired)', err);
        localStorage.removeItem('bangbet_token');
        localStorage.removeItem('bangbet_user_country');
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const response = await api.post<{ token: string; user: BangbetUser }>('/auth/login', { email, password });
      localStorage.setItem('bangbet_token', response.token);
      if (response.user.country) {
        localStorage.setItem('bangbet_user_country', response.user.country);
      }
      setUser(response.user);
      return { error: null };
    } catch (err: any) {
      console.error('[Auth] Sign in error:', err);
      return { error: err.message || 'Login failed' };
    }
  };

  const signUp = async (email: string, password: string, fullName?: string, role?: string, country = 'UG') => {
    try {
      const resp = await api.post<{ message: string }>('/auth/signup', { email, password, full_name: fullName, role, country });
      return { 
        error: null,
        message: resp.message || 'Account created successfully! Your account is pending approval.'
      };
    } catch (err: any) {
      console.error('[Auth] Sign up error:', err);
      return { error: err.message || 'Signup failed' };
    }
  };

  const signOut = async () => {
    try {
      console.log('[Auth] Sign out initiated');
      
      // Clear admin view mode on logout first
      localStorage.removeItem('adminViewMode');
      
      // Attempt to hit logout route (if token is still valid)
      await api.post('/auth/logout').catch(() => {});
      
      // Clear token completely
      localStorage.removeItem('bangbet_token');
      localStorage.removeItem('bangbet_user_country');
      
      setUser(null);
      
      // Set a flag to prevent Auth page from redirecting back
      sessionStorage.setItem('signingOut', 'true');
      setTimeout(() => {
        sessionStorage.removeItem('signingOut');
      }, 1000);
      
      if (isTauri) {
        window.location.href = '/auth';
      } else {
        window.location.replace('/auth');
      }
    } catch (error) {
      console.error('[Auth] Sign out failed:', error);
      setUser(null);
      localStorage.removeItem('bangbet_token');
      localStorage.removeItem('bangbet_user_country');
      localStorage.removeItem('adminViewMode');
      sessionStorage.clear();
      
      if (isTauri) {
        window.location.href = '/auth';
      } else {
        window.location.replace('/auth');
      }
    }
  };

  const value = {
    user,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};