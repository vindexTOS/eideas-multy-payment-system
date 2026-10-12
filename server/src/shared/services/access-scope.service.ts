import { ForbiddenException, Injectable } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';

/**
 * Pure, dependency-free answers to "what is this user allowed to see".
 * Row-level filtering lives in each domain service; this is the single
 * source of truth for the rules themselves.
 */
@Injectable()
export class AccessScopeService {
  isAdmin(user: AuthenticatedUser): boolean {
    return user.role === UserRole.ADMIN;
  }

  /** Managers only ever see devices explicitly assigned to them. */
  isDeviceScoped(user: AuthenticatedUser): boolean {
    return user.role === UserRole.MANAGER;
  }

  /**
   * `null` = no company filter (admin sees everything).
   * Otherwise the company id every query must be constrained to.
   */
  companyFilter(user: AuthenticatedUser): string | null {
    if (this.isAdmin(user)) return null;
    if (!user.companyId) {
      throw new ForbiddenException('Account is not attached to a company');
    }
    return user.companyId;
  }

  assertCompanyAccess(user: AuthenticatedUser, companyId: string | null | undefined): void {
    if (this.isAdmin(user)) return;
    if (!companyId || companyId !== user.companyId) {
      throw new ForbiddenException('This record belongs to another company');
    }
  }

  /** Resolve the company a write should land on. */
  resolveWriteCompanyId(user: AuthenticatedUser, requested?: string | null): string {
    if (this.isAdmin(user)) {
      if (!requested) throw new ForbiddenException('companyId is required for admin writes');
      return requested;
    }
    const own = this.companyFilter(user);
    if (requested && requested !== own) {
      throw new ForbiddenException('Cannot create records for another company');
    }
    return own as string;
  }
}
