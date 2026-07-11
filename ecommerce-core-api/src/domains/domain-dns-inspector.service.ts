import { Injectable } from '@nestjs/common';
import { resolveCname, resolveTxt } from 'node:dns/promises';

export type DomainDnsRecordStatus = 'valid' | 'missing' | 'wrong_value' | 'error';

export interface DomainDnsRecordCheck {
  record: string;
  expected: string;
  found: string | null;
  status: DomainDnsRecordStatus;
}

export interface DomainDnsRecordInput {
  type: 'CNAME' | 'TXT';
  name: string;
  value: string;
}

@Injectable()
export class DomainDnsInspectorService {
  async checkCname(name: string, expectedTarget: string): Promise<DomainDnsRecordCheck> {
    const normalizedExpected = this.normalizeHost(expectedTarget);

    try {
      const records = await resolveCname(name);
      const normalizedRecords = records.map((record) => this.normalizeHost(record));
      return {
        record: name,
        expected: expectedTarget,
        found: records[0] ?? null,
        status: normalizedRecords.includes(normalizedExpected) ? 'valid' : 'wrong_value',
      };
    } catch (error) {
      return {
        record: name,
        expected: expectedTarget,
        found: null,
        status: this.isDnsNotFound(error) ? 'missing' : 'error',
      };
    }
  }

  async checkTxt(name: string, expectedValue: string): Promise<DomainDnsRecordCheck> {
    try {
      const records = await resolveTxt(name);
      const values = records.map((parts) => parts.join('').trim());
      return {
        record: name,
        expected: expectedValue,
        found: values[0] ?? null,
        status: values.includes(expectedValue) ? 'valid' : 'wrong_value',
      };
    } catch (error) {
      return {
        record: name,
        expected: expectedValue,
        found: null,
        status: this.isDnsNotFound(error) ? 'missing' : 'error',
      };
    }
  }

  async checkRecord(record: DomainDnsRecordInput): Promise<DomainDnsRecordCheck> {
    return record.type === 'CNAME'
      ? this.checkCname(record.name, record.value)
      : this.checkTxt(record.name, record.value);
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
