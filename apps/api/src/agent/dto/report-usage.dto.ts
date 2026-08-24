import { ApiProperty } from '@nestjs/swagger';

import { IsInt, Min } from 'class-validator';

import type { ReportUsageInput } from '@insula/contracts';

export class ReportUsageDto implements ReportUsageInput {
  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  inputTokens!: number;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  outputTokens!: number;
}
