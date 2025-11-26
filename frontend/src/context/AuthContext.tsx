'use client';

import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch } from "@/lib/api";
import { LoginResponse, MeResponse, User } from "@/types";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const STORAGE_KEY = "hut_token";

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return localStorage.getItem(STORAGE_KEY);
  });
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const response = await apiFetch<MeResponse>("/auth/me", { token });
      setUser(response.user);
    } catch (error) {
      console.error(error);
      setToken(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: { email, password },
    });

    setToken(response.token);
    setUser(response.user);
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, response.token);
    }
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try {
        await apiFetch("/auth/logout", {
          method: "POST",
          token,
        });
      } catch (error) {
        console.error(error);
      }
    }

    setToken(null);
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [token]);

  const refreshProfile = useCallback(async () => {
    if (!token) return;

    const response = await apiFetch<MeResponse>("/auth/me", { token });
    setUser(response.user);
  }, [token]);

  const value = useMemo(
    () => ({
      user,
      token,
      loading,
      login,
      logout,
      refreshProfile,
    }),
    [user, token, loading, login, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return ctx;
};

