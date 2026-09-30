import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Headers,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { CurrentUser, Public } from '@insula/auth';
import type { AccessTokenPayload, AuthUser, ChangePasswordResponse } from '@insula/contracts';

import { RATE_LIMITS } from '../rate-limit/rate-limit.constants.js';
import { RateLimit } from '../rate-limit/rate-limit.decorator.js';
import { AuthService } from './auth.service.js';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto.js';
import { ChangePasswordDto } from './dto/change-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { LogoutDto } from './dto/logout.dto.js';
import { QuickRegisterDto } from './dto/quick-register.dto.js';
import { RefreshDto } from './dto/refresh.dto.js';
import { RegisterDto } from './dto/register.dto.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a user account and its profile' })
  @ApiResponse({ status: HttpStatus.CREATED, type: AuthResponseDto })
  @ApiConflictResponse({ description: 'Email or handle already in use' })
  register(@Body() dto: RegisterDto, @Headers('user-agent') userAgent?: string) {
    return this.authService.register(dto, userAgent);
  }

  @Public()
  @Post('register/quick')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create an account from an email alone',
    description: 'Handle, display name, and password are generated server-side.',
  })
  @ApiResponse({ status: HttpStatus.CREATED, type: AuthResponseDto })
  @ApiConflictResponse({ description: 'Email already in use' })
  registerQuick(@Body() dto: QuickRegisterDto, @Headers('user-agent') userAgent?: string) {
    return this.authService.registerQuick(dto, userAgent);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Exchange credentials for an access/refresh token pair' })
  @ApiResponse({ status: HttpStatus.OK, type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password' })
  login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string) {
    return this.authService.login(dto, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token for a new access/refresh pair' })
  @ApiResponse({ status: HttpStatus.OK, type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid, expired, or reused refresh token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Revoke a single refresh token' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT, description: 'Idempotent — always succeeds' })
  logout(@Body() dto: LogoutDto): Promise<void> {
    return this.authService.logout(dto);
  }

  @Post('change-password')
  @RateLimit(RATE_LIMITS.changePassword)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Change the password of the signed-in user',
    description:
      'Revokes every refresh token for the account and returns a fresh access/refresh pair for this session.',
  })
  @ApiResponse({ status: HttpStatus.OK, type: AuthResponseDto })
  @ApiBadRequestResponse({ description: 'Current password is incorrect, or new equals current' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired access token' })
  @ApiConflictResponse({ description: 'Password was changed concurrently' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded' })
  changePassword(
    @CurrentUser() user: AccessTokenPayload,
    @Body() dto: ChangePasswordDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<ChangePasswordResponse> {
    return this.authService.changePassword(user.sub, dto, userAgent);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the current user and their profile' })
  @ApiResponse({ status: HttpStatus.OK, type: AuthUserDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired access token' })
  me(@CurrentUser() user: AccessTokenPayload): Promise<AuthUser> {
    return this.authService.getCurrentUser(user.sub);
  }
}
