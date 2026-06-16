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

// Creating a dummy chainable object to prevent frontend crashes on unmigrated pages.
const dummyChain = {
  select: () => dummyChain,
  insert: () => dummyChain,
  update: () => dummyChain,
  delete: () => dummyChain,
  eq: () => dummyChain,
  neq: () => dummyChain,
  gt: () => dummyChain,
  gte: () => dummyChain,
  lt: () => dummyChain,
  lte: () => dummyChain,
  like: () => dummyChain,
  ilike: () => dummyChain,
  is: () => dummyChain,
  in: () => dummyChain,
  contains: () => dummyChain,
  containedBy: () => dummyChain,
  rangeGt: () => dummyChain,
  rangeGte: () => dummyChain,
  rangeLt: () => dummyChain,
  rangeLte: () => dummyChain,
  rangeAdjacent: () => dummyChain,
  overlaps: () => dummyChain,
  textSearch: () => dummyChain,
  match: () => dummyChain,
  not: () => dummyChain,
  or: () => dummyChain,
  filter: () => dummyChain,
  order: () => dummyChain,
  limit: () => dummyChain,
  range: () => dummyChain,
  abortSignal: () => dummyChain,
  single: () => Promise.resolve({ data: null, error: null }),
  maybeSingle: () => Promise.resolve({ data: null, error: null }),
  csv: () => Promise.resolve({ data: '', error: null }),
  then: Object.prototype.hasOwnProperty,
  catch: Object.prototype.hasOwnProperty,
  finally: Object.prototype.hasOwnProperty,
};

// Return a dummy promise resolving empty data by default so components can just await `supabase.from()`
const createDummyPromise = () => {
  const promise = Promise.resolve({ data: [], error: null, count: 0 });
  // Attach query builder methods to the promise
  Object.keys(dummyChain).forEach(key => {
    (promise as any)[key] = function() { return this; };
  });
  return promise;
};

// A mock supabase object for gradual migration.
export const supabase = {
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithPassword: () => Promise.resolve({ data: { user: null }, error: new Error('Use AuthContext') }),
    signUp: () => Promise.resolve({ data: { user: null }, error: new Error('Use AuthContext') }),
    signOut: () => Promise.resolve({ error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    resetPasswordForEmail: () => Promise.resolve({ error: null }),
    updateUser: () => Promise.resolve({ data: { user: null }, error: null })
  },
  from: (table: string) => {
    console.warn(`[Mock Supabase] Unmigrated DB call to table: ${table}. Data will be empty.`);
    return createDummyPromise() as any;
  },
  rpc: (fnName: string) => {
    console.warn(`[Mock Supabase] Unmigrated RPC call: ${fnName}. Data will be empty.`);
    return createDummyPromise() as any;
  },
  functions: {
    invoke: (fnName: string) => {
      console.warn(`[Mock Supabase] Unmigrated Edge Function call: ${fnName}`);
      return Promise.resolve({ data: null, error: null });
    }
  },
  channel: (name: string) => {
    return {
      on: () => ({ subscribe: () => ({ unsubscribe: () => {} }) }),
      subscribe: () => ({ unsubscribe: () => {} }),
      unsubscribe: () => {}
    };
  },
  removeChannel: () => {}
};


