import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuditService } from '../../audit/audit.service';
import type { RequestContextData } from '../../common/utils/request-context.util';
import type { PlatformAdminUser } from '../../platform/interfaces/platform-admin-user.interface';
import type { CreatePlatformAdminDto } from '../dto/create-platform-admin.dto';
import type { CreatePlatformRoleDto } from '../dto/create-platform-role.dto';
import type { UpdatePlatformAdminDto } from '../dto/update-platform-admin.dto';
import type { UpdatePlatformRoleDto } from '../dto/update-platform-role.dto';
import type { UpdatePlatformSettingsDto } from '../dto/update-platform-settings.dto';
import { SaasRepository } from '../saas.repository';

const SYSTEM_PLATFORM_ROLE_CODES = new Set([
  'super_admin',
  'ops_manager',
  'finance_admin',
  'support_agent',
  'qa_tester',
  'template_manager',
  'auditor',
]);

@Injectable()
export class PlatformAdminService {
  constructor(
    private readonly saasRepository: SaasRepository,
    private readonly auditService: AuditService,
  ) {}

  async listPlatformAdmins() {
    const admins = await this.saasRepository.listPlatformAdmins();
    return Promise.all(
      admins.map(async (admin) => ({
        id: admin.id,
        fullName: admin.full_name,
        email: admin.email,
        status: admin.status,
        lastLoginAt: admin.last_login_at,
        createdAt: admin.created_at,
        roleCodes: await this.saasRepository.listPlatformAdminRoleCodes(admin.id),
      })),
    );
  }

  async createPlatformAdmin(
    input: CreatePlatformAdminDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const existing = await this.saasRepository.findPlatformAdminByEmail(
      input.email.trim().toLowerCase(),
    );
    if (existing) {
      throw new ConflictException('Platform admin email already exists');
    }

    const passwordHash = await argon2.hash(input.password);
    const created = await this.saasRepository.createPlatformAdmin({
      fullName: input.fullName.trim(),
      email: input.email.trim().toLowerCase(),
      passwordHash,
      status: input.status ?? 'active',
    });

    if (input.roleIds && input.roleIds.length > 0) {
      await this.saasRepository.replacePlatformAdminRoles(created.id, input.roleIds);
    }

    await this.auditService.log({
      action: 'platform.admin_created',
      storeId: null,
      storeUserId: null,
      platformAdminId: currentUser.id,
      targetType: 'platform_admin_user',
      targetId: created.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        createdByAdminId: currentUser.id,
      },
    });

    return {
      id: created.id,
      fullName: created.full_name,
      email: created.email,
      status: created.status,
      lastLoginAt: created.last_login_at,
      createdAt: created.created_at,
      roleCodes: await this.saasRepository.listPlatformAdminRoleCodes(created.id),
    };
  }

  async updatePlatformAdmin(
    adminId: string,
    input: UpdatePlatformAdminDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const existing = await this.saasRepository.findPlatformAdminById(adminId);
    if (!existing) {
      throw new NotFoundException('Platform admin not found');
    }

    const beforeRoleCodes = await this.saasRepository.listPlatformAdminRoleCodes(adminId);
    if (input.status === 'disabled') {
      await this.assertCanDisablePlatformAdmin(adminId, beforeRoleCodes, currentUser.id);
    }

    let afterRoleCodes: string[] | undefined;
    if (input.roleIds) {
      afterRoleCodes = await this.saasRepository.listPlatformRoleCodesByIds(input.roleIds);
      await this.assertCanReplacePlatformAdminRoles(
        adminId,
        beforeRoleCodes,
        afterRoleCodes,
        currentUser.id,
      );
    }

    const adminUpdateInput: {
      adminId: string;
      fullName?: string;
      status?: 'active' | 'disabled';
      passwordHash?: string;
    } = { adminId };
    if (input.fullName !== undefined) {
      adminUpdateInput.fullName = input.fullName.trim();
    }
    if (input.status !== undefined) {
      adminUpdateInput.status = input.status;
    }
    if (input.password !== undefined) {
      adminUpdateInput.passwordHash = await argon2.hash(input.password);
    }

    const updated = await this.saasRepository.updatePlatformAdmin(adminUpdateInput);
    if (!updated) {
      throw new NotFoundException('Platform admin not found');
    }

    if (input.roleIds) {
      await this.saasRepository.replacePlatformAdminRoles(adminId, input.roleIds);
    }

    if (input.status === 'disabled' || input.password !== undefined || input.roleIds) {
      await this.saasRepository.revokeAllPlatformAdminSessions(adminId);
    }

    await this.auditService.log({
      action: 'platform.admin_updated',
      storeId: null,
      storeUserId: null,
      platformAdminId: currentUser.id,
      targetType: 'platform_admin_user',
      targetId: updated.id,
      category: 'security',
      beforeSnapshot: {
        status: existing.status,
        roleCodes: beforeRoleCodes,
      },
      afterSnapshot: {
        status: updated.status,
        roleCodes: afterRoleCodes ?? beforeRoleCodes,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        updatedByAdminId: currentUser.id,
        before: {
          status: existing.status,
          roleCodes: beforeRoleCodes,
        },
        after: {
          status: updated.status,
          roleCodes: afterRoleCodes ?? beforeRoleCodes,
        },
      },
    });

    return {
      id: updated.id,
      fullName: updated.full_name,
      email: updated.email,
      status: updated.status,
      lastLoginAt: updated.last_login_at,
      createdAt: updated.created_at,
      roleCodes:
        afterRoleCodes ?? (await this.saasRepository.listPlatformAdminRoleCodes(updated.id)),
    };
  }

  async listPlatformRoles() {
    const roles = await this.saasRepository.listPlatformRoles();
    const permissionKeys = await this.saasRepository.listPlatformPermissionKeys();
    return Promise.all(
      roles.map(async (role) => ({
        id: role.id,
        name: role.name,
        code: role.code,
        description: role.description,
        permissions: await this.saasRepository.listPlatformRolePermissions(role.id),
        availablePermissions: permissionKeys,
      })),
    );
  }

  async listPlatformPermissionCatalog() {
    const permissionKeys = await this.saasRepository.listPlatformPermissionKeys();
    return permissionKeys.map((key) => ({
      key,
      group: key.split('.')[1] ?? 'general',
      isDangerous: [
        'platform.admins.write',
        'platform.roles.write',
        'platform.settings.write',
        'platform.finance.write',
        'platform.stores.suspend',
        'platform.stores.resume',
        'platform.stores.delete.preview',
        'platform.stores.delete.confirm',
        'platform.stores.delete.status',
        'platform.stores.purge.retry',
      ].includes(key),
    }));
  }

  async createPlatformRole(
    input: CreatePlatformRoleDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const existing = await this.saasRepository.findPlatformRoleByCode(
      input.code.trim().toLowerCase(),
    );
    if (existing) {
      throw new ConflictException('Role code already exists');
    }

    const allPermissionKeys = new Set(await this.saasRepository.listPlatformPermissionKeys());
    const requestedKeys = input.permissionKeys
      .map((key) => key.trim())
      .filter((key) => key.length > 0);
    if (
      SYSTEM_PLATFORM_ROLE_CODES.has(input.code.trim().toLowerCase()) &&
      requestedKeys.length === 0
    ) {
      throw new BadRequestException('System platform roles cannot be created without permissions');
    }

    for (const key of requestedKeys) {
      if (!allPermissionKeys.has(key)) {
        throw new BadRequestException(`Unknown permission key ${key}`);
      }
    }

    const role = await this.saasRepository.createPlatformRole({
      name: input.name.trim(),
      code: input.code.trim().toLowerCase(),
      description: input.description?.trim() ?? null,
    });
    await this.saasRepository.replacePlatformRolePermissions(role.id, requestedKeys);

    await this.auditService.log({
      action: 'platform.role_created',
      storeId: null,
      storeUserId: null,
      platformAdminId: currentUser.id,
      targetType: 'platform_admin_role',
      targetId: role.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        createdByAdminId: currentUser.id,
      },
    });

    return {
      id: role.id,
      name: role.name,
      code: role.code,
      description: role.description,
      permissions: await this.saasRepository.listPlatformRolePermissions(role.id),
    };
  }

  async updatePlatformRole(
    roleId: string,
    input: UpdatePlatformRoleDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const existing = await this.saasRepository.findPlatformRoleById(roleId);
    if (!existing) {
      throw new NotFoundException('Role not found');
    }

    const beforePermissionKeys = await this.saasRepository.listPlatformRolePermissions(roleId);

    if (input.permissionKeys) {
      const requestedKeys = input.permissionKeys
        .map((key) => key.trim())
        .filter((key) => key.length > 0);
      if (SYSTEM_PLATFORM_ROLE_CODES.has(existing.code) && requestedKeys.length === 0) {
        throw new BadRequestException('System platform roles cannot be emptied');
      }

      const allPermissionKeys = new Set(await this.saasRepository.listPlatformPermissionKeys());
      for (const key of requestedKeys) {
        if (!allPermissionKeys.has(key)) {
          throw new BadRequestException(`Unknown permission key ${key}`);
        }
      }
    }

    const roleUpdateInput: { roleId: string; name?: string; description?: string | null } = {
      roleId,
    };
    if (input.name !== undefined) {
      roleUpdateInput.name = input.name.trim();
    }
    if (input.description !== undefined) {
      roleUpdateInput.description = input.description.trim();
    }
    const updated = await this.saasRepository.updatePlatformRole(roleUpdateInput);
    if (!updated) {
      throw new NotFoundException('Role not found');
    }

    if (input.permissionKeys) {
      await this.saasRepository.replacePlatformRolePermissions(
        roleId,
        input.permissionKeys.map((key) => key.trim()).filter((key) => key.length > 0),
      );
    }

    await this.auditService.log({
      action: 'platform.role_updated',
      storeId: null,
      storeUserId: null,
      platformAdminId: currentUser.id,
      targetType: 'platform_admin_role',
      targetId: updated.id,
      category: 'rbac',
      beforeSnapshot: {
        code: existing.code,
        permissions: beforePermissionKeys,
      },
      afterSnapshot: {
        permissionKeys: input.permissionKeys,
      },
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        updatedByAdminId: currentUser.id,
        before: {
          code: existing.code,
          permissions: beforePermissionKeys,
        },
        after: {
          permissionKeys: input.permissionKeys,
        },
      },
    });

    return {
      id: updated.id,
      name: updated.name,
      code: updated.code,
      description: updated.description,
      permissions: await this.saasRepository.listPlatformRolePermissions(updated.id),
    };
  }

  async getPlatformSettings() {
    const rows = await this.saasRepository.listPlatformSettings();
    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      value: row.value,
      updatedBy: row.updated_by,
      updatedByName: row.updated_by_name,
      updatedAt: row.updated_at,
    }));
  }

  async updatePlatformSettings(
    input: UpdatePlatformSettingsDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const updated = [];
    for (const entry of input.entries) {
      const result = await this.saasRepository.upsertPlatformSetting({
        key: entry.key.trim(),
        value: entry.value,
        updatedBy: currentUser.id,
      });
      updated.push({
        id: result.id,
        key: result.key,
        value: result.value,
        updatedBy: result.updated_by,
        updatedByName: currentUser.fullName,
        updatedAt: result.updated_at,
      });
    }

    await this.auditService.log({
      action: 'platform.settings_updated',
      storeId: null,
      storeUserId: null,
      platformAdminId: currentUser.id,
      targetType: 'platform_settings',
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        keys: input.entries.map((entry) => entry.key),
      },
    });

    return updated;
  }

  private async assertCanDisablePlatformAdmin(
    adminId: string,
    currentRoleCodes: string[],
    actingAdminId: string,
  ): Promise<void> {
    if (adminId === actingAdminId) {
      throw new BadRequestException('Platform admins cannot disable themselves');
    }

    if (!currentRoleCodes.includes('super_admin')) {
      return;
    }

    const activeSuperAdmins =
      await this.saasRepository.countActiveAdminsWithRoleCode('super_admin');
    if (activeSuperAdmins <= 1) {
      throw new BadRequestException('Cannot disable the last active super_admin');
    }
  }

  private async assertCanReplacePlatformAdminRoles(
    adminId: string,
    beforeRoleCodes: string[],
    afterRoleCodes: string[],
    actingAdminId: string,
  ): Promise<void> {
    if (beforeRoleCodes.includes('super_admin') && !afterRoleCodes.includes('super_admin')) {
      const activeSuperAdmins =
        await this.saasRepository.countActiveAdminsWithRoleCode('super_admin');
      if (activeSuperAdmins <= 1) {
        throw new BadRequestException('Cannot remove super_admin from the last active super_admin');
      }
    }

    if (adminId === actingAdminId && !afterRoleCodes.includes('super_admin')) {
      throw new BadRequestException('Platform admins cannot remove their own super_admin role');
    }

    const privilegedRoleCount = await this.saasRepository.countActiveAdminsWithAnyRoleCode([
      'super_admin',
    ]);
    if (
      privilegedRoleCount <= 1 &&
      beforeRoleCodes.includes('super_admin') &&
      !afterRoleCodes.includes('super_admin')
    ) {
      throw new BadRequestException('Cannot leave the platform without a super_admin');
    }
  }
}
