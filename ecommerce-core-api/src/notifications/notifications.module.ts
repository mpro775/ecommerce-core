import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { PlatformModule } from '../platform/platform.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsCustomerController } from './notifications-customer.controller';
import { NotificationsPlatformController } from './notifications-platform.controller';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsRepository } from './notifications.repository';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [CustomersModule, PlatformModule],
  controllers: [
    NotificationsController,
    NotificationsCustomerController,
    NotificationsPlatformController,
  ],
  providers: [NotificationsRepository, NotificationsGateway, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
