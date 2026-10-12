import { Global, Module } from '@nestjs/common';
import { AccessScopeService } from './services/access-scope.service';
import { CommissionService } from './services/commission.service';
import { PasswordService } from './services/password.service';

/**
 * Cross-cutting building blocks every feature module may use: the commission
 * rule, access scoping and password hashing. Deliberately dependency-free -
 * it must never import a feature module, so there can be no cycles.
 */
@Global()
@Module({
  providers: [CommissionService, AccessScopeService, PasswordService],
  exports: [CommissionService, AccessScopeService, PasswordService],
})
export class SharedModule {}
