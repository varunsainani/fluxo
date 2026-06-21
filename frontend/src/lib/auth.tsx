"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api, setAccessToken } from "./api";
import type { User } from "./types";

interface AuthResponse {
  user: User;
  accessToken: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (email: string, password: string, name: string) => Promise<User>;
  demoLogin: (role: "user" | "admin") => Promise<User>;
  logout: () => Promise<void>;
  /** Optimistically patch the in-memory user (e.g. after a profile save). */
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const bootstrapped = useRef(false);

  // On mount: try to restore the session via the refresh cookie, then /auth/me.
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    let cancelled = false;
    (async () => {
      try {
        const refreshed = await api.refresh();
        if (refreshed) {
          const { user } = await api.get<{ user: User }>("/auth/me");
          if (!cancelled) setUserState(user);
        }
      } catch {
        // no valid session — stay logged out
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const adopt = useCallback((res: AuthResponse): User => {
    setAccessToken(res.accessToken);
    setUserState(res.user);
    return res.user;
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await api.post<AuthResponse>("/auth/login", { email, password }, { auth: false });
      return adopt(res);
    },
    [adopt],
  );

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await api.post<AuthResponse>("/auth/register", { email, password, name }, { auth: false });
      return adopt(res);
    },
    [adopt],
  );

  const demoLogin = useCallback(
    async (role: "user" | "admin") => {
      const res = await api.post<AuthResponse>("/auth/demo", { role }, { auth: false });
      return adopt(res);
    },
    [adopt],
  );

  const logout = useCallback(async () => {
    try {
      await api.post("/auth/logout", undefined, { auth: false });
    } catch {
      // ignore network errors on logout
    }
    setAccessToken(null);
    setUserState(null);
  }, []);

  const setUser = useCallback((u: User) => setUserState(u), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, register, demoLogin, logout, setUser }),
    [user, loading, login, register, demoLogin, logout, setUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
