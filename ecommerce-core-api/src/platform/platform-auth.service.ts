import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import type { StringValue } from 'ms';
import { randomBytes } from 'node:crypto';
import { AuditService } from '../audit/audit.service';
import type { RequestContextData } from '../common/utils/request-context.util';
import { parseRefreshToken } from '../auth/utils/refresh-token.util';
import type { PlatformLoginDto } from './dto/platform-login.dto';
import type { PlatformMfaDisableDto } from './dto/platform-mfa-disable.dto';
import type { PlatformMfaVerifyDto } from './dto/platform-mfa-verify.dto';
import type { PlatformRefreshTokenDto } from './dto/platform-refresh-token.dto';
import type { PlatformStepUpDto } from './dto/platform-step-up.dto';
import type { PlatformAuthResult } from './interfaces/platform-auth-result.interface';
import type { PlatformAccessTokenPayload } from './interfaces/platform-access-token-payload.interface';
import type { PlatformAdminUser } from './interfaces/platform-admin-user.interface';
import { PlatformAuthRepository } from './platform-auth.repository';
import {
  buildOtpAuthUrl,
  generateBackupCodes,
  generateTotpSecret,
  verifyTotpCode,
} from './utils/totp.util';

@Injectable()
export class PlatformAuthService {
  constructor(
    private readonly platformAuthRepository: PlatformAuthRepository,
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly auditService: AuditService,
  ) {}

  async login(input: PlatformLoginDto, context: RequestContextData): Promise<PlatformAuthResult> {
    const admin = await this.platformAuthRepository.findAdminByEmail(
      input.email.trim().toLowerCase(),
    );

    if (admin?.locked_until && admin.locked_until.getTime() > Date.now()) {
      await this.logPlatformAuthFailure('platform.auth.login_failed', admin.id, context, {
        email: input.email.trim().toLowerCase(),
        reason: 'locked',
      });
      throw new UnauthorizedException('Invalid platform admin credentials');
    }

    const valid = admin && (await argon2.verify(admin.password_hash, input.password));
    if (!admin || !valid || admin.status !== 'active') {
      if (admin && admin.status === 'active') {
        await this.platformAuthRepository.recordFailedLogin(
          admin.id,
          this.configService.get<number>('AUTH_MAX_ATTEMPTS', 5),
          this.configService.get<number>('AUTH_LOCKOUT_DURATION_MS', 900_000),
        );
      }
      await this.logPlatformAuthFailure('platform.auth.login_failed', admin?.id, context, {
        email: input.email.trim().toLowerCase(),
        reason: !admin
          ? 'unknown_admin'
          : admin.status !== 'active'
            ? 'inactive'
            : 'invalid_password',
      });
      throw new UnauthorizedException('Invalid platform admin credentials');
    }

    await this.assertSecurityPolicies(admin, context);
    if (admin.mfa_enabled) {
      const otpCode = input.otpCode?.trim();
      if (!otpCode || !admin.mfa_secret || !verifyTotpCode(admin.mfa_secret, otpCode)) {
        await this.platformAuthRepository.recordFailedLogin(
          admin.id,
          this.configService.get<number>('AUTH_MAX_ATTEMPTS', 5),
          this.configService.get<number>('AUTH_LOCKOUT_DURATION_MS', 900_000),
        );
        await this.logPlatformAuthFailure('platform.auth.login_failed', admin.id, context, {
          email: input.email.trim().toLowerCase(),
          reason: 'invalid_mfa',
        });
        throw new UnauthorizedException('Invalid platform admin credentials');
      }
    }

    await this.platformAuthRepository.touchAdminLastLogin(admin.id);
    const result = await this.issueTokens(admin.id, context);

    await this.auditService.log({
      action: 'platform.auth.login_succeeded',
      storeId: null,
      storeUserId: null,
      targetType: 'platform_admin_user',
      targetId: admin.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
      },
    });

    return result;
  }

  async listSessions(currentUser: PlatformAdminUser): Promise<
    Array<{
      id: string;
      ipAddress: string | null;
      userAgent: string | null;
      createdAt: string;
      lastSeenAt: string;
      expiresAt: string;
      isCurrent: boolean;
    }>
  > {
    const sessions = await this.platformAuthRepository.listActiveSessionsByAdmin(currentUser.id);
    return sessions.map((session) => ({
      id: session.id,
      ipAddress: session.ip_address,
      userAgent: session.user_agent,
      createdAt: session.created_at.toISOString(),
      lastSeenAt: session.last_seen_at.toISOString(),
      expiresAt: session.expires_at.toISOString(),
      isCurrent: session.id === currentUser.sessionId,
    }));
  }

  async revokeSession(
    currentUser: PlatformAdminUser,
    sessionId: string,
    context: RequestContextData,
  ): Promise<void> {
    await this.platformAuthRepository.revokeAdminSession(currentUser.id, sessionId);
    await this.auditService.log({
      action: 'platform.auth.session_revoked',
      storeId: null,
      storeUserId: null,
      targetType: 'platform_admin_session',
      targetId: sessionId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        actorAdminId: currentUser.id,
        requestId: context.requestId,
      },
    });
  }

  async revokeOtherSessions(
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ): Promise<{ revokedCount: number }> {
    const revokedCount = await this.platformAuthRepository.revokeOtherAdminSessions(
      currentUser.id,
      currentUser.sessionId,
    );
    await this.auditService.log({
      action: 'platform.auth.other_sessions_revoked',
      storeId: null,
      storeUserId: null,
      targetType: 'platform_admin_user',
      targetId: currentUser.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        revokedCount,
      },
    });

    return { revokedCount };
  }

  async refresh(
    input: PlatformRefreshTokenDto,
    context: RequestContextData,
  ): Promise<PlatformAuthResult> {
    const parsed = parseRefreshToken(input.refreshToken);
    if (!parsed) {
      throw new UnauthorizedException('Invalid refresh token format');
    }

    const session = await this.platformAuthRepository.findSessionById(parsed.sessionId);
    if (!session || session.revoked_at || session.expires_at.getTime() <= Date.now()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    const validSecret = await argon2.verify(session.refresh_token_hash, parsed.secret);
    if (!validSecret) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const admin = await this.platformAuthRepository.findAdminById(session.admin_user_id);
    if (!admin || admin.status !== 'active') {
      throw new UnauthorizedException('Platform admin account is not active');
    }

    await this.assertSecurityPolicies(admin, context);

    const result = await this.issueTokens(admin.id, context, session.id);

    await this.auditService.log({
      action: 'platform.auth.refresh_succeeded',
      storeId: null,
      storeUserId: null,
      targetType: 'platform_admin_user',
      targetId: admin.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
      },
    });

    return result;
  }

  async logout(currentUser: PlatformAdminUser, context: RequestContextData): Promise<void> {
    await this.platformAuthRepository.revokeSession(currentUser.sessionId);

    await this.auditService.log({
      action: 'platform.auth.logout',
      storeId: null,
      storeUserId: null,
      targetType: 'platform_admin_user',
      targetId: currentUser.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
      },
    });
  }

  async me(currentUser: PlatformAdminUser): Promise<PlatformAdminUser> {
    const admin = await this.platformAuthRepository.findAdminById(currentUser.id);
    if (!admin || admin.status !== 'active') {
      throw new UnauthorizedException('Platform admin account is not active');
    }

    const permissions = await this.platformAuthRepository.listAdminPermissions(admin.id);
    const roleCodes = await this.platformAuthRepository.listAdminRoleCodes(admin.id);

    return {
      id: admin.id,
      email: admin.email,
      fullName: admin.full_name,
      status: admin.status,
      mfaEnabled: admin.mfa_enabled,
      permissions,
      roleCodes,
      sessionId: currentUser.sessionId,
    };
  }

  async beginMfaSetup(currentUser: PlatformAdminUser): Promise<{
    secret: string;
    otpAuthUrl: string;
  }> {
    const admin = await this.platformAuthRepository.findAdminById(currentUser.id);
    if (!admin || admin.status !== 'active') {
      throw new UnauthorizedException('Platform admin account is not active');
    }

    const secret = generateTotpSecret();
    return {
      secret,
      otpAuthUrl: buildOtpAuthUrl(admin.email, secret, 'Kaleem Platform'),
    };
  }

  async verifyAndEnableMfa(
    currentUser: PlatformAdminUser,
    input: PlatformMfaVerifyDto,
    context: RequestContextData,
  ): Promise<{ enabled: boolean; backupCodes: string[] }> {
    const admin = await this.platformAuthRepository.findAdminById(currentUser.id);
    if (!admin || admin.status !== 'active') {
      throw new UnauthorizedException('Platform admin account is not active');
    }
    if (!verifyTotpCode(input.secret, input.code)) {
      await this.logPlatformAuthFailure(
        'platform.auth.mfa_verify_failed',
        currentUser.id,
        context,
        {
          reason: 'invalid_code',
        },
      );
      throw new UnauthorizedException('Invalid MFA verification code');
    }

    const backupCodes = generateBackupCodes();
    const backupHashes = await Promise.all(backupCodes.map((code) => argon2.hash(code)));

    await this.platformAuthRepository.updateAdminMfa({
      adminId: currentUser.id,
      mfaEnabled: true,
      mfaSecret: input.secret,
      mfaBackupCodes: backupHashes,
    });

    await this.auditService.log({
      action: 'platform.auth.mfa_enabled',
      storeId: null,
      storeUserId: null,
      targetType: 'platform_admin_user',
      targetId: currentUser.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
      },
    });

    return {
      enabled: true,
      backupCodes,
    };
  }

  async disableMfa(
    currentUser: PlatformAdminUser,
    input: PlatformMfaDisableDto,
    context: RequestContextData,
  ): Promise<{ enabled: boolean }> {
    const admin = await this.platformAuthRepository.findAdminById(currentUser.id);
    if (!admin || admin.status !== 'active') {
      throw new UnauthorizedException('Platform admin account is not active');
    }
    const validPassword = await argon2.verify(admin.password_hash, input.password);
    if (!validPassword) {
      await this.logPlatformAuthFailure(
        'platform.auth.mfa_disable_failed',
        currentUser.id,
        context,
        {
          reason: 'invalid_password',
        },
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    if (admin.mfa_enabled) {
      const mfaSatisfied =
        (input.code && admin.mfa_secret ? verifyTotpCode(admin.mfa_secret, input.code) : false) ||
        (await this.consumeBackupCode(admin.id, input.backupCode, admin.mfa_backup_codes));
      if (!mfaSatisfied) {
        await this.logPlatformAuthFailure(
          'platform.auth.mfa_disable_failed',
          currentUser.id,
          context,
          {
            reason: 'mfa_required',
          },
        );
        throw new UnauthorizedException('MFA verification is required');
      }
    }

    await this.platformAuthRepository.updateAdminMfa({
      adminId: currentUser.id,
      mfaEnabled: false,
      mfaSecret: null,
      mfaBackupCodes: [],
    });

    await this.auditService.log({
      action: 'platform.auth.mfa_disabled',
      storeId: null,
      storeUserId: null,
      targetType: 'platform_admin_user',
      targetId: currentUser.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
      },
    });

    return { enabled: false };
  }

  async stepUp(
    currentUser: PlatformAdminUser,
    input: PlatformStepUpDto,
    context: RequestContextData,
  ): Promise<{ stepUpToken: string; expiresInSeconds: number }> {
    const admin = await this.platformAuthRepository.findAdminById(currentUser.id);
    if (!admin || admin.status !== 'active') {
      throw new UnauthorizedException('Platform admin account is not active');
    }

    const validPassword = await argon2.verify(admin.password_hash, input.password);
    if (!validPassword) {
      await this.logPlatformAuthFailure('platform.auth.step_up_failed', currentUser.id, context, {
        reason: 'invalid_password',
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (admin.mfa_enabled) {
      const otpCode = input.otpCode?.trim();
      if (!otpCode || !admin.mfa_secret || !verifyTotpCode(admin.mfa_secret, otpCode)) {
        await this.logPlatformAuthFailure('platform.auth.step_up_failed', currentUser.id, context, {
          reason: 'invalid_mfa',
        });
        throw new UnauthorizedException('MFA code is required or invalid');
      }
    }

    const secret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const expiresInSeconds = 300;
    const stepUpToken = await this.jwtService.signAsync(
      {
        sub: currentUser.id,
        sid: currentUser.sessionId,
        kind: 'platform_step_up',
      },
      {
        secret,
        expiresIn: `${expiresInSeconds}s` as StringValue,
      },
    );

    await this.auditService.log({
      action: 'platform.auth.step_up_issued',
      storeId: null,
      storeUserId: null,
      targetType: 'platform_admin_user',
      targetId: currentUser.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        sessionId: currentUser.sessionId,
      },
    });

    return {
      stepUpToken,
      expiresInSeconds,
    };
  }

  private async issueTokens(
    adminId: string,
    context: RequestContextData,
    existingSessionId?: string,
  ): Promise<PlatformAuthResult> {
    const admin = await this.platformAuthRepository.findAdminById(adminId);
    if (!admin || admin.status !== 'active') {
      throw new UnauthorizedException('Platform admin account is not active');
    }

    const permissions = await this.platformAuthRepository.listAdminPermissions(admin.id);
    const roleCodes = await this.platformAuthRepository.listAdminRoleCodes(admin.id);

    const refreshTtlDays = this.configService.get<number>('REFRESH_TOKEN_TTL_DAYS', 30);
    const refreshExpiryDate = new Date(Date.now() + refreshTtlDays * 24 * 60 * 60 * 1000);
    const refreshTokenSecret = randomBytes(32).toString('base64url');
    const refreshTokenHash = await argon2.hash(refreshTokenSecret);

    let sessionId = existingSessionId;
    if (sessionId) {
      const rotated = await this.platformAuthRepository.rotateSession({
        sessionId,
        refreshTokenHash,
        expiresAt: refreshExpiryDate,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      if (!rotated) {
        throw new UnauthorizedException('Unable to refresh platform session');
      }
    } else {
      const created = await this.platformAuthRepository.createSession({
        adminUserId: admin.id,
        refreshTokenHash,
        expiresAt: refreshExpiryDate,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
      });
      sessionId = created.id;
    }

    const payload: PlatformAccessTokenPayload = {
      sub: admin.id,
      sid: sessionId,
      email: admin.email,
      fullName: admin.full_name,
      mfaEnabled: admin.mfa_enabled,
      permissions,
      roleCodes,
      kind: 'platform_admin',
    };

    const jwtSecret = this.configService.getOrThrow<string>('JWT_ACCESS_SECRET');
    const expiresIn = this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as StringValue;

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: jwtSecret,
      expiresIn,
    });

    return {
      accessToken,
      refreshToken: `${sessionId}.${refreshTokenSecret}`,
      user: {
        id: admin.id,
        email: admin.email,
        fullName: admin.full_name,
        status: admin.status,
        mfaEnabled: admin.mfa_enabled,
        permissions,
        roleCodes,
        sessionId,
      },
    };
  }

  private async assertSecurityPolicies(
    admin: {
      id: string;
      trusted_ips: string[];
      trusted_user_agents: string[];
    },
    context: RequestContextData,
  ): Promise<void> {
    const globalIpPolicy = await this.platformAuthRepository.getPlatformSettingValue(
      'platform.security.ip_policy',
    );
    const globalDevicePolicy = await this.platformAuthRepository.getPlatformSettingValue(
      'platform.security.device_policy',
    );

    const requestIp = (context.ipAddress ?? '').trim();
    const requestUa = (context.userAgent ?? '').trim().toLowerCase();

    const localAllowedIps = admin.trusted_ips ?? [];
    if (localAllowedIps.length > 0 && requestIp) {
      const allowed = localAllowedIps.includes(requestIp);
      if (!allowed) {
        throw new UnauthorizedException('IP address is not allowed for this admin');
      }
    }

    const localAllowedUa = (admin.trusted_user_agents ?? []).map((item) => item.toLowerCase());
    if (localAllowedUa.length > 0 && requestUa) {
      const allowed = localAllowedUa.some((token) => requestUa.includes(token));
      if (!allowed) {
        throw new UnauthorizedException('Device is not allowed for this admin');
      }
    }

    const enabledGlobalIp = Boolean(globalIpPolicy?.enabled);
    const globalIps = Array.isArray(globalIpPolicy?.allowedIps)
      ? (globalIpPolicy?.allowedIps as unknown[]).filter(
          (item): item is string => typeof item === 'string',
        )
      : [];
    if (enabledGlobalIp && globalIps.length > 0 && requestIp) {
      if (!globalIps.includes(requestIp)) {
        throw new UnauthorizedException('IP address is blocked by platform policy');
      }
    }

    const enabledGlobalDevice = Boolean(globalDevicePolicy?.enabled);
    const globalUaTokens = Array.isArray(globalDevicePolicy?.allowedUserAgents)
      ? (globalDevicePolicy?.allowedUserAgents as unknown[])
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.toLowerCase())
      : [];
    if (enabledGlobalDevice && globalUaTokens.length > 0 && requestUa) {
      const allowed = globalUaTokens.some((token) => requestUa.includes(token));
      if (!allowed) {
        throw new UnauthorizedException('Device is blocked by platform policy');
      }
    }
  }

  private async consumeBackupCode(
    adminId: string,
    backupCode: string | undefined,
    backupCodeHashes: string[],
  ): Promise<boolean> {
    const normalized = backupCode?.trim().toUpperCase();
    if (!normalized || backupCodeHashes.length === 0) {
      return false;
    }

    for (let i = 0; i < backupCodeHashes.length; i += 1) {
      const hash = backupCodeHashes[i];
      if (!hash) {
        continue;
      }
      if (await argon2.verify(hash, normalized)) {
        const nextHashes = backupCodeHashes.filter((_, idx) => idx !== i);
        await this.platformAuthRepository.updateAdminMfa({
          adminId,
          mfaEnabled: true,
          mfaSecret: (await this.platformAuthRepository.findAdminById(adminId))?.mfa_secret ?? null,
          mfaBackupCodes: nextHashes,
        });
        return true;
      }
    }

    return false;
  }

  private async logPlatformAuthFailure(
    action: string,
    adminId: string | undefined,
    context: RequestContextData,
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.auditService.log({
      action,
      storeId: null,
      storeUserId: null,
      targetType: 'platform_admin_user',
      ...(adminId ? { targetId: adminId } : {}),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        ...metadata,
        requestId: context.requestId,
      },
    });
  }
}
