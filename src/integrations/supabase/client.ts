/**
 * Custom API Client replacing Supabase
 * Connects to the local Node.js + Express backend (port 3001)
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://192.168.100.200:3001/api';

export async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = localStorage.getItem('bangbet_token');
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Request failed' }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }
  
  return response.json();
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => apiRequest<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined }),
};

// Export environment helpers
export const getSupabaseUrl = () => API_BASE;
export const getDatabaseMode = () => 'custom-server';
export const isProduction = () => import.meta.env.VITE_APP_ENV === 'production';
export const isCustomServer = () => true;

