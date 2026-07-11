import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PLATFORM_PERMISSIONS } from '../platform/constants/platform-permissions.constants';
import { RequirePlatformPermissions } from '../platform/decorators/require-platform-permissions.decorator';
import { PlatformAccessTokenGuard } from '../platform/guards/platform-access-token.guard';
import { PlatformPermissionsGuard } from '../platform/guards/platform-permissions.guard';
import { PlatformStepUpGuard } from '../platform/guards/platform-step-up.guard';
import { CloudflareDomainsService } from './cloudflare-domains.service';

@ApiTags('platform-admin')
@ApiBearerAuth()
@Controller('platform/domains/cloudflare')
@UseGuards(PlatformAccessTokenGuard, PlatformPermissionsGuard, PlatformStepUpGuard)
export class PlatformDomainsController {
  constructor(private readonly cloudflareDomainsService: CloudflareDomainsService) {}

  @Get('readiness')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.domainsRead)
  @ApiOkResponse({ description: 'Check Cloudflare custom domains readiness' })
  async getCloudflareReadiness() {
    return this.cloudflareDomainsService.checkReadiness();
  }
}
