import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Repository } from 'typeorm';
import { PaginatedResult } from '../../shared/dto/paginated-result.dto';
import { PaginationQueryDto } from '../../shared/dto/pagination-query.dto';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { AccessScopeService } from '../../shared/services/access-scope.service';
import { EarningsService } from '../earnings/earnings.service';
import { CompanySummaryDto } from './dto/company-summary.dto';
import { CreateCompanyDto } from './dto/create-company.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';
import { Company } from './entities/company.entity';

const SORTABLE: Record<string, string> = {
  name: 'company.name',
  identificationCode: 'company.identificationCode',
  createdAt: 'company.createdAt',
};

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companies: Repository<Company>,
    private readonly earnings: EarningsService,
    private readonly accessScope: AccessScopeService,
  ) {}

  /**
   * Admin landing page: every company with its object/device counters and
   * current-month money. Counters come from one grouped query and the money
   * from one more, so the page cost does not grow with company count.
   */
  async summaryList(
    user: AuthenticatedUser,
    query: PaginationQueryDto,
  ): Promise<PaginatedResult<CompanySummaryDto>> {
    const companyFilter = this.accessScope.companyFilter(user);

    const qb = this.companies
      .createQueryBuilder('company')
      .loadRelationCountAndMap('company.siteCount', 'company.sites')
      .loadRelationCountAndMap('company.deviceCount', 'company.devices')
      .skip(query.skip)
      .take(query.limit);

    if (companyFilter) qb.andWhere('company.id = :companyFilter', { companyFilter });
    if (query.search) {
      qb.andWhere(
        '(company.name ILIKE :search OR company.identificationCode ILIKE :search OR company.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    qb.orderBy(SORTABLE[query.sortBy ?? 'createdAt'] ?? SORTABLE.createdAt, query.sortOrder);

    const [rows, total] = await qb.getManyAndCount();
    const money = await this.earnings.totalsByCompany(
      rows.map((r) => r.id),
      { months: 1 },
    );

    const items: CompanySummaryDto[] = rows.map((row) => {
      const withCounts = row as Company & { siteCount?: number; deviceCount?: number };
      const totals = money.get(row.id);
      return {
        id: row.id,
        name: row.name,
        identificationCode: row.identificationCode,
        email: row.email,
        phone: row.phone,
        legalAddress: row.legalAddress,
        bankAccount: row.bankAccount,
        isActive: row.isActive,
        siteCount: withCounts.siteCount ?? 0,
        deviceCount: withCounts.deviceCount ?? 0,
        monthEarnings: totals?.total ?? 0,
        monthCommission: totals?.commission ?? 0,
        createdAt: row.createdAt,
      };
    });

    return new PaginatedResult(items, total, query.page, query.limit);
  }

  async findOneScoped(user: AuthenticatedUser, id: string): Promise<Company> {
    const company = await this.findById(id);
    this.accessScope.assertCompanyAccess(user, company.id);
    return company;
  }

  async findById(id: string): Promise<Company> {
    const company = await this.companies.findOne({ where: { id } });
    if (!company) throw new NotFoundException(`Company ${id} not found`);
    return company;
  }

  /** Used by other modules to validate a companyId before writing to it. */
  async assertExists(id: string): Promise<void> {
    if (!(await this.companies.countBy({ id }))) {
      throw new NotFoundException(`Company ${id} not found`);
    }
  }

  async create(dto: CreateCompanyDto): Promise<Company> {
    const company = this.companies.create(dto);
    return this.companies.save(company);
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findById(id);
    Object.assign(company, dto);
    return this.companies.save(company);
  }

  /**
   * Soft delete: payment history must survive, and the sites/devices rows
   * stay reachable for audits.
   */
  async remove(id: string): Promise<void> {
    const company = await this.findById(id);
    await this.companies.softRemove(company);
  }

  async findByIdentificationCode(code: string): Promise<Company | null> {
    return this.companies.findOne({ where: { identificationCode: ILike(code) } });
  }
}
