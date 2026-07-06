"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import { clearSession, getTokens, setSessionCookies, setTokens } from "./tokens";
import type { AuthResponse, User, UserRole } from "./types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (usernameOrEmail: string, password: string) => Promise<User>;
  register: (data: {
    username: string;
    email: string;
    password: string;
    fullName?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function homeFor(role: UserRole): string {
  return role === "user" ? "/profile" : "/admin/users";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshMe = useCallback(async () => {
    if (!getTokens()?.accessToken) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
      setSessionCookies(me.role);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  const applyAuth = useCallback((data: AuthResponse): User => {
    setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
    setSessionCookies(data.user.role);
    setUser(data.user);
    return data.user;
  }, []);

  const login = useCallback(
    async (usernameOrEmail: string, password: string) => {
      const data = await api<AuthResponse>("/auth/login", {
        method: "POST",
        body: { usernameOrEmail, password },
        auth: false,
      });
      return applyAuth(data);
    },
    [applyAuth],
  );

  const register = useCallback(
    async (input: { username: string; email: string; password: string; fullName?: string }) => {
      const data = await api<AuthResponse>("/auth/register", {
        method: "POST",
        body: input,
        auth: false,
      });
      return applyAuth(data);
    },
    [applyAuth],
  );

  const logout = useCallback(async () => {
    const tokens = getTokens();
    if (tokens?.refreshToken) {
      await api("/auth/logout", {
        method: "POST",
        body: { refreshToken: tokens.refreshToken },
        auth: false,
      }).catch(() => undefined);
    }
    clearSession();
    setUser(null);
    router.push("/login");
  }, [router]);

  const value = useMemo(
    () => ({ user, loading, login, register, logout, refreshMe }),
    [user, loading, login, register, logout, refreshMe],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
