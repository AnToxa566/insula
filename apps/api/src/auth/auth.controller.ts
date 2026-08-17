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
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOperation,
  ApiResponse,
  ApiUnauthorizedResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser, Public } from '@insula/auth';
import type { AccessTokenPayload, AuthUser } from '@insula/contracts';

import { AuthService } from './auth.service.js';
import { AuthResponseDto, AuthUserDto } from './dto/auth-response.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { LogoutDto } from './dto/logout.dto.js';
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

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Return the current user and their profile' })
  @ApiResponse({ status: HttpStatus.OK, type: AuthUserDto })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired access token' })
  me(@CurrentUser() user: AccessTokenPayload): Promise<AuthUser> {
    return this.authService.getCurrentUser(user.sub);
  }
}
