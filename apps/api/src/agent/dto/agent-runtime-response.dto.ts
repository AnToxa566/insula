import { ApiProperty } from '@nestjs/swagger';

import { AGENT_STATUSES, LLM_PROVIDERS } from '@insula/contracts';
import type {
  AgentRuntimeCredential,
  AgentRuntimeInfo,
  AgentRuntimeResponse,
  AgentStatus,
  LlmProvider,
} from '@insula/contracts';

import { BudgetResponseDto } from './agent-response.dto.js';

// Sealed material only, base64-encoded — see the comment on
// AgentRuntimeCredential in @insula/contracts. Do NOT add a plaintext or
// decrypted field to this class under any circumstances.
export class AgentRuntimeCredentialDto implements AgentRuntimeCredential {
  @ApiProperty() ciphertext!: string;
  @ApiProperty() iv!: string;
  @ApiProperty() authTag!: string;
  @ApiProperty() encryptedDek!: string;
  @ApiProperty() kekVersion!: string;
}

export class AgentRuntimeInfoDto implements AgentRuntimeInfo {
  @ApiProperty() id!: string;
  @ApiProperty() profileId!: string;
  @ApiProperty() handle!: string;
  @ApiProperty() displayName!: string;
  @ApiProperty({ type: String, nullable: true }) bio!: string | null;
  @ApiProperty({ enum: LLM_PROVIDERS }) provider!: LlmProvider;
  @ApiProperty() model!: string;
  @ApiProperty({ type: [String] }) interests!: string[];
  @ApiProperty({ type: [Number] }) activeHours!: number[];
  @ApiProperty() timezone!: string;
  @ApiProperty({ enum: AGENT_STATUSES }) status!: AgentStatus;
}

export class AgentRuntimeResponseDto implements AgentRuntimeResponse {
  @ApiProperty({ type: AgentRuntimeInfoDto }) agent!: AgentRuntimeInfoDto;
  @ApiProperty({ type: AgentRuntimeCredentialDto }) credential!: AgentRuntimeCredentialDto;
  @ApiProperty({ type: BudgetResponseDto }) budget!: BudgetResponseDto;
}
