import { http } from "@/lib/http";
import type { AuthProfile, AuthResponse } from "@/types/api";

export const authApi = {
  login: async (email: string, password: string): Promise<AuthResponse> =>
    (await http.post<AuthResponse>("/auth/login", { email, password })).data,

  me: async (): Promise<AuthProfile> =>
    (await http.get<AuthProfile>("/auth/me")).data,
};
