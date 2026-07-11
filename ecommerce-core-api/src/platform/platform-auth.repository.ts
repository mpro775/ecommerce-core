import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';

export interface PlatformAdminRecord {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  status: 'active' | 'disabled';
  mfa_enabled: boolean;
  mfa_secret: string | null;
  mfa_backup_codes: string[];
  trusted_ips: string[];
  trusted_user_agents: string[];
  last_login_at: Date | null;
  failed_login_attempts: number;
  locked_until: Date | null;
  last_failed_login_at: Date | null;
}

export interface PlatformSessionRecord {
  id: string;
  admin_user_id: string;
  refresh_token_hash: string;
  expires_at: Date;
  revoked_at: Date | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: Date;
  last_seen_at: Date;
}

@Injectable()
export class PlatformAuthRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async findAdminByEmail(email: string): Promise<PlatformAdminRecord | null> {
    const result = await this.databaseService.db.query<PlatformAdminRecord>(
      `
        SELECT
          id,
          full_name,
          email,
          password_hash,
          status,
          mfa_enabled,
          mfa_secret,
          COALESCE(mfa_backup_codes, '[]'::jsonb) AS mfa_backup_codes,
          COALESCE(trusted_ips, '[]'::jsonb) AS trusted_ips,
          COALESCE(trusted_user_agents, '[]'::jsonb) AS trusted_user_agents,
          last_login_at,
          COALESCE(failed_login_attempts, 0) AS failed_login_attempts,
          locked_until,
          last_failed_login_at
        FROM platform_admin_users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [email],
    );

    return result.rows[0] ?? null;
  }

  async findAdminById(adminId: string): Promise<PlatformAdminRecord | null> {
    const result = await this.databaseService.db.query<PlatformAdminRecord>(
      `
        SELECT
          id,
          full_name,
          email,
          password_hash,
          status,
          mfa_enabled,
          mfa_secret,
          COALESCE(mfa_backup_codes, '[]'::jsonb) AS mfa_backup_codes,
          COALESCE(trusted_ips, '[]'::jsonb) AS trusted_ips,
          COALESCE(trusted_user_agents, '[]'::jsonb) AS trusted_user_agents,
          last_login_at,
          COALESCE(failed_login_attempts, 0) AS failed_login_attempts,
          locked_until,
          last_failed_login_at
        FROM platform_admin_users
        WHERE id = $1
        LIMIT 1
      `,
      [adminId],
    );

    return result.rows[0] ?? null;
  }

  async listAdminRoleCodes(adminId: string): Promise<string[]> {
    const result = await this.databaseService.db.query<{ code: string }>(
      `
        SELECT r.code
        FROM platform_admin_user_roles ur
        INNER JOIN platform_admin_roles r
          ON r.id = ur.role_id
        WHERE ur.user_id = $1
      `,
      [adminId],
    );

    return result.rows.map((row) => row.code);
  }

  async listAdminPermissions(adminId: string): Promise<string[]> {
    const result = await this.databaseService.db.query<{ permission_key: string }>(
      `
        SELECT DISTINCT p.key AS permission_key
        FROM platform_admin_user_roles ur
        INNER JOIN platform_admin_role_permissions rp
          ON rp.role_id = ur.role_id
        INNER JOIN platform_admin_permissions p
          ON p.id = rp.permission_id
        WHERE ur.user_id = $1
      `,
      [adminId],
    );

    return result.rows.map((row) => row.permission_key);
  }

  async createSession(input: {
    adminUserId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<{ id: string }> {
    const id = uuidv4();
    await this.databaseService.db.query(
      `
        INSERT INTO platform_admin_sessions (
          id,
          admin_user_id,
          refresh_token_hash,
          expires_at,
          revoked_at,
          ip_address,
          user_agent,
          created_at,
          last_seen_at
        ) VALUES ($1, $2, $3, $4, NULL, $5, $6, NOW(), NOW())
      `,
      [
        id,
        input.adminUserId,
        input.refreshTokenHash,
        input.expiresAt,
        input.ipAddress ?? null,
        input.userAgent ?? null,
      ],
    );

    return { id };
  }

  async findSessionById(sessionId: string): Promise<PlatformSessionRecord | null> {
    const result = await this.databaseService.db.query<PlatformSessionRecord>(
      `
        SELECT
          id,
          admin_user_id,
          refresh_token_hash,
          expires_at,
          revoked_at,
          ip_address,
          user_agent,
          created_at,
          last_seen_at
        FROM platform_admin_sessions
        WHERE id = $1
        LIMIT 1
      `,
      [sessionId],
    );

    return result.rows[0] ?? null;
  }

  async rotateSession(input: {
    sessionId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        UPDATE platform_admin_sessions
        SET refresh_token_hash = $2,
            expires_at = $3,
            ip_address = $4,
            user_agent = $5,
            last_seen_at = NOW()
        WHERE id = $1
          AND revoked_at IS NULL
      `,
      [
        input.sessionId,
        input.refreshTokenHash,
        input.expiresAt,
        input.ipAddress ?? null,
        input.userAgent ?? null,
      ],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async revokeSession(sessionId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE platform_admin_sessions
        SET revoked_at = NOW(),
            last_seen_at = NOW()
        WHERE id = $1
      `,
      [sessionId],
    );
  }

  async listActiveSessionsByAdmin(adminId: string): Promise<PlatformSessionRecord[]> {
    const result = await this.databaseService.db.query<PlatformSessionRecord>(
      `
        SELECT
          id,
          admin_user_id,
          refresh_token_hash,
          expires_at,
          revoked_at,
          ip_address,
          user_agent,
          created_at,
          last_seen_at
        FROM platform_admin_sessions
        WHERE admin_user_id = $1
          AND revoked_at IS NULL
          AND expires_at > NOW()
        ORDER BY last_seen_at DESC
      `,
      [adminId],
    );

    return result.rows;
  }

  async revokeAdminSession(adminId: string, sessionId: string): Promise<boolean> {
    const result = await this.databaseService.db.query(
      `
        UPDATE platform_admin_sessions
        SET revoked_at = NOW(),
            last_seen_at = NOW()
        WHERE id = $1
          AND admin_user_id = $2
          AND revoked_at IS NULL
      `,
      [sessionId, adminId],
    );

    return (result.rowCount ?? 0) > 0;
  }

  async revokeOtherAdminSessions(adminId: string, currentSessionId: string): Promise<number> {
    const result = await this.databaseService.db.query(
      `
        UPDATE platform_admin_sessions
        SET revoked_at = NOW(),
            last_seen_at = NOW()
        WHERE admin_user_id = $1
          AND id <> $2
          AND revoked_at IS NULL
      `,
      [adminId, currentSessionId],
    );

    return result.rowCount ?? 0;
  }

  async touchAdminLastLogin(adminId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE platform_admin_users
        SET last_login_at = NOW(),
            failed_login_attempts = 0,
            locked_until = NULL,
            last_failed_login_at = NULL,
            updated_at = NOW()
        WHERE id = $1
      `,
      [adminId],
    );
  }

  async recordFailedLogin(adminId: string, maxAttempts: number, lockoutMs: number): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE platform_admin_users
        SET failed_login_attempts = failed_login_attempts + 1,
            last_failed_login_at = NOW(),
            locked_until = CASE
              WHEN failed_login_attempts + 1 >= $2 THEN NOW() + ($3::text || ' milliseconds')::interval
              ELSE locked_until
            END,
            updated_at = NOW()
        WHERE id = $1
      `,
      [adminId, maxAttempts, lockoutMs],
    );
  }

  async updateAdminMfa(input: {
    adminId: string;
    mfaEnabled: boolean;
    mfaSecret: string | null;
    mfaBackupCodes: string[];
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        UPDATE platform_admin_users
        SET mfa_enabled = $2,
            mfa_secret = $3,
            mfa_backup_codes = $4::jsonb,
            updated_at = NOW()
        WHERE id = $1
      `,
      [input.adminId, input.mfaEnabled, input.mfaSecret, JSON.stringify(input.mfaBackupCodes)],
    );
  }

  async getPlatformSettingValue(key: string): Promise<Record<string, unknown> | null> {
    const result = await this.databaseService.db.query<{ value: Record<string, unknown> }>(
      `
        SELECT value
        FROM platform_settings
        WHERE key = $1
        LIMIT 1
      `,
      [key],
    );
    return result.rows[0]?.value ?? null;
  }
}
