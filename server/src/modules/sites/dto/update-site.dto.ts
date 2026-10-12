import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateSiteDto } from './create-site.dto';

/** A site never moves to another company - that would rewrite its history. */
export class UpdateSiteDto extends PartialType(OmitType(CreateSiteDto, ['companyId'] as const)) {}
