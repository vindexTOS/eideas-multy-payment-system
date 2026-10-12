import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../shared/dto/paginated-result.dto';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { UserRole } from '../../shared/enums/user-role.enum';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { AccessScopeService } from '../../shared/services/access-scope.service';
import { PasswordService } from '../../shared/services/password.service';
import { DeviceAssignmentService } from '../access/device-assignment.service';
import { CompaniesService } from '../companies/companies.service';
import { DevicesService } from '../devices/devices.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { User } from './entities/user.entity';

export interface ListUsersQuery extends PaginationQueryDto {
  companyId?: string;
  role?: UserRole;
}

/**
 * Accounts and roles.
 *
 * Role rules enforced here:
 *  - admin   : no company, sees everything
 *  - company : exactly one company
 *  - manager : exactly one company + a device whitelist (so a company can
 *              hire someone to watch specific addresses only)
 */
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly users: Repository<User>,
    private readonly companies: CompaniesService,
    private readonly devices: DevicesService,
    private readonly assignments: DeviceAssignmentService,
    private readonly passwords: PasswordService,
    private readonly accessScope: AccessScopeService,
  ) {}

  /** Auth path only - returns the password hash, so never expose it. */
  findByEmailWithSecret(email: string): Promise<User | null> {
    return this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('LOWER(user.email) = LOWER(:email)', { email })
      .getOne();
  }

  async findById(id: string): Promise<User> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async list(
    actor: AuthenticatedUser,
    query: ListUsersQuery,
  ): Promise<PaginatedResult<UserResponseDto>> {
    const qb = this.users
      .createQueryBuilder('user')
      .leftJoin('user.company', 'company')
      .addSelect(['company.id', 'company.name'])
      .skip(query.skip)
      .take(query.limit)
      .orderBy('user.createdAt', query.sortOrder ?? 'DESC');

    const companyFilter = this.accessScope.companyFilter(actor);
    if (companyFilter) {
      qb.andWhere('user.companyId = :companyFilter', { companyFilter });
    } else if (query.companyId) {
      qb.andWhere('user.companyId = :companyId', { companyId: query.companyId });
    }
    if (query.role) qb.andWhere('user.role = :role', { role: query.role });
    if (query.search) {
      qb.andWhere('(user.email ILIKE :search OR user.fullName ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    const [rows, total] = await qb.getManyAndCount();
    const items = await Promise.all(rows.map((row) => this.toResponse(row)));
    return new PaginatedResult(items, total, query.page, query.limit);
  }

  async findOneScoped(actor: AuthenticatedUser, id: string): Promise<UserResponseDto> {
    const user = await this.users.findOne({ where: { id }, relations: { company: true } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    if (!this.accessScope.isAdmin(actor) && user.companyId !== actor.companyId) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return this.toResponse(user);
  }

  async create(actor: AuthenticatedUser, dto: CreateUserDto): Promise<UserResponseDto> {
    if (await this.users.countBy({ email: dto.email.toLowerCase() })) {
      throw new ConflictException(`A user with email ${dto.email} already exists`);
    }

    const companyId = await this.resolveCompanyForRole(actor, dto.role, dto.companyId);
    const user = this.users.create({
      email: dto.email.toLowerCase(),
      passwordHash: await this.passwords.hash(dto.password),
      fullName: dto.fullName,
      phone: dto.phone ?? null,
      role: dto.role,
      companyId,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.users.save(user);

    if (dto.role === UserRole.MANAGER && dto.deviceIds?.length) {
      await this.setDeviceAccess(saved, dto.deviceIds);
    }
    return this.toResponse(saved);
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateUserDto): Promise<UserResponseDto> {
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    if (!this.accessScope.isAdmin(actor) && user.companyId !== actor.companyId) {
      throw new NotFoundException(`User ${id} not found`);
    }

    if (dto.email && dto.email.toLowerCase() !== user.email) {
      if (await this.users.countBy({ email: dto.email.toLowerCase() })) {
        throw new ConflictException(`A user with email ${dto.email} already exists`);
      }
      user.email = dto.email.toLowerCase();
    }
    if (dto.password) user.passwordHash = await this.passwords.hash(dto.password);
    if (dto.fullName !== undefined) user.fullName = dto.fullName;
    if (dto.phone !== undefined) user.phone = dto.phone ?? null;
    if (dto.isActive !== undefined) user.isActive = dto.isActive;

    const saved = await this.users.save(user);
    if (dto.deviceIds) await this.setDeviceAccess(saved, dto.deviceIds);
    return this.toResponse(saved);
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    if (actor.id === id) throw new BadRequestException('You cannot delete your own account');
    const user = await this.users.findOne({ where: { id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    if (!this.accessScope.isAdmin(actor) && user.companyId !== actor.companyId) {
      throw new NotFoundException(`User ${id} not found`);
    }
    await this.assignments.removeByUser(user.id);
    await this.users.softRemove(user);
  }

  async markLogin(id: string): Promise<void> {
    await this.users.update({ id }, { lastLoginAt: new Date() });
  }

  /**
   * A manager may only be given devices of their own company - otherwise a
   * company could hand itself a window into someone else's terminals.
   */
  private async setDeviceAccess(user: User, deviceIds: string[]): Promise<void> {
    if (user.role !== UserRole.MANAGER) {
      throw new BadRequestException('Only manager accounts can have device assignments');
    }
    if (!user.companyId) throw new BadRequestException('Manager accounts must belong to a company');

    const allowed = new Set(await this.devices.idsForCompany(user.companyId));
    const foreign = deviceIds.filter((id) => !allowed.has(id));
    if (foreign.length) {
      throw new BadRequestException(`Devices not in this company: ${foreign.join(', ')}`);
    }
    await this.assignments.replaceForUser(user.id, deviceIds);
  }

  private async resolveCompanyForRole(
    actor: AuthenticatedUser,
    role: UserRole,
    requested?: string,
  ): Promise<string | null> {
    if (role === UserRole.ADMIN) {
      if (!this.accessScope.isAdmin(actor)) {
        throw new BadRequestException('Only an admin can create admin accounts');
      }
      return null;
    }
    const companyId = this.accessScope.resolveWriteCompanyId(actor, requested);
    await this.companies.assertExists(companyId);
    return companyId;
  }

  private async toResponse(user: User): Promise<UserResponseDto> {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      role: user.role,
      companyId: user.companyId,
      companyName: user.company?.name ?? null,
      isActive: user.isActive,
      lastLoginAt: user.lastLoginAt,
      deviceIds:
        user.role === UserRole.MANAGER ? await this.assignments.deviceIdsForUser(user.id) : [],
      createdAt: user.createdAt,
    };
  }
}
