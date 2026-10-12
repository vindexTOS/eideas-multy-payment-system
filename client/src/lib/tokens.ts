const ACCESS_KEY = "eideas.accessToken";
const REFRESH_KEY = "eideas.refreshToken";

/**
 * Tokens live in localStorage: this is an internal back-office tool, and it
 * keeps the client stateless across reloads. Swap for httpOnly cookies if
 * the platform ever faces the public internet.
 */
export const tokenStore = {
  get access(): string | null {
    return localStorage.getItem(ACCESS_KEY);
  },
  get refresh(): string | null {
    return localStorage.getItem(REFRESH_KEY);
  },
  set(access: string, refresh: string): void {
    localStorage.setItem(ACCESS_KEY, access);
    localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear(): void {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};
