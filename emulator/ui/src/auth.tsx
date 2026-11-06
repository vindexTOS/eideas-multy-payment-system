import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useLocation } from "react-router-dom";
import { api, tokenStore } from "./api";

interface AuthState {
  signedIn: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [signedIn, setSignedIn] = useState(() => !!tokenStore.get());
  const queryClient = useQueryClient();

  const logout = useCallback(() => {
    tokenStore.clear();
    queryClient.clear();
    setSignedIn(false);
  }, [queryClient]);

  const login = useCallback(async (email: string, password: string) => {
    const { accessToken } = await api.login(email, password);
    tokenStore.set(accessToken);
    setSignedIn(true);
  }, []);

  // Any 401 (expired session) drops back to the login screen.
  useEffect(() => {
    window.addEventListener("emulator:unauthorized", logout);
    return () => window.removeEventListener("emulator:unauthorized", logout);
  }, [logout]);

  const value = useMemo(
    () => ({ signedIn, login, logout }),
    [signedIn, login, logout],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthState => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth outside AuthProvider");
  return context;
};

export const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { signedIn } = useAuth();
  const location = useLocation();
  if (!signedIn)
    return <Navigate to="/login" replace state={{ from: location }} />;
  return <>{children}</>;
};
