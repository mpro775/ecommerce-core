import { Injectable } from '@nestjs/common';
import { resolveCname, resolveTxt } from 'node:dns/promises';

@Injectable()
export class DnsResolverService {
  async hasVerificationRecord(hostname: string, token: string, prefix: string): Promise<boolean> {
    const recordHost = `${prefix}.${hostname}`;

    try {
      const records = await resolveTxt(recordHost);
      const values = records.map((parts) => parts.join('').trim());
      return values.includes(token);
    } catch (error) {
      if (this.isDnsNotFound(error)) {
        return false;
      }
      throw error;
    }
  }

  async hasRoutingCname(hostname: string, expectedTarget: string): Promise<boolean> {
    const normalizedExpected = this.normalizeHost(expectedTarget);

    try {
      const records = await resolveCname(hostname);
      return records.some((record) => this.normalizeHost(record) === normalizedExpected);
    } catch (error) {
      if (this.isDnsNotFound(error)) {
        return false;
      }
      throw error;
    }
  }

  private normalizeHost(value: string): string {
    return value.trim().toLowerCase().replace(/\.$/, '');
  }

  private isDnsNotFound(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const dnsError = error as Error & { code?: string };
    return dnsError.code === 'ENOTFOUND' || dnsError.code === 'ENODATA';
  }
}
