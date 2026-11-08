"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { bindAuthHandlers, gatewayFetch } from "@/lib/gateway/client";
import {
  clearTokens,
  decodeJwtScopes,
  readTokens,
  writeTokens,
} from "./token-storage";

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  isAdmin: boolean;
  isReady: boolean;
};

type AuthContextValue = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (input: {
    email: string;
    username: string;
    displayName: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    accessToken: null,
    refreshToken: null,
    isAdmin: false,
    isReady: false,
  });

  const applyTokens = useCallback(
    (accessToken: string | null, refreshToken: string | null) => {
      writeTokens(accessToken, refreshToken);
      setState({
        accessToken,
        refreshToken,
        isAdmin: accessToken ? decodeJwtScopes(accessToken).includes("admin") : false,
        isReady: true,
      });
    },
    [],
  );

  useEffect(() => {
    const stored = readTokens();
    applyTokens(stored.accessToken, stored.refreshToken);
    bindAuthHandlers({
      getAccessToken: () => readTokens().accessToken,
      getRefreshToken: () => readTokens().refreshToken,
      onTokens: (pair) => {
        if (!pair) {
          applyTokens(null, null);
          return;
        }
        applyTokens(
          pair.accessToken,
          pair.refreshToken ?? readTokens().refreshToken,
        );
      },
    });
  }, [applyTokens]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await gatewayFetch<{
        accessToken: string;
        refreshToken?: string;
      }>(
        "/api/auth/login",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email, password }),
        },
        { auth: false },
      );
      applyTokens(data.accessToken, data.refreshToken ?? null);
    },
    [applyTokens],
  );

  const register = useCallback(
    async (input: {
      email: string;
      username: string;
      displayName: string;
      password: string;
    }) => {
      await gatewayFetch(
        "/api/auth/register",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
        },
        { auth: false },
      );
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await gatewayFetch("/api/auth/logout", { method: "POST" }, { auth: true });
    } finally {
      clearTokens();
      applyTokens(null, null);
    }
  }, [applyTokens]);

  const value = useMemo(
    () => ({
      ...state,
      login,
      register,
      logout,
    }),
    [state, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
