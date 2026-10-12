import { UserRole } from '../enums/user-role.enum';

/** Shape attached to `request.user` after the JWT guard runs. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  fullName: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  type: 'access' | 'refresh';
}
