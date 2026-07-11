import { Injectable } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import type { QaDashboardQueryDto } from './dto/dashboard-query.dto';
import type { QaAnswerRecord } from './entities/qa-answer.entity';
import type { QaAttachmentRecord } from './entities/qa-attachment.entity';
import type { QaCheckRecord } from './entities/qa-check.entity';
import type { QaIssueRecord } from './entities/qa-issue.entity';
import type { QaPhaseRecord } from './entities/qa-phase.entity';
import type { QaQuestionRecord } from './entities/qa-question.entity';
import type { QaRunSummaryRecord } from './entities/qa-run-summary.entity';
import type { QaRunRecord } from './entities/qa-run.entity';
import type { QaScenarioRecord } from './entities/qa-scenario.entity';
import type { NormalizedQaScenario } from './utils/qa-scenario-normalizer';
import type { QaRunStatus } from './enums/qa-run-status.enum';

interface Queryable {
  query: <T = unknown>(
    queryText: string,
    values?: unknown[],
  ) => Promise<{ rows: T[]; rowCount: number | null }>;
}

interface SqlFilter {
  whereSql: string;
  values: unknown[];
}

function toJsonb(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export interface PageResult<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

@Injectable()
export class QaRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async transaction<T>(callback: (db: PoolClient) => Promise<T>): Promise<T> {
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

  async upsertScenario(
    scenario: NormalizedQaScenario,
    publish: boolean,
    db: Queryable,
  ): Promise<{ scenario: QaScenarioRecord; imported: boolean }> {
    const existing = await this.findScenarioByKey(scenario.scenarioKey, db);
    if (existing && existing.checksum === scenario.checksum) {
      return { scenario: existing, imported: false };
    }

    const scenarioId = existing?.id ?? uuidv4();
    const result = await db.query<QaScenarioRecord>(
      `
        INSERT INTO qa_scenarios (
          id,
          scenario_key,
          title,
          title_ar,
          description,
          version,
          checksum,
          is_active,
          source_file,
          metadata,
          published_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, $10, NOW(), NOW())
        ON CONFLICT (scenario_key)
        DO UPDATE SET
          title = EXCLUDED.title,
          title_ar = EXCLUDED.title_ar,
          description = EXCLUDED.description,
          version = EXCLUDED.version,
          checksum = EXCLUDED.checksum,
          is_active = TRUE,
          source_file = EXCLUDED.source_file,
          metadata = EXCLUDED.metadata,
          published_at = COALESCE(EXCLUDED.published_at, qa_scenarios.published_at),
          updated_at = NOW()
        RETURNING *
      `,
      [
        scenarioId,
        scenario.scenarioKey,
        scenario.title,
        scenario.title,
        scenario.description,
        scenario.version,
        scenario.checksum,
        scenario.sourceFile,
        toJsonb(scenario.metadata),
        publish ? new Date() : null,
      ],
    );

    const saved = result.rows[0] as QaScenarioRecord;
    await db.query('DELETE FROM qa_phases WHERE scenario_id = $1', [saved.id]);

    for (const phase of scenario.phases) {
      const phaseRecord = await this.createPhase(saved.id, phase, db);
      for (const check of phase.checks) {
        await this.createCheck(saved.id, phaseRecord.id, check, db);
      }
      for (const question of phase.questions) {
        await this.createQuestion(saved.id, phaseRecord.id, question, db);
      }
    }

    return { scenario: saved, imported: true };
  }

  async listScenarios(input: {
    page?: number;
    limit?: number;
    q?: string;
  }): Promise<PageResult<QaScenarioRecord>> {
    const page = normalizePage(input.page);
    const limit = normalizeLimit(input.limit);
    const offset = (page - 1) * limit;
    const where: string[] = [];
    const values: unknown[] = [];

    if (input.q) {
      values.push(`%${input.q.trim()}%`);
      where.push(`(scenario_key ILIKE $${values.length} OR title ILIKE $${values.length})`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.databaseService.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM qa_scenarios ${whereSql}`,
      values,
    );
    const result = await this.databaseService.db.query<QaScenarioRecord>(
      `
        SELECT *
        FROM qa_scenarios
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `,
      [...values, limit, offset],
    );
    return { items: result.rows, page, limit, total: Number(count.rows[0]?.count ?? 0) };
  }

  async findScenarioByIdOrKey(
    idOrKey: string,
    db: Queryable = this.databaseService.db,
  ): Promise<QaScenarioRecord | null> {
    const result = await db.query<QaScenarioRecord>(
      `
        SELECT *
        FROM qa_scenarios
        WHERE id::text = $1 OR scenario_key = $1
        LIMIT 1
      `,
      [idOrKey],
    );
    return result.rows[0] ?? null;
  }

  async getScenarioBundle(scenarioId: string): Promise<{
    scenario: QaScenarioRecord;
    phases: QaPhaseRecord[];
    checks: QaCheckRecord[];
    questions: QaQuestionRecord[];
  } | null> {
    const scenario = await this.findScenarioByIdOrKey(scenarioId);
    if (!scenario) return null;
    const [phases, checks, questions] = await Promise.all([
      this.listPhases(scenario.id),
      this.listChecks(scenario.id),
      this.listQuestions(scenario.id),
    ]);
    return { scenario, phases, checks, questions };
  }

  async createRun(input: {
    scenario: QaScenarioRecord;
    snapshot: Record<string, unknown>;
    testerId: string;
    testerName: string;
    environment?: string;
    deviceType?: string;
    browser?: string;
    os?: string;
    screenSize?: string;
    buildVersion?: string;
    testRound?: string;
    notes?: string;
  }): Promise<QaRunRecord> {
    const result = await this.databaseService.db.query<QaRunRecord>(
      `
        INSERT INTO qa_runs (
          id,
          scenario_id,
          scenario_key,
          scenario_version,
          scenario_checksum,
          scenario_snapshot,
          tester_id,
          tester_name,
          status,
          progress_percent,
          environment,
          device_type,
          browser,
          os,
          screen_size,
          build_version,
          test_round,
          notes,
          started_at,
          last_saved_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'in_progress', 0, $9, $10, $11, $12, $13, $14, $15, $16, NOW(), NOW(), NOW(), NOW())
        RETURNING *
      `,
      [
        uuidv4(),
        input.scenario.id,
        input.scenario.scenario_key,
        input.scenario.version,
        input.scenario.checksum,
        toJsonb(input.snapshot),
        input.testerId,
        input.testerName,
        input.environment ?? null,
        input.deviceType ?? null,
        input.browser ?? null,
        input.os ?? null,
        input.screenSize ?? null,
        input.buildVersion ?? null,
        input.testRound ?? null,
        input.notes ?? null,
      ],
    );
    return result.rows[0] as QaRunRecord;
  }

  async listRuns(input: {
    page?: number;
    limit?: number;
    scenarioId?: string;
    status?: QaRunStatus;
    testerId?: string;
    canReadAll: boolean;
  }): Promise<PageResult<QaRunRecord>> {
    const page = normalizePage(input.page);
    const limit = normalizeLimit(input.limit);
    const offset = (page - 1) * limit;
    const where: string[] = [];
    const values: unknown[] = [];

    if (input.scenarioId) {
      values.push(input.scenarioId);
      where.push(`(scenario_id::text = $${values.length} OR scenario_key = $${values.length})`);
    }
    if (input.status) {
      values.push(input.status);
      where.push(`status = $${values.length}`);
    }
    if (!input.canReadAll) {
      values.push(input.testerId);
      where.push(`tester_id = $${values.length}`);
    }

    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.databaseService.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM qa_runs ${whereSql}`,
      values,
    );
    const result = await this.databaseService.db.query<QaRunRecord>(
      `
        SELECT *
        FROM qa_runs
        ${whereSql}
        ORDER BY updated_at DESC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `,
      [...values, limit, offset],
    );
    return { items: result.rows, page, limit, total: Number(count.rows[0]?.count ?? 0) };
  }

  async findOpenRun(scenarioIdOrKey: string, testerId: string): Promise<QaRunRecord | null> {
    const result = await this.databaseService.db.query<QaRunRecord>(
      `
        SELECT *
        FROM qa_runs
        WHERE tester_id = $1
          AND (scenario_id::text = $2 OR scenario_key = $2)
          AND status IN ('draft', 'in_progress', 'paused', 'blocked')
        ORDER BY updated_at DESC
        LIMIT 1
      `,
      [testerId, scenarioIdOrKey],
    );
    return result.rows[0] ?? null;
  }

  async findRunById(runId: string): Promise<QaRunRecord | null> {
    const result = await this.databaseService.db.query<QaRunRecord>(
      'SELECT * FROM qa_runs WHERE id = $1 LIMIT 1',
      [runId],
    );
    return result.rows[0] ?? null;
  }

  async listAnswers(
    runId: string,
    db: Queryable = this.databaseService.db,
  ): Promise<QaAnswerRecord[]> {
    const result = await db.query<QaAnswerRecord>(
      'SELECT * FROM qa_answers WHERE run_id = $1 ORDER BY updated_at ASC',
      [runId],
    );
    return result.rows;
  }

  async listRunIssues(runId: string): Promise<QaIssueRecord[]> {
    const result = await this.databaseService.db.query<QaIssueRecord>(
      'SELECT * FROM qa_issues WHERE run_id = $1 ORDER BY created_at DESC',
      [runId],
    );
    return result.rows;
  }

  async listRunAttachments(runId: string): Promise<QaAttachmentRecord[]> {
    const result = await this.databaseService.db.query<QaAttachmentRecord>(
      'SELECT * FROM qa_attachments WHERE run_id = $1 ORDER BY created_at DESC',
      [runId],
    );
    return result.rows;
  }

  async findAttachmentById(attachmentId: string): Promise<QaAttachmentRecord | null> {
    const result = await this.databaseService.db.query<QaAttachmentRecord>(
      'SELECT * FROM qa_attachments WHERE id = $1 LIMIT 1',
      [attachmentId],
    );
    return result.rows[0] ?? null;
  }

  async upsertAnswer(
    input: {
      run: QaRunRecord;
      phaseId: string;
      checkId?: string;
      questionId?: string;
      targetKey: string;
      status?: string;
      value?: Record<string, unknown>;
      note?: string;
      rating?: number;
      answeredBy: string;
    },
    db: Queryable = this.databaseService.db,
  ): Promise<QaAnswerRecord> {
    const result = await db.query<QaAnswerRecord>(
      `
        INSERT INTO qa_answers (
          id,
          run_id,
          scenario_id,
          phase_id,
          check_id,
          question_id,
          answer_target_key,
          status,
          value,
          note,
          rating,
          answered_by,
          answered_at,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW(), NOW())
        ON CONFLICT (run_id, answer_target_key)
        DO UPDATE SET
          phase_id = EXCLUDED.phase_id,
          check_id = EXCLUDED.check_id,
          question_id = EXCLUDED.question_id,
          status = EXCLUDED.status,
          value = EXCLUDED.value,
          note = EXCLUDED.note,
          rating = EXCLUDED.rating,
          answered_by = EXCLUDED.answered_by,
          answered_at = NOW(),
          updated_at = NOW()
        RETURNING *
      `,
      [
        uuidv4(),
        input.run.id,
        input.run.scenario_id,
        input.phaseId,
        input.checkId ?? null,
        input.questionId ?? null,
        input.targetKey,
        input.status ?? null,
        input.value ? toJsonb(input.value) : null,
        input.note ?? null,
        input.rating ?? null,
        input.answeredBy,
      ],
    );
    return result.rows[0] as QaAnswerRecord;
  }

  async updateRunProgress(
    input: {
      runId: string;
      status?: QaRunStatus;
      currentPhaseId?: string | null;
      currentPhaseKey?: string | null;
      currentCheckId?: string | null;
      currentCheckKey?: string | null;
      progressPercent: number;
      notes?: string | null;
      completedBy?: string;
    },
    db: Queryable = this.databaseService.db,
  ): Promise<QaRunRecord> {
    const completed = input.status === 'completed';
    const result = await db.query<QaRunRecord>(
      `
        UPDATE qa_runs
        SET
          status = COALESCE($2, status),
          current_phase_id = COALESCE($3, current_phase_id),
          current_phase_key = COALESCE($4, current_phase_key),
          current_check_id = COALESCE($5, current_check_id),
          current_check_key = COALESCE($6, current_check_key),
          progress_percent = $7,
          notes = COALESCE($8, notes),
          last_saved_at = NOW(),
          completed_at = CASE WHEN $9 THEN NOW() ELSE completed_at END,
          locked_at = CASE WHEN $9 THEN NOW() ELSE locked_at END,
          locked_by = CASE WHEN $9 THEN $10 ELSE locked_by END,
          updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        input.runId,
        input.status ?? null,
        input.currentPhaseId ?? null,
        input.currentPhaseKey ?? null,
        input.currentCheckId ?? null,
        input.currentCheckKey ?? null,
        input.progressPercent,
        input.notes ?? null,
        completed,
        input.completedBy ?? null,
      ],
    );
    return result.rows[0] as QaRunRecord;
  }

  async reopenRun(runId: string): Promise<QaRunRecord | null> {
    const result = await this.databaseService.db.query<QaRunRecord>(
      `
        UPDATE qa_runs
        SET status = 'in_progress',
            locked_at = NULL,
            locked_by = NULL,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [runId],
    );
    return result.rows[0] ?? null;
  }

  async createIssue(input: {
    run: QaRunRecord;
    phaseId?: string;
    checkId?: string;
    questionId?: string;
    title: string;
    description?: string;
    stepsToReproduce?: string;
    expectedResult?: string;
    actualResult?: string;
    severity: string;
    category: string;
    isBlocking?: boolean;
    createdBy: string;
  }): Promise<QaIssueRecord> {
    const result = await this.databaseService.db.query<QaIssueRecord>(
      `
        INSERT INTO qa_issues (
          id,
          run_id,
          scenario_id,
          phase_id,
          check_id,
          question_id,
          title,
          description,
          steps_to_reproduce,
          expected_result,
          actual_result,
          severity,
          category,
          status,
          is_blocking,
          created_by,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 'open', $14, $15, NOW(), NOW())
        RETURNING *
      `,
      [
        uuidv4(),
        input.run.id,
        input.run.scenario_id,
        input.phaseId ?? null,
        input.checkId ?? null,
        input.questionId ?? null,
        input.title,
        input.description ?? null,
        input.stepsToReproduce ?? null,
        input.expectedResult ?? null,
        input.actualResult ?? null,
        input.severity,
        input.category,
        input.isBlocking ?? false,
        input.createdBy,
      ],
    );
    return result.rows[0] as QaIssueRecord;
  }

  async updateIssue(
    issueId: string,
    input: {
      title?: string;
      description?: string;
      severity?: string;
      category?: string;
      status?: string;
      isBlocking?: boolean;
    },
  ): Promise<QaIssueRecord | null> {
    const setParts: string[] = [];
    const values: unknown[] = [issueId];
    let idx = 2;
    const append = (field: string, value: unknown) => {
      setParts.push(`${field} = $${idx}`);
      values.push(value);
      idx += 1;
    };
    if (input.title !== undefined) append('title', input.title);
    if (input.description !== undefined) append('description', input.description);
    if (input.severity !== undefined) append('severity', input.severity);
    if (input.category !== undefined) append('category', input.category);
    if (input.status !== undefined) append('status', input.status);
    if (input.isBlocking !== undefined) append('is_blocking', input.isBlocking);
    append('updated_at', new Date());

    const result = await this.databaseService.db.query<QaIssueRecord>(
      `UPDATE qa_issues SET ${setParts.join(', ')} WHERE id = $1 RETURNING *`,
      values,
    );
    return result.rows[0] ?? null;
  }

  async listIssues(input: {
    page?: number;
    limit?: number;
    q?: string;
    runId?: string;
    scenarioId?: string;
    phaseId?: string;
    category?: string;
    severity?: string;
    status?: string;
    isBlocking?: string;
  }): Promise<PageResult<QaIssueRecord>> {
    const page = normalizePage(input.page);
    const limit = normalizeLimit(input.limit);
    const offset = (page - 1) * limit;
    const where: string[] = [];
    const values: unknown[] = [];
    if (input.runId) {
      values.push(input.runId);
      where.push(`run_id = $${values.length}`);
    }
    if (input.q) {
      values.push(`%${input.q}%`);
      where.push(`(title ILIKE $${values.length} OR description ILIKE $${values.length})`);
    }
    if (input.scenarioId) {
      values.push(input.scenarioId);
      where.push(`scenario_id::text = $${values.length}`);
    }
    if (input.phaseId) {
      values.push(input.phaseId);
      where.push(`phase_id = $${values.length}`);
    }
    if (input.category) {
      values.push(input.category);
      where.push(`category = $${values.length}`);
    }
    if (input.severity) {
      values.push(input.severity);
      where.push(`severity = $${values.length}`);
    }
    if (input.status) {
      values.push(input.status);
      where.push(`status = $${values.length}`);
    }
    if (input.isBlocking) {
      values.push(input.isBlocking === 'true');
      where.push(`is_blocking = $${values.length}`);
    }
    const whereSql = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const count = await this.databaseService.db.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM qa_issues ${whereSql}`,
      values,
    );
    const result = await this.databaseService.db.query<QaIssueRecord>(
      `
        SELECT *
        FROM qa_issues
        ${whereSql}
        ORDER BY created_at DESC
        LIMIT $${values.length + 1}
        OFFSET $${values.length + 2}
      `,
      [...values, limit, offset],
    );
    return { items: result.rows, page, limit, total: Number(count.rows[0]?.count ?? 0) };
  }

  async findIssueById(issueId: string): Promise<QaIssueRecord | null> {
    const result = await this.databaseService.db.query<QaIssueRecord>(
      'SELECT * FROM qa_issues WHERE id = $1 LIMIT 1',
      [issueId],
    );
    return result.rows[0] ?? null;
  }

  async createAttachment(input: {
    run: QaRunRecord;
    issueId?: string;
    phaseId?: string;
    checkId?: string;
    questionId?: string;
    targetType: string;
    bucketName: string;
    objectKey: string;
    mimeType: string;
    fileSizeBytes: number;
    etag?: string | null;
    fileName?: string;
    uploadedBy: string;
    metadata?: Record<string, unknown>;
  }): Promise<QaAttachmentRecord> {
    const result = await this.databaseService.db.query<QaAttachmentRecord>(
      `
        INSERT INTO qa_attachments (
          id,
          run_id,
          scenario_id,
          issue_id,
          phase_id,
          check_id,
          question_id,
          target_type,
          bucket_name,
          object_key,
          mime_type,
          file_size_bytes,
          etag,
          file_name,
          uploaded_by,
          confirmed_at,
          metadata,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NOW(), $16, NOW(), NOW())
        RETURNING *
      `,
      [
        uuidv4(),
        input.run.id,
        input.run.scenario_id,
        input.issueId ?? null,
        input.phaseId ?? null,
        input.checkId ?? null,
        input.questionId ?? null,
        input.targetType,
        input.bucketName,
        input.objectKey,
        input.mimeType,
        input.fileSizeBytes,
        input.etag ?? null,
        input.fileName ?? null,
        input.uploadedBy,
        toJsonb(input.metadata ?? {}),
      ],
    );
    return result.rows[0] as QaAttachmentRecord;
  }

  async upsertSummary(
    input: {
      runId: string;
      totalChecks: number;
      passedChecks: number;
      failedChecks: number;
      blockedChecks: number;
      notApplicableChecks: number;
      successPercent: number;
      readinessStatus: string;
      issuesCount: number;
      criticalIssuesCount: number;
      highIssuesCount: number;
      mostProblematicPhaseId: string | null;
      summary: Record<string, unknown>;
    },
    db: Queryable = this.databaseService.db,
  ): Promise<QaRunSummaryRecord> {
    const result = await db.query<QaRunSummaryRecord>(
      `
        INSERT INTO qa_run_summaries (
          id,
          run_id,
          total_checks,
          passed_checks,
          failed_checks,
          blocked_checks,
          not_applicable_checks,
          success_percent,
          readiness_status,
          issues_count,
          critical_issues_count,
          high_issues_count,
          most_problematic_phase_id,
          summary,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW(), NOW())
        ON CONFLICT (run_id)
        DO UPDATE SET
          total_checks = EXCLUDED.total_checks,
          passed_checks = EXCLUDED.passed_checks,
          failed_checks = EXCLUDED.failed_checks,
          blocked_checks = EXCLUDED.blocked_checks,
          not_applicable_checks = EXCLUDED.not_applicable_checks,
          success_percent = EXCLUDED.success_percent,
          readiness_status = EXCLUDED.readiness_status,
          issues_count = EXCLUDED.issues_count,
          critical_issues_count = EXCLUDED.critical_issues_count,
          high_issues_count = EXCLUDED.high_issues_count,
          most_problematic_phase_id = EXCLUDED.most_problematic_phase_id,
          summary = EXCLUDED.summary,
          updated_at = NOW()
        RETURNING *
      `,
      [
        uuidv4(),
        input.runId,
        input.totalChecks,
        input.passedChecks,
        input.failedChecks,
        input.blockedChecks,
        input.notApplicableChecks,
        input.successPercent,
        input.readinessStatus,
        input.issuesCount,
        input.criticalIssuesCount,
        input.highIssuesCount,
        input.mostProblematicPhaseId,
        toJsonb(input.summary),
      ],
    );
    return result.rows[0] as QaRunSummaryRecord;
  }

  async getSummary(runId: string): Promise<QaRunSummaryRecord | null> {
    const result = await this.databaseService.db.query<QaRunSummaryRecord>(
      'SELECT * FROM qa_run_summaries WHERE run_id = $1 LIMIT 1',
      [runId],
    );
    return result.rows[0] ?? null;
  }

  async getDashboard(input: QaDashboardQueryDto = {}) {
    const runsFilter = this.buildDashboardRunFilter(input, 'r');
    const issueFilter = this.buildDashboardRunFilter(input, 'r');
    const summaryFilter = this.buildDashboardRunFilter(input, 'r');

    const [
      overviewRuns,
      overviewScore,
      overviewIssues,
      scenarioComparison,
      phaseAnalytics,
      issueSeverity,
      issueCategory,
      recurringIssues,
      testerComparison,
      recentRuns,
      recentIssues,
    ] = await Promise.all([
      this.databaseService.db.query<{
        total: string;
        completed: string;
        in_progress: string;
        blocked: string;
        cancelled: string;
      }>(
        `
          SELECT
            COUNT(*)::text AS total,
            COUNT(*) FILTER (WHERE r.status = 'completed')::text AS completed,
            COUNT(*) FILTER (WHERE r.status IN ('draft', 'in_progress', 'paused'))::text AS in_progress,
            COUNT(*) FILTER (WHERE r.status = 'blocked')::text AS blocked,
            COUNT(*) FILTER (WHERE r.status = 'cancelled')::text AS cancelled
          FROM qa_runs r
          ${runsFilter.whereSql}
        `,
        runsFilter.values,
      ),
      this.databaseService.db.query<{
        average_readiness_score: string | null;
        average_ux_rating: string | null;
        ready: string;
        ready_with_fixes: string;
        not_ready: string;
      }>(
        `
          SELECT
            AVG(COALESCE((s.summary->>'readinessScore')::numeric, s.success_percent))::text AS average_readiness_score,
            (SELECT AVG(a.rating)::text FROM qa_answers a INNER JOIN qa_runs r ON r.id = a.run_id ${runsFilter.whereSql} AND a.rating IS NOT NULL) AS average_ux_rating,
            COUNT(*) FILTER (WHERE s.readiness_status = 'ready')::text AS ready,
            COUNT(*) FILTER (WHERE s.readiness_status = 'ready_with_fixes')::text AS ready_with_fixes,
            COUNT(*) FILTER (WHERE s.readiness_status IN ('not_ready', 'blocked'))::text AS not_ready
          FROM qa_run_summaries s
          INNER JOIN qa_runs r ON r.id = s.run_id
          ${summaryFilter.whereSql}
        `,
        summaryFilter.values,
      ),
      this.databaseService.db.query<{ critical: string; high: string; blocking: string }>(
        `
          SELECT
            COUNT(*) FILTER (WHERE i.severity = 'critical')::text AS critical,
            COUNT(*) FILTER (WHERE i.severity = 'high')::text AS high,
            COUNT(*) FILTER (WHERE i.is_blocking = TRUE)::text AS blocking
          FROM qa_issues i
          INNER JOIN qa_runs r ON r.id = i.run_id
          ${issueFilter.whereSql}
        `,
        issueFilter.values,
      ),
      this.databaseService.db.query<{
        scenario_id: string;
        scenario_key: string;
        scenario_title: string;
        runs: string;
        completed_runs: string;
        average_readiness_score: string | null;
        fail_count: string;
        blocked_count: string;
        answer_count: string;
        critical_issues: string;
        high_issues: string;
      }>(
        `
          WITH filtered_runs AS (
            SELECT r.* FROM qa_runs r ${runsFilter.whereSql}
          ),
          answers AS (
            SELECT
              r.scenario_id,
              COUNT(*) FILTER (WHERE a.status = 'fail')::int AS fail_count,
              COUNT(*) FILTER (WHERE a.status = 'blocked')::int AS blocked_count,
              COUNT(*)::int AS answer_count
            FROM filtered_runs r
            LEFT JOIN qa_answers a ON a.run_id = r.id AND a.check_id IS NOT NULL
            GROUP BY r.scenario_id
          ),
          issues AS (
            SELECT
              r.scenario_id,
              COUNT(*) FILTER (WHERE i.severity = 'critical')::int AS critical_issues,
              COUNT(*) FILTER (WHERE i.severity = 'high')::int AS high_issues
            FROM filtered_runs r
            LEFT JOIN qa_issues i ON i.run_id = r.id
            GROUP BY r.scenario_id
          )
          SELECT
            s.id::text AS scenario_id,
            s.scenario_key,
            COALESCE(s.title_ar, s.title) AS scenario_title,
            COUNT(r.id)::text AS runs,
            COUNT(r.id) FILTER (WHERE r.status = 'completed')::text AS completed_runs,
            AVG(COALESCE((rs.summary->>'readinessScore')::numeric, rs.success_percent))::text AS average_readiness_score,
            COALESCE(MAX(a.fail_count), 0)::text AS fail_count,
            COALESCE(MAX(a.blocked_count), 0)::text AS blocked_count,
            COALESCE(MAX(a.answer_count), 0)::text AS answer_count,
            COALESCE(MAX(i.critical_issues), 0)::text AS critical_issues,
            COALESCE(MAX(i.high_issues), 0)::text AS high_issues
          FROM filtered_runs r
          INNER JOIN qa_scenarios s ON s.id = r.scenario_id
          LEFT JOIN qa_run_summaries rs ON rs.run_id = r.id
          LEFT JOIN answers a ON a.scenario_id = r.scenario_id
          LEFT JOIN issues i ON i.scenario_id = r.scenario_id
          GROUP BY s.id, s.scenario_key, s.title_ar, s.title
          ORDER BY runs DESC, scenario_title ASC
        `,
        runsFilter.values,
      ),
      this.databaseService.db.query<{
        phase_id: string;
        phase_title: string;
        scenario_id: string;
        total_checks: string;
        pass_count: string;
        fail_count: string;
        blocked_count: string;
        na_count: string;
        average_rating: string | null;
      }>(
        `
          SELECT
            p.id::text AS phase_id,
            p.title AS phase_title,
            r.scenario_key AS scenario_id,
            COUNT(a.id)::text AS total_checks,
            COUNT(a.id) FILTER (WHERE a.status = 'pass')::text AS pass_count,
            COUNT(a.id) FILTER (WHERE a.status = 'fail')::text AS fail_count,
            COUNT(a.id) FILTER (WHERE a.status = 'blocked')::text AS blocked_count,
            COUNT(a.id) FILTER (WHERE a.status = 'not_applicable')::text AS na_count,
            AVG(a.rating)::text AS average_rating
          FROM qa_answers a
          INNER JOIN qa_runs r ON r.id = a.run_id
          INNER JOIN qa_phases p ON p.id = a.phase_id
          ${runsFilter.whereSql}
            AND a.check_id IS NOT NULL
          GROUP BY p.id, p.title, r.scenario_key
          ORDER BY fail_count DESC, blocked_count DESC, average_rating ASC NULLS LAST
          LIMIT 25
        `,
        runsFilter.values,
      ),
      this.databaseService.db.query<{ severity: string; count: string }>(
        `
          SELECT i.severity, COUNT(*)::text AS count
          FROM qa_issues i
          INNER JOIN qa_runs r ON r.id = i.run_id
          ${issueFilter.whereSql}
          GROUP BY i.severity
          ORDER BY count DESC
        `,
        issueFilter.values,
      ),
      this.databaseService.db.query<{ category: string; count: string }>(
        `
          SELECT i.category, COUNT(*)::text AS count
          FROM qa_issues i
          INNER JOIN qa_runs r ON r.id = i.run_id
          ${issueFilter.whereSql}
          GROUP BY i.category
          ORDER BY count DESC
        `,
        issueFilter.values,
      ),
      this.databaseService.db.query<{
        title: string;
        count: string;
        severity: string;
        category: string;
      }>(
        `
          SELECT i.title, COUNT(*)::text AS count, MAX(i.severity) AS severity, MAX(i.category) AS category
          FROM qa_issues i
          INNER JOIN qa_runs r ON r.id = i.run_id
          ${issueFilter.whereSql}
          GROUP BY i.title
          HAVING COUNT(*) > 1
          ORDER BY COUNT(*) DESC, i.title ASC
          LIMIT 10
        `,
        issueFilter.values,
      ),
      this.databaseService.db.query<{
        tester_id: string | null;
        tester_name: string | null;
        runs: string;
        completed_runs: string;
        average_readiness_score: string | null;
        issues_reported: string;
        blocking_issues_reported: string;
      }>(
        `
          SELECT
            r.tester_id::text,
            r.tester_name,
            COUNT(DISTINCT r.id)::text AS runs,
            COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'completed')::text AS completed_runs,
            AVG(COALESCE((s.summary->>'readinessScore')::numeric, s.success_percent))::text AS average_readiness_score,
            COUNT(i.id)::text AS issues_reported,
            COUNT(i.id) FILTER (WHERE i.is_blocking = TRUE)::text AS blocking_issues_reported
          FROM qa_runs r
          LEFT JOIN qa_run_summaries s ON s.run_id = r.id
          LEFT JOIN qa_issues i ON i.run_id = r.id
          ${runsFilter.whereSql}
          GROUP BY r.tester_id, r.tester_name
          ORDER BY runs DESC
          LIMIT 25
        `,
        runsFilter.values,
      ),
      this.databaseService.db.query<QaRunRecord>(
        `SELECT r.* FROM qa_runs r ${runsFilter.whereSql} ORDER BY r.updated_at DESC LIMIT 10`,
        runsFilter.values,
      ),
      this.databaseService.db.query<QaIssueRecord>(
        `
          SELECT i.*
          FROM qa_issues i
          INNER JOIN qa_runs r ON r.id = i.run_id
          ${issueFilter.whereSql}
          ORDER BY i.created_at DESC
          LIMIT 10
        `,
        issueFilter.values,
      ),
    ]);

    const runRow = overviewRuns.rows[0];
    const scoreRow = overviewScore.rows[0];
    const issueRow = overviewIssues.rows[0];
    return {
      overview: {
        totalRuns: Number(runRow?.total ?? 0),
        completedRuns: Number(runRow?.completed ?? 0),
        inProgressRuns: Number(runRow?.in_progress ?? 0),
        blockedRuns: Number(runRow?.blocked ?? 0),
        cancelledRuns: Number(runRow?.cancelled ?? 0),
        averageReadinessScore: round2(scoreRow?.average_readiness_score),
        averageUxRating: round2(scoreRow?.average_ux_rating),
        criticalIssues: Number(issueRow?.critical ?? 0),
        highIssues: Number(issueRow?.high ?? 0),
        blockingIssues: Number(issueRow?.blocking ?? 0),
        readyRuns: Number(scoreRow?.ready ?? 0),
        readyWithFixesRuns: Number(scoreRow?.ready_with_fixes ?? 0),
        notReadyRuns: Number(scoreRow?.not_ready ?? 0),
      },
      scenarioComparison: scenarioComparison.rows.map((row) => ({
        scenarioId: row.scenario_id,
        scenarioKey: row.scenario_key,
        scenarioTitle: row.scenario_title,
        runs: Number(row.runs),
        completedRuns: Number(row.completed_runs),
        averageReadinessScore: round2(row.average_readiness_score),
        failRate: rate(row.fail_count, row.answer_count),
        blockedRate: rate(row.blocked_count, row.answer_count),
        criticalIssues: Number(row.critical_issues),
        highIssues: Number(row.high_issues),
      })),
      phaseAnalytics: phaseAnalytics.rows.map((row) => ({
        phaseId: row.phase_id,
        phaseTitle: row.phase_title,
        scenarioId: row.scenario_id,
        totalChecks: Number(row.total_checks),
        passCount: Number(row.pass_count),
        failCount: Number(row.fail_count),
        blockedCount: Number(row.blocked_count),
        naCount: Number(row.na_count),
        failRate: rate(row.fail_count, row.total_checks),
        blockedRate: rate(row.blocked_count, row.total_checks),
        averageRating: round2(row.average_rating),
      })),
      issueAnalytics: {
        bySeverity: issueSeverity.rows.map((row) => ({
          severity: row.severity,
          count: Number(row.count),
        })),
        byCategory: issueCategory.rows.map((row) => ({
          category: row.category,
          count: Number(row.count),
        })),
        topRecurringIssues: recurringIssues.rows.map((row) => ({
          title: row.title,
          count: Number(row.count),
          severity: row.severity,
          category: row.category,
        })),
      },
      testerComparison: testerComparison.rows.map((row) => ({
        testerId: row.tester_id,
        testerName: row.tester_name,
        runs: Number(row.runs),
        completedRuns: Number(row.completed_runs),
        averageReadinessScore: round2(row.average_readiness_score),
        issuesReported: Number(row.issues_reported),
        blockingIssuesReported: Number(row.blocking_issues_reported),
      })),
      recentRuns: recentRuns.rows,
      recentIssues: recentIssues.rows,
    };
  }

  private buildDashboardRunFilter(input: QaDashboardQueryDto, alias: string): SqlFilter {
    const values: unknown[] = [];
    const where: string[] = ['TRUE'];
    const runDate = `COALESCE(${alias}.started_at, ${alias}.created_at)`;
    if (input.from) {
      values.push(input.from);
      where.push(`${runDate} >= $${values.length}`);
    }
    if (input.until) {
      values.push(input.until);
      where.push(`${runDate} <= $${values.length}`);
    }
    if (input.scenarioId) {
      values.push(input.scenarioId);
      where.push(
        `(${alias}.scenario_id::text = $${values.length} OR ${alias}.scenario_key = $${values.length})`,
      );
    }
    if (input.testerId) {
      values.push(input.testerId);
      where.push(`${alias}.tester_id = $${values.length}`);
    }
    if (input.environment) {
      values.push(input.environment);
      where.push(`${alias}.environment = $${values.length}`);
    }
    if (input.status) {
      values.push(input.status);
      where.push(`${alias}.status = $${values.length}`);
    }
    if (input.round) {
      values.push(input.round);
      where.push(`${alias}.test_round = $${values.length}`);
    }
    if (input.buildVersion) {
      values.push(input.buildVersion);
      where.push(`${alias}.build_version = $${values.length}`);
    }
    return { whereSql: `WHERE ${where.join(' AND ')}`, values };
  }

  async findPhaseById(phaseId: string, scenarioId: string): Promise<QaPhaseRecord | null> {
    const result = await this.databaseService.db.query<QaPhaseRecord>(
      'SELECT * FROM qa_phases WHERE id = $1 AND scenario_id = $2 LIMIT 1',
      [phaseId, scenarioId],
    );
    return result.rows[0] ?? null;
  }

  async findCheckById(checkId: string, scenarioId: string): Promise<QaCheckRecord | null> {
    const result = await this.databaseService.db.query<QaCheckRecord>(
      'SELECT * FROM qa_checks WHERE id = $1 AND scenario_id = $2 LIMIT 1',
      [checkId, scenarioId],
    );
    return result.rows[0] ?? null;
  }

  async findQuestionById(questionId: string, scenarioId: string): Promise<QaQuestionRecord | null> {
    const result = await this.databaseService.db.query<QaQuestionRecord>(
      'SELECT * FROM qa_questions WHERE id = $1 AND scenario_id = $2 LIMIT 1',
      [questionId, scenarioId],
    );
    return result.rows[0] ?? null;
  }

  async countScenarioChecks(scenarioId: string): Promise<number> {
    const result = await this.databaseService.db.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM qa_checks WHERE scenario_id = $1',
      [scenarioId],
    );
    return Number(result.rows[0]?.count ?? 0);
  }

  async logRunEvent(
    input: {
      runId?: string | null;
      eventType: string;
      actorId?: string | null;
      metadata?: Record<string, unknown>;
    },
    db: Queryable = this.databaseService.db,
  ): Promise<void> {
    await db.query(
      `
        INSERT INTO qa_run_events (id, run_id, event_type, actor_id, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `,
      [
        uuidv4(),
        input.runId ?? null,
        input.eventType,
        input.actorId ?? null,
        toJsonb(input.metadata ?? {}),
      ],
    );
  }

  private async findScenarioByKey(
    scenarioKey: string,
    db: Queryable,
  ): Promise<QaScenarioRecord | null> {
    const result = await db.query<QaScenarioRecord>(
      'SELECT * FROM qa_scenarios WHERE scenario_key = $1 LIMIT 1',
      [scenarioKey],
    );
    return result.rows[0] ?? null;
  }

  private async createPhase(
    scenarioId: string,
    phase: NormalizedQaScenario['phases'][number],
    db: Queryable,
  ): Promise<QaPhaseRecord> {
    const result = await db.query<QaPhaseRecord>(
      `
        INSERT INTO qa_phases (
          id,
          scenario_id,
          phase_key,
          order_index,
          title,
          description,
          goal,
          instructions,
          metadata,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING *
      `,
      [
        uuidv4(),
        scenarioId,
        phase.phaseKey,
        phase.orderIndex,
        phase.title,
        phase.sourceTitle,
        phase.goal,
        toJsonb(phase.instructions),
        toJsonb(phase.metadata),
      ],
    );
    return result.rows[0] as QaPhaseRecord;
  }

  private async createCheck(
    scenarioId: string,
    phaseId: string,
    check: NormalizedQaScenario['phases'][number]['checks'][number],
    db: Queryable,
  ): Promise<void> {
    await db.query(
      `
        INSERT INTO qa_checks (
          id,
          scenario_id,
          phase_id,
          check_key,
          order_index,
          text,
          type,
          required,
          weight,
          expected_result,
          metadata,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
      `,
      [
        uuidv4(),
        scenarioId,
        phaseId,
        check.checkKey,
        check.orderIndex,
        check.text,
        check.type,
        check.required,
        check.weight,
        check.expectedResult,
        toJsonb(check.metadata),
      ],
    );
  }

  private async createQuestion(
    scenarioId: string,
    phaseId: string,
    question: NormalizedQaScenario['phases'][number]['questions'][number],
    db: Queryable,
  ): Promise<void> {
    await db.query(
      `
        INSERT INTO qa_questions (
          id,
          scenario_id,
          phase_id,
          question_key,
          order_index,
          text,
          type,
          required,
          options,
          metadata,
          created_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      `,
      [
        uuidv4(),
        scenarioId,
        phaseId,
        question.questionKey,
        question.orderIndex,
        question.text,
        question.type,
        question.required,
        question.options ? toJsonb(question.options) : null,
        toJsonb(question.metadata),
      ],
    );
  }

  private async listPhases(scenarioId: string): Promise<QaPhaseRecord[]> {
    const result = await this.databaseService.db.query<QaPhaseRecord>(
      'SELECT * FROM qa_phases WHERE scenario_id = $1 ORDER BY order_index ASC',
      [scenarioId],
    );
    return result.rows;
  }

  private async listChecks(scenarioId: string): Promise<QaCheckRecord[]> {
    const result = await this.databaseService.db.query<QaCheckRecord>(
      'SELECT * FROM qa_checks WHERE scenario_id = $1 ORDER BY phase_id ASC, order_index ASC',
      [scenarioId],
    );
    return result.rows;
  }

  private async listQuestions(scenarioId: string): Promise<QaQuestionRecord[]> {
    const result = await this.databaseService.db.query<QaQuestionRecord>(
      'SELECT * FROM qa_questions WHERE scenario_id = $1 ORDER BY phase_id ASC, order_index ASC',
      [scenarioId],
    );
    return result.rows;
  }
}

function normalizePage(value: number | undefined): number {
  return Number.isFinite(value) && value && value > 0 ? value : 1;
}

function normalizeLimit(value: number | undefined): number {
  return Number.isFinite(value) && value && value > 0 ? Math.min(value, 100) : 25;
}

function round2(value: string | number | null | undefined): number {
  const numberValue = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(numberValue) ? Math.round(numberValue * 100) / 100 : 0;
}

function rate(count: string | number, total: string | number): number {
  const countNumber = Number(count);
  const totalNumber = Number(total);
  if (!Number.isFinite(countNumber) || !Number.isFinite(totalNumber) || totalNumber <= 0) return 0;
  return Math.round((countNumber / totalNumber) * 10000) / 100;
}
