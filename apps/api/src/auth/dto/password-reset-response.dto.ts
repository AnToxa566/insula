import { ApiProperty } from '@nestjs/swagger';

import type {
  PasswordResetRequestResponse,
  PasswordResetVerifyResponse,
} from '@insula/contracts';

// Swagger-only response shapes — see auth-response.dto.ts.
export class PasswordResetRequestResponseDto implements PasswordResetRequestResponse {
  @ApiProperty({
    example: 'If an account exists for this email, a verification code has been sent.',
  })
  message!: string;
}

export class PasswordResetVerifyResponseDto implements PasswordResetVerifyResponse {
  @ApiProperty({ description: 'Single-use, valid for 15 minutes' })
  resetToken!: string;
}
