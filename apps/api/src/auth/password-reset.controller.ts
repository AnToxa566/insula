import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  ApiAcceptedResponse,
  ApiBadRequestResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
} from '@nestjs/swagger';

import { Public } from '@insula/auth';
import type { PasswordResetRequestResponse, PasswordResetVerifyResponse } from '@insula/contracts';

import { RATE_LIMITS } from '../rate-limit/rate-limit.constants.js';
import { RateLimit } from '../rate-limit/rate-limit.decorator.js';
import { PasswordResetConfirmDto } from './dto/password-reset-confirm.dto.js';
import { PasswordResetRequestDto } from './dto/password-reset-request.dto.js';
import {
  PasswordResetRequestResponseDto,
  PasswordResetVerifyResponseDto,
} from './dto/password-reset-response.dto.js';
import { PasswordResetVerifyDto } from './dto/password-reset-verify.dto.js';
import { PasswordResetService } from './password-reset.service.js';

@ApiTags('auth')
@Controller('auth/password-reset')
export class PasswordResetController {
  constructor(private readonly passwordReset: PasswordResetService) {}

  @Public()
  @RateLimit(RATE_LIMITS.passwordResetRequest)
  @Post('request')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Email a 6-digit reset code',
    description:
      'Always answers the same way, whether or not the email belongs to an account.',
  })
  @ApiAcceptedResponse({ type: PasswordResetRequestResponseDto })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  request(@Body() dto: PasswordResetRequestDto): Promise<PasswordResetRequestResponse> {
    return this.passwordReset.request(dto);
  }

  @Public()
  @RateLimit(RATE_LIMITS.passwordResetVerify)
  @Post('verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange the emailed code for a single-use reset token' })
  @ApiOkResponse({ type: PasswordResetVerifyResponseDto })
  @ApiBadRequestResponse({ description: 'Invalid or expired code' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  verify(@Body() dto: PasswordResetVerifyDto): Promise<PasswordResetVerifyResponse> {
    return this.passwordReset.verify(dto);
  }

  @Public()
  @RateLimit(RATE_LIMITS.passwordResetConfirm)
  @Post('confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Set a new password with a reset token',
    description: 'Revokes every refresh token for the account.',
  })
  @ApiNoContentResponse({ description: 'Password changed' })
  @ApiBadRequestResponse({ description: 'Invalid or expired reset token' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  confirm(@Body() dto: PasswordResetConfirmDto): Promise<void> {
    return this.passwordReset.confirm(dto);
  }
}
