import { ApiProperty } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() pageCount: number;
}

export class PaginatedResult<T> {
  @ApiProperty({ isArray: true })
  items: T[];

  @ApiProperty({ type: PaginationMeta })
  meta: PaginationMeta;

  constructor(items: T[], total: number, page: number, limit: number) {
    this.items = items;
    this.meta = {
      total,
      page,
      limit,
      pageCount: limit > 0 ? Math.ceil(total / limit) : 0,
    };
  }
}

export const paginate = <T>(
  [items, total]: [T[], number],
  query: { page: number; limit: number },
): PaginatedResult<T> => new PaginatedResult(items, total, query.page, query.limit);
