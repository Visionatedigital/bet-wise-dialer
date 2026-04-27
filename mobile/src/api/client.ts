import * as SecureStore from "expo-secure-store";

// Change this to your backend IP/URL
export const API_BASE = "http://159.89.51.97:3001/api";

export const TOKEN_KEY = "bangbet_token";

// In-memory fallback if SecureStore is unavailable (e.g. Expo Go limitations)
let memoryToken: string | null = null;

export async function getToken(): Promise<string | null> {
  try {
    const val = await SecureStore.getItemAsync(TOKEN_KEY);
    return val ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

export async function setToken(token: string): Promise<void> {
  memoryToken = token;
  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  } catch {
    // fallback to memory only
  }
}

export async function clearToken(): Promise<void> {
  memoryToken = null;
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // fallback — memory already cleared
  }
}

async function apiRequest<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const token = await getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ message: "Request failed" }));
    throw new Error(error.error || error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

export const api = {
  get: <T>(path: string) => apiRequest<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body: unknown) =>
    apiRequest<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: "DELETE",
      body: body ? JSON.stringify(body) : undefined,
    }),
};
