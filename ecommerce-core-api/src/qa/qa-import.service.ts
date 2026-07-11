import fs from 'node:fs/promises';
import path from 'node:path';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { QaRepository } from './qa.repository';
import { normalizeQaScenario } from './utils/qa-scenario-normalizer';

export interface QaImportResult {
  scenarioId: string;
  scenarioKey: string;
  version: string;
  checksum: string;
  imported: boolean;
  phases: number;
  checks: number;
  questions: number;
}

@Injectable()
export class QaImportService {
  private readonly logger = new Logger(QaImportService.name);

  constructor(private readonly qaRepository: QaRepository) {}

  async importScenario(input: unknown, publish = true): Promise<QaImportResult> {
    const scenario = normalizeQaScenario(input);
    return this.qaRepository.transaction(async (db) => {
      const result = await this.qaRepository.upsertScenario(scenario, publish, db);
      await this.qaRepository.logRunEvent(
        {
          eventType: result.imported ? 'scenario_imported' : 'scenario_import_skipped',
          metadata: {
            scenarioKey: scenario.scenarioKey,
            version: scenario.version,
            checksum: scenario.checksum,
          },
        },
        db,
      );
      return {
        scenarioId: result.scenario.id,
        scenarioKey: result.scenario.scenario_key,
        version: result.scenario.version,
        checksum: result.scenario.checksum,
        imported: result.imported,
        phases: scenario.phases.length,
        checks: scenario.phases.reduce((total, phase) => total + phase.checks.length, 0),
        questions: scenario.phases.reduce((total, phase) => total + phase.questions.length, 0),
      };
    });
  }

  async importBundledScenarios(publish = true): Promise<QaImportResult[]> {
    const scenariosDir = await this.resolveScenariosDir();
    const files = (await fs.readdir(scenariosDir))
      .filter((fileName) => fileName.endsWith('.json'))
      .sort();
    const results: QaImportResult[] = [];

    for (const fileName of files) {
      try {
        const raw = await fs.readFile(path.join(scenariosDir, fileName), 'utf8');
        results.push(await this.importScenario(JSON.parse(raw), publish));
      } catch (error) {
        this.logger.error({
          message: 'QA scenario import failed',
          fileName,
          error: error instanceof Error ? error.message : String(error),
        });
        throw error;
      }
    }

    return results;
  }

  private async resolveScenariosDir(): Promise<string> {
    const candidates = [
      path.resolve(process.cwd(), 'src/qa/scenarios'),
      path.resolve(process.cwd(), 'dist/qa/scenarios'),
      path.resolve(__dirname, 'scenarios'),
    ];
    for (const candidate of candidates) {
      try {
        const stat = await fs.stat(candidate);
        if (stat.isDirectory()) {
          return candidate;
        }
      } catch {
        // Try the next candidate.
      }
    }
    throw new BadRequestException(
      'QA scenarios directory was not found. Upload a scenario JSON or include bundled QA scenario files in the deployment.',
    );
  }
}
