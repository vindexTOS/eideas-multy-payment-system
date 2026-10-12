import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { tokenStore } from "@/lib/tokens";
import type { AuthProfile, UserRole } from "@/types/api";
import { authApi } from "./api";

interface AuthContextValue {
  user: AuthProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isCompany: boolean;
  isManager: boolean;
  can: (...roles: UserRole[]) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<AuthProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    queryClient.clear();
  }, [queryClient]);

  // Restore the session on boot: a stored token is only trusted after
  // /auth/me confirms the account is still active.
  useEffect(() => {
    if (!tokenStore.access) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  // The http layer shouts when a refresh fails for good.
  useEffect(() => {
    const handler = () => logout();
    window.addEventListener("eideas:unauthorized", handler);
    return () => window.removeEventListener("eideas:unauthorized", handler);
  }, [logout]);

  const login = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    tokenStore.set(response.accessToken, response.refreshToken);
    setUser(response.user);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: user?.role === "admin",
      isCompany: user?.role === "company",
      isManager: user?.role === "manager",
      can: (...roles: UserRole[]) => !!user && roles.includes(user.role),
      login,
      logout,
    }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
