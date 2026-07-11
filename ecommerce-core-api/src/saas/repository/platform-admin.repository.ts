import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import type {
  Queryable,
  PlatformAdminUserRecord,
  PlatformRoleRecord,
  PlatformSettingRecord,
} from './types';

@Injectable()
export class PlatformAdminRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listPlatformAdmins(): Promise<PlatformAdminUserRecord[]> {
    const result = await this.databaseService.db.query<PlatformAdminUserRecord>(
      `
        SELECT
          id,
          full_name,
          email,
          status,
          last_login_at,
          created_at,
          updated_at
        FROM platform_admin_users
        ORDER BY created_at DESC
      `,
    );
    return result.rows;
  }

  async findPlatformAdminByEmail(email: string): Promise<PlatformAdminUserRecord | null> {
    const result = await this.databaseService.db.query<PlatformAdminUserRecord>(
      `
        SELECT
          id,
          full_name,
          email,
          status,
          last_login_at,
          created_at,
          updated_at
        FROM platform_admin_users
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [email],
    );
    return result.rows[0] ?? null;
  }

  async findPlatformAdminById(adminId: string): Promise<PlatformAdminUserRecord | null> {
    const result = await this.databaseService.db.query<PlatformAdminUserRecord>(
      `
        SELECT
          id,
          full_name,
          email,
          status,
          last_login_at,
          created_at,
          updated_at
        FROM platform_admin_users
        WHERE id = $1
        LIMIT 1
      `,
      [adminId],
    );
    return result.rows[0] ?? null;
  }

  async createPlatformAdmin(input: {
    fullName: string;
    email: string;
    passwordHash: string;
    status: 'active' | 'disabled';
  }): Promise<PlatformAdminUserRecord> {
    const result = await this.databaseService.db.query<PlatformAdminUserRecord>(
      `
        INSERT INTO platform_admin_users (
          id,
          full_name,
          email,
          password_hash,
          status,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
        RETURNING
          id,
          full_name,
          email,
          status,
          last_login_at,
          created_at,
          updated_at
      `,
      [uuidv4(), input.fullName, input.email, input.passwordHash, input.status],
    );
    return result.rows[0] as PlatformAdminUserRecord;
  }

  async updatePlatformAdmin(input: {
    adminId: string;
    fullName?: string;
    status?: 'active' | 'disabled';
    passwordHash?: string;
  }): Promise<PlatformAdminUserRecord | null> {
    const setParts: string[] = [];
    const values: unknown[] = [input.adminId];
    let idx = 2;

    const append = (field: string, value: unknown) => {
      setParts.push(`${field} = $${idx}`);
      values.push(value);
      idx += 1;
    };

    if (input.fullName !== undefined) {
      append('full_name', input.fullName);
    }
    if (input.status !== undefined) {
      append('status', input.status);
    }
    if (input.passwordHash !== undefined) {
      append('password_hash', input.passwordHash);
    }
    append('updated_at', new Date());

    const result = await this.databaseService.db.query<PlatformAdminUserRecord>(
      `
        UPDATE platform_admin_users
        SET ${setParts.join(', ')}
        WHERE id = $1
        RETURNING
          id,
          full_name,
          email,
          status,
          last_login_at,
          created_at,
          updated_at
      `,
      values,
    );
    return result.rows[0] ?? null;
  }

  async listPlatformRolePermissions(roleId: string): Promise<string[]> {
    const result = await this.databaseService.db.query<{ key: string }>(
      `
        SELECT p.key
        FROM platform_admin_role_permissions rp
        INNER JOIN platform_admin_permissions p
          ON p.id = rp.permission_id
        WHERE rp.role_id = $1
        ORDER BY p.key ASC
      `,
      [roleId],
    );
    return result.rows.map((row) => row.key);
  }

  async listPlatformRoles(): Promise<PlatformRoleRecord[]> {
    const result = await this.databaseService.db.query<PlatformRoleRecord>(
      `
        SELECT
          id,
          name,
          code,
          description,
          created_at,
          updated_at
        FROM platform_admin_roles
        ORDER BY created_at DESC
      `,
    );
    return result.rows;
  }

  async findPlatformRoleById(roleId: string): Promise<PlatformRoleRecord | null> {
    const result = await this.databaseService.db.query<PlatformRoleRecord>(
      `
        SELECT
          id,
          name,
          code,
          description,
          created_at,
          updated_at
        FROM platform_admin_roles
        WHERE id = $1
        LIMIT 1
      `,
      [roleId],
    );
    return result.rows[0] ?? null;
  }

  async findPlatformRoleByCode(code: string): Promise<PlatformRoleRecord | null> {
    const result = await this.databaseService.db.query<PlatformRoleRecord>(
      `
        SELECT
          id,
          name,
          code,
          description,
          created_at,
          updated_at
        FROM platform_admin_roles
        WHERE LOWER(code) = LOWER($1)
        LIMIT 1
      `,
      [code],
    );
    return result.rows[0] ?? null;
  }

  async createPlatformRole(input: {
    name: string;
    code: string;
    description: string | null;
  }): Promise<PlatformRoleRecord> {
    const result = await this.databaseService.db.query<PlatformRoleRecord>(
      `
        INSERT INTO platform_admin_roles (
          id,
          name,
          code,
          description,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING
          id,
          name,
          code,
          description,
          created_at,
          updated_at
      `,
      [uuidv4(), input.name, input.code, input.description],
    );
    return result.rows[0] as PlatformRoleRecord;
  }

  async updatePlatformRole(input: {
    roleId: string;
    name?: string;
    description?: string | null;
  }): Promise<PlatformRoleRecord | null> {
    const setParts: string[] = [];
    const values: unknown[] = [input.roleId];
    let idx = 2;
    if (input.name !== undefined) {
      setParts.push(`name = $${idx}`);
      values.push(input.name);
      idx += 1;
    }
    if (input.description !== undefined) {
      setParts.push(`description = $${idx}`);
      values.push(input.description);
      idx += 1;
    }
    setParts.push(`updated_at = $${idx}`);
    values.push(new Date());

    const result = await this.databaseService.db.query<PlatformRoleRecord>(
      `
        UPDATE platform_admin_roles
        SET ${setParts.join(', ')}
        WHERE id = $1
        RETURNING
          id,
          name,
          code,
          description,
          created_at,
          updated_at
      `,
      values,
    );
    return result.rows[0] ?? null;
  }

  async replacePlatformRolePermissions(roleId: string, permissionKeys: string[]): Promise<void> {
    await this.withTransaction(async (db) => {
      await db.query(
        `
          DELETE FROM platform_admin_role_permissions
          WHERE role_id = $1
        `,
        [roleId],
      );

      if (permissionKeys.length === 0) {
        return;
      }

      await db.query(
        `
          INSERT INTO platform_admin_role_permissions (role_id, permission_id, created_at)
          SELECT $1, p.id, NOW()
          FROM platform_admin_permissions p
          WHERE p.key = ANY($2::text[])
        `,
        [roleId, permissionKeys],
      );
    });
  }

  async countActiveAdminsWithRoleCode(roleCode: string): Promise<number> {
    const result = await this.databaseService.db.query<{ count: string }>(
      `
        SELECT COUNT(DISTINCT u.id)::text AS count
        FROM platform_admin_users u
        INNER JOIN platform_admin_user_roles ur ON ur.user_id = u.id
        INNER JOIN platform_admin_roles r ON r.id = ur.role_id
        WHERE u.status = 'active'
          AND LOWER(r.code) = LOWER($1)
      `,
      [roleCode],
    );
    return Number(result.rows[0]?.count ?? '0');
  }

  async countActiveAdminsWithAnyRoleCode(roleCodes: string[]): Promise<number> {
    if (roleCodes.length === 0) {
      return 0;
    }

    const result = await this.databaseService.db.query<{ count: string }>(
      `
        SELECT COUNT(DISTINCT u.id)::text AS count
        FROM platform_admin_users u
        INNER JOIN platform_admin_user_roles ur ON ur.user_id = u.id
        INNER JOIN platform_admin_roles r ON r.id = ur.role_id
        WHERE u.status = 'active'
          AND LOWER(r.code) = ANY($1::text[])
      `,
      [roleCodes.map((code) => code.toLowerCase())],
    );
    return Number(result.rows[0]?.count ?? '0');
  }

  async listPlatformRoleCodesByIds(roleIds: string[]): Promise<string[]> {
    if (roleIds.length === 0) {
      return [];
    }

    const result = await this.databaseService.db.query<{ code: string }>(
      `
        SELECT code
        FROM platform_admin_roles
        WHERE id = ANY($1::uuid[])
      `,
      [roleIds],
    );
    return result.rows.map((row) => row.code);
  }

  async revokeAllPlatformAdminSessions(adminId: string): Promise<number> {
    const result = await this.databaseService.db.query(
      `
        UPDATE platform_admin_sessions
        SET revoked_at = NOW(),
            last_seen_at = NOW()
        WHERE admin_user_id = $1
          AND revoked_at IS NULL
      `,
      [adminId],
    );
    return result.rowCount ?? 0;
  }

  async assignPlatformRoleToAdmin(adminId: string, roleId: string): Promise<void> {
    await this.databaseService.db.query(
      `
        INSERT INTO platform_admin_user_roles (user_id, role_id, created_at)
        VALUES ($1, $2, NOW())
        ON CONFLICT DO NOTHING
      `,
      [adminId, roleId],
    );
  }

  async replacePlatformAdminRoles(adminId: string, roleIds: string[]): Promise<void> {
    await this.withTransaction(async (db) => {
      await db.query(
        `
          DELETE FROM platform_admin_user_roles
          WHERE user_id = $1
        `,
        [adminId],
      );
      if (roleIds.length === 0) {
        return;
      }

      await db.query(
        `
          INSERT INTO platform_admin_user_roles (user_id, role_id, created_at)
          SELECT $1, x.role_id::uuid, NOW()
          FROM UNNEST($2::text[]) AS x(role_id)
        `,
        [adminId, roleIds],
      );
    });
  }

  async listPlatformAdminRoleIds(adminId: string): Promise<string[]> {
    const result = await this.databaseService.db.query<{ role_id: string }>(
      `
        SELECT role_id::text AS role_id
        FROM platform_admin_user_roles
        WHERE user_id = $1
      `,
      [adminId],
    );
    return result.rows.map((row) => row.role_id);
  }

  async listPlatformAdminRoleCodes(adminId: string): Promise<string[]> {
    const result = await this.databaseService.db.query<{ code: string }>(
      `
        SELECT r.code
        FROM platform_admin_user_roles ur
        INNER JOIN platform_admin_roles r
          ON r.id = ur.role_id
        WHERE ur.user_id = $1
        ORDER BY r.code ASC
      `,
      [adminId],
    );
    return result.rows.map((row) => row.code);
  }

  async listPlatformPermissionKeys(): Promise<string[]> {
    const result = await this.databaseService.db.query<{ key: string }>(
      `
        SELECT key
        FROM platform_admin_permissions
        ORDER BY key ASC
      `,
    );
    return result.rows.map((row) => row.key);
  }

  async listPlatformSettings(): Promise<PlatformSettingRecord[]> {
    const result = await this.databaseService.db.query<PlatformSettingRecord>(
      `
        SELECT
          ps.id,
          ps.key,
          ps.value,
          ps.updated_by,
          u.full_name AS updated_by_name,
          ps.updated_at
        FROM platform_settings ps
        LEFT JOIN platform_admin_users u
          ON u.id = ps.updated_by
        ORDER BY ps.key ASC
      `,
    );
    return result.rows;
  }

  async upsertPlatformSetting(input: {
    key: string;
    value: Record<string, unknown>;
    updatedBy: string;
  }): Promise<PlatformSettingRecord> {
    const result = await this.databaseService.db.query<PlatformSettingRecord>(
      `
        INSERT INTO platform_settings (id, key, value, updated_by, updated_at)
        VALUES ($1, $2, $3::jsonb, $4, NOW())
        ON CONFLICT (key) DO UPDATE
        SET value = EXCLUDED.value,
            updated_by = EXCLUDED.updated_by,
            updated_at = NOW()
        RETURNING
          id,
          key,
          value,
          updated_by,
          NULL::text AS updated_by_name,
          updated_at
      `,
      [uuidv4(), input.key, JSON.stringify(input.value), input.updatedBy],
    );
    return result.rows[0] as PlatformSettingRecord;
  }

  async withTransaction<T>(callback: (db: Queryable) => Promise<T>): Promise<T> {
    const client = await this.databaseService.db.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
