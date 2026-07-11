import { Module } from '@nestjs/common';
import { PlatformModule } from '../platform/platform.module';
import { SaasModule } from '../saas/saas.module';
import { SecurityModule } from '../security/security.module';
import { CloudflareDomainsService } from './cloudflare-domains.service';
import { DomainDnsInspectorService } from './domain-dns-inspector.service';
import { DnsResolverService } from './dns-resolver.service';
import { DomainsController } from './domains.controller';
import { DomainsRepository } from './domains.repository';
import { DomainsService } from './domains.service';
import { PlatformDomainsController } from './platform-domains.controller';

@Module({
  imports: [SecurityModule, SaasModule, PlatformModule],
  controllers: [DomainsController, PlatformDomainsController],
  providers: [
    DomainsService,
    DomainsRepository,
    DnsResolverService,
    DomainDnsInspectorService,
    CloudflareDomainsService,
  ],
  exports: [
    DomainsService,
    DomainsRepository,
    DnsResolverService,
    DomainDnsInspectorService,
    CloudflareDomainsService,
  ],
})
export class DomainsModule {}
