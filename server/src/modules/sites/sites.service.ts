import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResult } from '../../shared/dto/paginated-result.dto';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { UserRole } from '../../shared/enums/user-role.enum';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { AccessScopeService } from '../../shared/services/access-scope.service';
import { DeviceAssignmentService } from '../access/device-assignment.service';
import { CompaniesService } from '../companies/companies.service';
import { EarningsService } from '../earnings/earnings.service';
import { CreateSiteDto } from './dto/create-site.dto';
import { SiteSummaryDto } from './dto/site-summary.dto';
import { UpdateSiteDto } from './dto/update-site.dto';
import { Site } from './entities/site.entity';

const SORTABLE: Record<string, string> = {
  name: 'site.name',
  address: 'site.address',
  createdAt: 'site.createdAt',
};

export interface SiteListQuery extends PaginationQueryDto {
  companyId?: string;
}

/** Sites are the "objects" (addresses) a company has registered. */
@Injectable()
export class SitesService {
  constructor(
    @InjectRepository(Site)
    private readonly sites: Repository<Site>,
    private readonly companies: CompaniesService,
    private readonly earnings: EarningsService,
    private readonly accessScope: AccessScopeService,
    private readonly assignments: DeviceAssignmentService,
  ) {}

  async list(
    user: AuthenticatedUser,
    query: SiteListQuery,
  ): Promise<PaginatedResult<SiteSummaryDto>> {
    const qb = this.sites
      .createQueryBuilder('site')
      .leftJoin('site.company', 'company')
      .addSelect(['company.id', 'company.name'])
      .loadRelationCountAndMap('site.deviceCount', 'site.devices')
      .skip(query.skip)
      .take(query.limit);

    const companyFilter = this.accessScope.companyFilter(user);
    if (companyFilter) {
      qb.andWhere('site.companyId = :companyFilter', { companyFilter });
    } else if (query.companyId) {
      qb.andWhere('site.companyId = :companyId', { companyId: query.companyId });
    }

    // A manager only sees the objects that hold at least one of their devices.
    if (user.role === UserRole.MANAGER) {
      const deviceIds = await this.assignments.deviceIdsForUser(user.id);
      if (!deviceIds.length) {
        return new PaginatedResult<SiteSummaryDto>([], 0, query.page, query.limit);
      }
      qb.andWhere(
        'site.id IN (SELECT d.site_id FROM devices d WHERE d.id IN (:...deviceIds) AND d.site_id IS NOT NULL)',
        { deviceIds },
      );
    }

    if (query.search) {
      qb.andWhere('(site.name ILIKE :search OR site.address ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }
    qb.orderBy(SORTABLE[query.sortBy ?? 'createdAt'] ?? SORTABLE.createdAt, query.sortOrder);

    const [rows, total] = await qb.getManyAndCount();
    const money = await this.earnings.totalsBySite(
      rows.map((r) => r.id),
      { months: 1 },
    );

    const items: SiteSummaryDto[] = rows.map((row) => {
      const withCount = row as Site & { deviceCount?: number };
      const totals = money.get(row.id);
      return {
        id: row.id,
        name: row.name,
        address: row.address,
        city: row.city,
        companyId: row.companyId,
        companyName: row.company?.name,
        isActive: row.isActive,
        deviceCount: withCount.deviceCount ?? 0,
        monthEarnings: totals?.total ?? 0,
        monthCommission: totals?.commission ?? 0,
        createdAt: row.createdAt,
      };
    });

    return new PaginatedResult(items, total, query.page, query.limit);
  }

  async findOneScoped(user: AuthenticatedUser, id: string): Promise<Site> {
    const site = await this.sites.findOne({ where: { id }, relations: { company: true } });
    if (!site) throw new NotFoundException(`Object ${id} not found`);
    this.accessScope.assertCompanyAccess(user, site.companyId);
    return site;
  }

  async findById(id: string): Promise<Site> {
    const site = await this.sites.findOne({ where: { id } });
    if (!site) throw new NotFoundException(`Object ${id} not found`);
    return site;
  }

  async create(user: AuthenticatedUser, dto: CreateSiteDto): Promise<Site> {
    const companyId = this.accessScope.resolveWriteCompanyId(user, dto.companyId);
    await this.companies.assertExists(companyId);

    const site = this.sites.create({
      ...dto,
      companyId,
      latitude: dto.latitude?.toString() ?? null,
      longitude: dto.longitude?.toString() ?? null,
    });
    return this.sites.save(site);
  }

  async update(user: AuthenticatedUser, id: string, dto: UpdateSiteDto): Promise<Site> {
    const site = await this.findOneScoped(user, id);
    Object.assign(site, {
      ...dto,
      latitude: dto.latitude !== undefined ? dto.latitude.toString() : site.latitude,
      longitude: dto.longitude !== undefined ? dto.longitude.toString() : site.longitude,
    });
    return this.sites.save(site);
  }

  async remove(user: AuthenticatedUser, id: string): Promise<void> {
    const site = await this.findOneScoped(user, id);
    // Devices keep existing with site_id = NULL (ON DELETE SET NULL), so a
    // deleted object never silently takes terminals and their money with it.
    await this.sites.softRemove(site);
  }
}
