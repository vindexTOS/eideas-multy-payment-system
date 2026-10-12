import axios, { AxiosError, type AxiosRequestConfig } from "axios";
import type { AuthResponse } from "@/types/api";
import { tokenStore } from "./tokens";

/**
 * Empty base URL means relative `/api`, which is what nginx proxies in
 * docker - so the same bundle works in every environment.
 */
const baseURL = `${import.meta.env.VITE_API_BASE_URL ?? ""}/api`;

export const http = axios.create({ baseURL, timeout: 30_000 });

http.interceptors.request.use((config) => {
  const token = tokenStore.access;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

/** Single in-flight refresh, so a burst of 401s does not stampede. */
let refreshing: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  const refreshToken = tokenStore.refresh;
  if (!refreshToken) return null;
  try {
    const { data } = await axios.post<AuthResponse>(`${baseURL}/auth/refresh`, {
      refreshToken,
    });
    tokenStore.set(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    tokenStore.clear();
    return null;
  }
};

http.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as
      (AxiosRequestConfig & { _retried?: boolean }) | undefined;
    const isAuthCall = config?.url?.includes("/auth/");

    if (
      error.response?.status === 401 &&
      config &&
      !config._retried &&
      !isAuthCall
    ) {
      config._retried = true;
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const token = await refreshing;
      if (token) {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${token}`,
        };
        return http.request(config);
      }
      // Refresh failed: drop to the login screen.
      window.dispatchEvent(new Event("eideas:unauthorized"));
    }
    return Promise.reject(error);
  },
);

/** Turns the API error envelope into something showable in a message/alert. */
export const errorMessage = (
  error: unknown,
  fallback = "Something went wrong",
): string => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as
      { message?: string | string[] } | undefined;
    const message = body?.message;
    if (Array.isArray(message)) return message.join(", ");
    if (message) return message;
    return error.message;
  }
  return error instanceof Error ? error.message : fallback;
};
