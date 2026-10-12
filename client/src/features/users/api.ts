import { http } from "@/lib/http";
import type { AppUser, Paginated, UserRole } from "@/types/api";

export interface UserPayload {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  role: UserRole;
  companyId?: string;
  deviceIds?: string[];
  isActive?: boolean;
}

export const usersApi = {
  list: async (
    params: {
      companyId?: string;
      role?: UserRole;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<Paginated<AppUser>> =>
    (await http.get<Paginated<AppUser>>("/users", { params })).data,

  create: async (payload: UserPayload): Promise<AppUser> =>
    (await http.post<AppUser>("/users", payload)).data,

  update: async (
    id: string,
    payload: Partial<Omit<UserPayload, "role" | "companyId">>,
  ): Promise<AppUser> =>
    (await http.patch<AppUser>(`/users/${id}`, payload)).data,

  remove: async (id: string): Promise<void> => {
    await http.delete(`/users/${id}`);
  },
};
