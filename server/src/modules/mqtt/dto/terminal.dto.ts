import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  TerminalConfig,
  TerminalConfigKey,
  VID,
  VID_CATALOGUE,
  VidDefinition,
  hexVid,
} from '../protocol/terminal-protocol';

const definitionOf = (vid: number): VidDefinition => VID_CATALOGUE.get(vid)!;

/** Range, default and label come from the protocol catalogue, so the API cannot drift from it. */
const ConfigValue = (key: TerminalConfigKey) => {
  const d = [...VID_CATALOGUE.values()].find((c) => c.kind === 'config' && c.key === key)!;
  return applyDecorators(
    ApiPropertyOptional({
      description: `${d.label} - VID ${hexVid(d.vid)}`,
      minimum: d.min,
      maximum: d.max,
      default: d.default,
    }),
    IsOptional(),
    IsInt(),
    Min(d.min!),
    Max(d.max!),
  );
};

/** Only the keys sent change; the rest keep their saved (or default) value. */
export class UpdateTerminalConfigDto implements Partial<TerminalConfig> {
  @ConfigValue('countryCode') countryCode?: number;
  @ConfigValue('scaleFactor') scaleFactor?: number;
  @ConfigValue('pulseFrequency') pulseFrequency?: number;
  @ConfigValue('pulseDutyCycle') pulseDutyCycle?: number;
  @ConfigValue('lcdBrightness') lcdBrightness?: number;
  @ConfigValue('advBoardBrightness') advBoardBrightness?: number;
  @ConfigValue('rs485ScanCount') rs485ScanCount?: number;
  @ConfigValue('operationMode') operationMode?: number;
}

const SET_AMOUNT = definitionOf(VID.SET_AMOUNT);

export class SetAmountDto {
  @ApiProperty({
    description: 'Amount the terminal should charge, in tetri (100 = 1 GEL) - VID 0x50',
    minimum: SET_AMOUNT.min,
    maximum: SET_AMOUNT.max,
    example: 500,
  })
  @IsInt()
  @Min(SET_AMOUNT.min!)
  @Max(SET_AMOUNT.max!)
  amountTetri: number;
}
