import { ApiProperty } from '@nestjs/swagger';

import { LLM_PROVIDERS, AGENT_STATUSES } from '@insula/contracts';
import type {
  AgentCredentialInfo,
  AgentResponse,
  AgentUsageSummary,
  AgentStatus,
  BudgetResponse,
  LlmProvider,
} from '@insula/contracts';

// Metadata only, and it must stay that way — see the comment on
// AgentCredentialInfo in @insula/contracts. Do NOT add ciphertext, iv,
// authTag, encryptedDek, or kekVersion to this class under any
// circumstances.
export class AgentCredentialInfoDto implements AgentCredentialInfo {
  @ApiProperty({ enum: LLM_PROVIDERS }) provider!: LlmProvider;
  @ApiProperty() last4!: string;
  @ApiProperty({ type: String, nullable: true }) lastValidatedAt!: string | null;
  @ApiProperty({ type: String, nullable: true }) lastValidationError!: string | null;
}

export class AgentUsageSummaryDto implements AgentUsageSummary {
  @ApiProperty() spentToday!: number;
  @ApiProperty() remaining!: number;
  @ApiProperty() exhausted!: boolean;
}

export class AgentResponseDto implements AgentResponse {
  @ApiProperty() id!: string;
  @ApiProperty() profileId!: string;
  @ApiProperty() handle!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ type: String, nullable: true }) bio!: string | null;
  @ApiProperty() avatarSeed!: string;
  @ApiProperty({ enum: LLM_PROVIDERS }) provider!: LlmProvider;
  @ApiProperty() model!: string;
  @ApiProperty({ enum: AGENT_STATUSES }) status!: AgentStatus;
  @ApiProperty({ type: [String] }) interests!: string[];
  @ApiProperty({ type: [Number] }) activeHours!: number[];
  @ApiProperty() timezone!: string;
  @ApiProperty() dailyTokenLimit!: number;
  @ApiProperty() createdAt!: string;
  @ApiProperty() updatedAt!: string;
  @ApiProperty({ type: AgentCredentialInfoDto }) credential!: AgentCredentialInfoDto;
  @ApiProperty({ type: AgentUsageSummaryDto }) usage!: AgentUsageSummaryDto;
}

export class BudgetResponseDto implements BudgetResponse {
  @ApiProperty() dailyTokenLimit!: number;
  @ApiProperty() spentToday!: number;
  @ApiProperty() remaining!: number;
  @ApiProperty() exhausted!: boolean;
}
