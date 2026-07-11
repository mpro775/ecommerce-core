import { Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PLATFORM_PERMISSIONS } from '../platform/constants/platform-permissions.constants';
import { RequirePlatformPermissions } from '../platform/decorators/require-platform-permissions.decorator';
import { PlatformAccessTokenGuard } from '../platform/guards/platform-access-token.guard';
import { PlatformPermissionsGuard } from '../platform/guards/platform-permissions.guard';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto';
import { NotificationsService } from './notifications.service';

@ApiTags('platform-notifications')
@ApiBearerAuth()
@Controller('platform/notifications')
@UseGuards(PlatformAccessTokenGuard, PlatformPermissionsGuard)
export class NotificationsPlatformController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('inbox')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.dashboardRead)
  @ApiOkResponse({ description: 'List platform inbox notifications' })
  async listInbox(@Query() query: ListNotificationsQueryDto) {
    return this.notificationsService.listPlatformInbox({
      unreadOnly: query.unreadOnly ?? false,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      ...(query.type?.trim() ? { type: query.type.trim() } : {}),
    });
  }

  @Get('unread-count')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.dashboardRead)
  @ApiOkResponse({ description: 'Get unread platform notifications count' })
  async unreadCount() {
    return this.notificationsService.countUnreadPlatformNotifications();
  }

  @Patch(':notificationId/read')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.dashboardRead)
  @ApiOkResponse({ description: 'Mark a platform notification as read' })
  async markRead(@Param('notificationId', ParseUUIDPipe) notificationId: string) {
    await this.notificationsService.markPlatformNotificationRead(notificationId);
    return { ok: true };
  }

  @Patch('read-all')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.dashboardRead)
  @ApiOkResponse({ description: 'Mark all platform notifications as read' })
  async markAllRead() {
    return this.notificationsService.markAllPlatformNotificationsRead();
  }
}
