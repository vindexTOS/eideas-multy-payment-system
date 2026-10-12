import { Injectable } from '@nestjs/common';
import { UserRole } from '../../shared/enums/user-role.enum';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { AccessScopeService } from '../../shared/services/access-scope.service';
import { DeviceAssignmentService } from '../access/device-assignment.service';
import { EarningsScope } from './earnings.service';

/**
 * Turns "who is asking" into a WHERE clause.
 *
 * Note it never needs to verify that a requested device belongs to the
 * caller: the company (and for managers, the device whitelist) is ANDed into
 * every query, so asking for someone else's device returns zeros, never
 * someone else's money.
 */
@Injectable()
export class EarningsScopeService {
  constructor(
    private readonly accessScope: AccessScopeService,
    private readonly assignments: DeviceAssignmentService,
  ) {}

  async resolve(
    user: AuthenticatedUser,
    requested: { companyId?: string; siteId?: string; deviceId?: string } = {},
  ): Promise<EarningsScope> {
    const scope: EarningsScope = {
      companyId: this.accessScope.isAdmin(user) ? (requested.companyId ?? null) : user.companyId,
      siteId: requested.siteId ?? null,
      deviceId: requested.deviceId ?? null,
    };

    if (user.role === UserRole.MANAGER) {
      scope.deviceIds = await this.assignments.deviceIdsForUser(user.id);
    }
    return scope;
  }
}
