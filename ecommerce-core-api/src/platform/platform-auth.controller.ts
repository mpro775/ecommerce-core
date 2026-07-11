import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { getRequestContext } from '../common/utils/request-context.util';
import { CurrentPlatformUser } from './decorators/current-platform-user.decorator';
import { PlatformLoginDto } from './dto/platform-login.dto';
import { PlatformMfaDisableDto } from './dto/platform-mfa-disable.dto';
import { PlatformMfaVerifyDto } from './dto/platform-mfa-verify.dto';
import { PlatformRefreshTokenDto } from './dto/platform-refresh-token.dto';
import { PlatformStepUpDto } from './dto/platform-step-up.dto';
import { PlatformAccessTokenGuard } from './guards/platform-access-token.guard';
import type { PlatformAuthResult } from './interfaces/platform-auth-result.interface';
import type { PlatformAdminUser } from './interfaces/platform-admin-user.interface';
import { PlatformAuthService } from './platform-auth.service';

@ApiTags('platform-auth')
@Controller('platform/auth')
export class PlatformAuthController {
  constructor(private readonly platformAuthService: PlatformAuthService) {}

  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Authenticate platform admin and issue tokens' })
  async login(
    @Body() body: PlatformLoginDto,
    @Req() request: Request,
  ): Promise<PlatformAuthResult> {
    return this.platformAuthService.login(body, getRequestContext(request));
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({
    description: 'Rotate platform admin refresh token and issue a new access token',
  })
  async refresh(
    @Body() body: PlatformRefreshTokenDto,
    @Req() request: Request,
  ): Promise<PlatformAuthResult> {
    return this.platformAuthService.refresh(body, getRequestContext(request));
  }

  @Get('sessions')
  @ApiBearerAuth()
  @UseGuards(PlatformAccessTokenGuard)
  @ApiOkResponse({ description: 'List active platform admin sessions' })
  async listSessions(@CurrentPlatformUser() currentUser: PlatformAdminUser) {
    return this.platformAuthService.listSessions(currentUser);
  }

  @Delete('sessions/:id')
  @ApiBearerAuth()
  @UseGuards(PlatformAccessTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Param('id') sessionId: string,
    @Req() request: Request,
  ): Promise<void> {
    await this.platformAuthService.revokeSession(
      currentUser,
      sessionId,
      getRequestContext(request),
    );
  }

  @Delete('sessions')
  @ApiBearerAuth()
  @UseGuards(PlatformAccessTokenGuard)
  @HttpCode(HttpStatus.OK)
  async revokeOtherSessions(
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ): Promise<{ revokedCount: number }> {
    return this.platformAuthService.revokeOtherSessions(currentUser, getRequestContext(request));
  }

  @Post('logout')
  @UseGuards(PlatformAccessTokenGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Req() request: Request,
  ): Promise<void> {
    await this.platformAuthService.logout(currentUser, getRequestContext(request));
  }

  @Get('me')
  @ApiBearerAuth()
  @UseGuards(PlatformAccessTokenGuard)
  @ApiOkResponse({ description: 'Get authenticated platform admin profile' })
  async me(@CurrentPlatformUser() currentUser: PlatformAdminUser): Promise<PlatformAdminUser> {
    return this.platformAuthService.me(currentUser);
  }

  @Post('mfa/setup')
  @ApiBearerAuth()
  @UseGuards(PlatformAccessTokenGuard)
  @ApiOkResponse({ description: 'Start MFA setup and return TOTP secret + otpauth URL' })
  async beginMfaSetup(@CurrentPlatformUser() currentUser: PlatformAdminUser) {
    return this.platformAuthService.beginMfaSetup(currentUser);
  }

  @Post('mfa/verify')
  @ApiBearerAuth()
  @UseGuards(PlatformAccessTokenGuard)
  @ApiOkResponse({ description: 'Verify TOTP code and enable MFA' })
  async verifyMfa(
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Body() body: PlatformMfaVerifyDto,
    @Req() request: Request,
  ) {
    return this.platformAuthService.verifyAndEnableMfa(
      currentUser,
      body,
      getRequestContext(request),
    );
  }

  @Post('mfa/disable')
  @ApiBearerAuth()
  @UseGuards(PlatformAccessTokenGuard)
  @ApiOkResponse({ description: 'Disable MFA after password + OTP/backup verification' })
  async disableMfa(
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Body() body: PlatformMfaDisableDto,
    @Req() request: Request,
  ) {
    return this.platformAuthService.disableMfa(currentUser, body, getRequestContext(request));
  }

  @Post('step-up')
  @ApiBearerAuth()
  @UseGuards(PlatformAccessTokenGuard)
  @ApiOkResponse({ description: 'Issue short-lived step-up token for sensitive actions' })
  async stepUp(
    @CurrentPlatformUser() currentUser: PlatformAdminUser,
    @Body() body: PlatformStepUpDto,
    @Req() request: Request,
  ) {
    return this.platformAuthService.stepUp(currentUser, body, getRequestContext(request));
  }
}
