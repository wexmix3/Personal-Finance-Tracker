"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import type { UserResponse } from "@/types/api";

const API_URL = "";
// Access token lives in module memory — never touches localStorage or the DOM.
let _memToken: string | null = null;

export function getStoredToken(): string | null { return _memToken; }
export function setStoredToken(t: string): void  { _memToken = t; }
export function clearStoredToken(): void          { _memToken = null; }

// -----------------------------------------------------------------------
// Context
// -----------------------------------------------------------------------
interface AuthState {
  user: UserResponse | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function callRefresh(): Promise<string | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) return null;
    const body = await res.json();
    return (body.data?.access_token as string) ?? null;
  } catch {
    return null;
  }
}

async function fetchMe(token: string): Promise<UserResponse | null> {
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body.data as UserResponse;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const applyToken = useCallback((t: string, u: UserResponse) => {
    setStoredToken(t);
    setToken(t);
    setUser(u);
    // Refresh 1 minute before 15-min expiry
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    refreshTimer.current = setTimeout(async () => {
      const newToken = await callRefresh();
      if (newToken) {
        const newUser = await fetchMe(newToken);
        if (newUser) applyToken(newToken, newUser);
      }
    }, 14 * 60 * 1000);
  }, []);

  // On mount: attempt silent refresh from httpOnly cookie
  useEffect(() => {
    callRefresh().then(async (t) => {
      if (t) {
        const u = await fetchMe(t);
        if (u) applyToken(t, u);
      }
    }).finally(() => setIsLoading(false));
    return () => { if (refreshTimer.current) clearTimeout(refreshTimer.current); };
  }, [applyToken]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.detail ?? body.error ?? `Login failed (${res.status})`);

    const t: string = body.data.access_token;
    const u = await fetchMe(t);
    if (!u) throw new Error("Could not fetch user after login");
    applyToken(t, u);
  }, [applyToken]);

  const register = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.detail ?? body.error ?? `Registration failed (${res.status})`);
    // Registration now sends a verification email — no token returned
  }, []);

  const logout = useCallback(async () => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
    clearStoredToken();
    setToken(null);
    setUser(null);
    await fetch(`${API_URL}/api/auth/logout`, { method: "POST", credentials: "include" }).catch(() => {});
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}