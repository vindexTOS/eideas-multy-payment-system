import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { OPERATION_VIDS, VID } from '../protocol/terminal-protocol';

export class CreateDeviceDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name: string;

  /** Appended to EMULATOR_UID_PREFIX. Random when omitted. */
  @IsOptional()
  @Matches(/^[A-Za-z0-9_-]{1,40}$/, { message: 'uidSuffix may hold A-Z a-z 0-9 _ - (1-40)' })
  uidSuffix?: string;

  @IsOptional()
  @IsBoolean()
  autoConnect?: boolean;
}

export class BehaviourDto {
  @IsOptional()
  @IsIn(['auto', 'manual'])
  mode?: 'auto' | 'manual';

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(255)
  paymentResult?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(255)
  reconciliationResult?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(60_000)
  responseDelayMs?: number;

  /** 0 turns heartbeats off. */
  @IsOptional()
  @IsInt()
  @ValidateIf((_, value) => value !== 0)
  @Min(5)
  @Max(3600)
  heartbeatSeconds?: number;
}

export class UpdateDeviceDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => BehaviourDto)
  behaviour?: BehaviourDto;
}

export class SendPaymentDto {
  @IsInt()
  @Min(1)
  @Max(10000)
  amountTetri: number;

  @IsInt()
  @Min(0)
  @Max(255)
  result: number;
}

export class SendStatusDto {
  @IsIn(['idle', 'busy'])
  status: 'idle' | 'busy';
}

export class SendOperationDto {
  @IsIn(OPERATION_VIDS.filter((vid) => vid !== VID.PAYMENT), {
    message: 'vid must be an operation result VID (0x84, 0x95, 0x9A, 0x9D, 0xB5, 0xBB)',
  })
  vid: number;

  @IsInt()
  @Min(0)
  @Max(255)
  result: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10000)
  amountTetri?: number;
}

export class SendRawDto {
  @IsString()
  @MaxLength(1024)
  @Matches(/^(\s*[0-9a-fA-F]{2})+\s*$/, {
    message: 'hex must be whole bytes, e.g. "6a e8 77 ce 82 01 00"',
  })
  hex: string;
}

export class CompleteDto {
  @IsInt()
  @Min(0)
  @Max(255)
  result: number;
}
