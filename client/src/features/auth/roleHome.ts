import { UserRole, type AuthProfile } from "@/types/api";

type RoleUser = Pick<AuthProfile, "role" | "companyId">;

/**
 * Where each role lands after sign-in, on `/`, and when it opens a page its
 * role may not see. A `Record` so a new role fails to compile until it has a
 * home here.
 */
const ROLE_HOME: Record<UserRole, (user: RoleUser) => string> = {
  [UserRole.ADMIN]: () => "/companies",
  [UserRole.COMPANY]: (user) =>
    user.companyId ? `/companies/${user.companyId}` : "/companies",
  [UserRole.MANAGER]: () => "/devices",
};

export const homePathFor = (user: RoleUser): string =>
  ROLE_HOME[user.role]?.(user) ?? "/companies";
