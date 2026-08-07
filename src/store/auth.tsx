import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { api, setAccessToken, tryRefresh } from "../services/api";
import type { LoginResponse, User } from "../services/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const refreshed = await tryRefresh();
      if (cancelled) return;
      if (!refreshed) {
        setLoading(false);
        return;
      }
      try {
        const me = await api.get<User>("/auth/me/");
        if (!cancelled) setUser(me);
      } catch {
        setAccessToken(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(username: string, password: string) {
    const data = await api.post<LoginResponse>("/auth/login/", { username, password });
    setAccessToken(data.access);
    setUser(data.user);
  }

  async function logout() {
    try {
      await api.post("/auth/logout/", {});
    } catch {
      // Cookie may already be invalid/expired; still clear local state.
    } finally {
      setAccessToken(null);
      setUser(null);
    }
  }

  async function refreshUser() {
    const me = await api.get<User>("/auth/me/");
    setUser(me);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
