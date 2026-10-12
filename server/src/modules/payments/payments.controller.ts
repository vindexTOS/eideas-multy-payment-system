import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Auth } from '../../shared/decorators/api-auth.decorator';
import { CurrentUser } from '../../shared/decorators/current-user.decorator';
import { PaginatedResult } from '../../shared/dto/paginated-result.dto';
import { ALL_ROLES, UserRole } from '../../shared/enums/user-role.enum';
import { AuthenticatedUser } from '../../shared/interfaces/authenticated-user.interface';
import { ListPaymentsQueryDto } from './dto/list-payments-query.dto';
import { RecordPaymentDto } from './dto/record-payment.dto';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get()
  @Auth(...ALL_ROLES)
  @ApiOperation({ summary: 'Payment ledger, scoped to the caller' })
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListPaymentsQueryDto,
  ): Promise<PaginatedResult<Payment>> {
    return this.payments.list(user, query);
  }

  @Get(':id')
  @Auth(...ALL_ROLES)
  findOne(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<Payment> {
    return this.payments.findOneScoped(user, id);
  }

  @Post()
  @Auth(UserRole.ADMIN)
  @ApiOperation({
    summary: 'Record a payment by hand',
    description:
      'For corrections and for testing the earnings pipeline before the device protocol is documented. The commission is computed from the device tariffs exactly as it is for terminal payments.',
  })
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: RecordPaymentDto): Promise<Payment> {
    return this.payments.createManual(user, dto);
  }

  @Patch(':id/reverse')
  @Auth(UserRole.ADMIN)
  @ApiOperation({ summary: 'Reverse a payment (kept on record, dropped from earnings)' })
  reverse(@Param('id', ParseUUIDPipe) id: string): Promise<Payment> {
    return this.payments.reverse(id);
  }
}
