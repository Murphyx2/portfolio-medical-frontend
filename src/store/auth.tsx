import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import { api, clearTokens, getAccessToken, getRefreshToken, setTokens } from "../services/api";
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
    const access = getAccessToken();
    if (!access) {
      setLoading(false);
      return;
    }
    api
      .get<User>("/auth/me/")
      .then(setUser)
      .catch(() => clearTokens())
      .finally(() => setLoading(false));
  }, []);

  async function login(username: string, password: string) {
    const data = await api.post<LoginResponse>("/auth/login/", { username, password });
    setTokens(data.access, data.refresh);
    setUser(data.user);
  }

  async function logout() {
    try {
      const refresh = getRefreshToken();
      if (refresh) {
        await api.post("/auth/logout/", { refresh });
      }
    } catch {
      // Token may already be invalid/expired; still clear local state.
    } finally {
      clearTokens();
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
