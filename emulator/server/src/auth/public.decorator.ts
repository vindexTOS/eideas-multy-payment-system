import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC = 'isPublic';

/** Opt a route out of the super-admin guard. Only login and health use it. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
