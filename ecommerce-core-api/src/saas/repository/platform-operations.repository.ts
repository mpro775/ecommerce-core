import { Injectable } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../../database/database.service';
import type {
  Queryable,
  PlatformSubscriptionRecord,
  PlatformIncidentRecord,
  PlatformAutomationRuleRecord,
  PlatformAutomationRunRecord,
  PlatformSupportCaseRecord,
  PlatformSupportCaseEventRecord,
  PlatformRiskViolationRecord,
  PlatformComplianceTaskRecord,
} from './types';

@Injectable()
export class PlatformOperationsRepository {
  constructor(private readonly databaseService: DatabaseService) {}

  async listPlatformIncidents(limit: number): Promise<PlatformIncidentRecord[]> {
    const result = await this.databaseService.db.query<PlatformIncidentRecord>(
      `
        SELECT
          i.id,
          i.type,
          i.severity,
          i.service,
          i.title,
          i.summary,
          i.status,
          i.related_store_id,
          i.created_by_admin_id,
          u.full_name AS created_by_name,
          i.created_at,
          i.resolved_at,
          i.updated_at
        FROM platform_incidents i
        LEFT JOIN platform_admin_users u
          ON u.id = i.created_by_admin_id
        ORDER BY i.created_at DESC
        LIMIT $1
      `,
      [limit],
    );
    return result.rows;
  }

  async createPlatformIncident(input: {
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    service: string;
    title: string;
    summary: string;
    status: 'open' | 'investigating' | 'mitigated' | 'resolved';
    relatedStoreId: string | null;
    createdByAdminId: string;
  }): Promise<PlatformIncidentRecord> {
    const result = await this.databaseService.db.query<PlatformIncidentRecord>(
      `
        INSERT INTO platform_incidents (
          id,
          type,
          severity,
          service,
          title,
          summary,
          status,
          related_store_id,
          created_by_admin_id,
          created_at,
          resolved_at,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), $10, NOW())
        RETURNING
          id,
          type,
          severity,
          service,
          title,
          summary,
          status,
          related_store_id,
          created_by_admin_id,
          NULL::text AS created_by_name,
          created_at,
          resolved_at,
          updated_at
      `,
      [
        uuidv4(),
        input.type,
        input.severity,
        input.service,
        input.title,
        input.summary,
        input.status,
        input.relatedStoreId,
        input.createdByAdminId,
        input.status === 'resolved' ? new Date() : null,
      ],
    );
    return result.rows[0] as PlatformIncidentRecord;
  }

  async updateIncidentStatus(input: {
    incidentId: string;
    status: 'open' | 'investigating' | 'mitigated' | 'resolved';
  }): Promise<PlatformIncidentRecord | null> {
    const result = await this.databaseService.db.query<PlatformIncidentRecord>(
      `
        UPDATE platform_incidents
        SET status = $2,
            resolved_at = CASE WHEN $2 = 'resolved' THEN NOW() ELSE NULL END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          type,
          severity,
          service,
          title,
          summary,
          status,
          related_store_id,
          created_by_admin_id,
          NULL::text AS created_by_name,
          created_at,
          resolved_at,
          updated_at
      `,
      [input.incidentId, input.status],
    );
    return result.rows[0] ?? null;
  }

  async listPlatformAutomationRules(): Promise<PlatformAutomationRuleRecord[]> {
    const result = await this.databaseService.db.query<PlatformAutomationRuleRecord>(
      `
        SELECT
          id,
          name,
          description,
          trigger_type,
          trigger_config,
          action_type,
          action_config,
          is_active,
          last_run_at,
          created_by_admin_id,
          updated_by_admin_id,
          created_at,
          updated_at
        FROM platform_automation_rules
        ORDER BY updated_at DESC
      `,
    );
    return result.rows;
  }

  async createPlatformAutomationRule(input: {
    name: string;
    description: string | null;
    triggerType: 'manual' | 'schedule' | 'event';
    triggerConfig: Record<string, unknown>;
    actionType: string;
    actionConfig: Record<string, unknown>;
    isActive: boolean;
    createdByAdminId: string;
  }): Promise<PlatformAutomationRuleRecord> {
    const result = await this.databaseService.db.query<PlatformAutomationRuleRecord>(
      `
        INSERT INTO platform_automation_rules (
          id, name, description, trigger_type, trigger_config, action_type, action_config,
          is_active, created_by_admin_id, updated_by_admin_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9, NOW(), NOW())
        RETURNING
          id,
          name,
          description,
          trigger_type,
          trigger_config,
          action_type,
          action_config,
          is_active,
          last_run_at,
          created_by_admin_id,
          updated_by_admin_id,
          created_at,
          updated_at
      `,
      [
        uuidv4(),
        input.name,
        input.description,
        input.triggerType,
        JSON.stringify(input.triggerConfig),
        input.actionType,
        JSON.stringify(input.actionConfig),
        input.isActive,
        input.createdByAdminId,
      ],
    );
    return result.rows[0] as PlatformAutomationRuleRecord;
  }

  async findPlatformAutomationRuleById(
    ruleId: string,
  ): Promise<PlatformAutomationRuleRecord | null> {
    const result = await this.databaseService.db.query<PlatformAutomationRuleRecord>(
      `
        SELECT
          id,
          name,
          description,
          trigger_type,
          trigger_config,
          action_type,
          action_config,
          is_active,
          last_run_at,
          created_by_admin_id,
          updated_by_admin_id,
          created_at,
          updated_at
        FROM platform_automation_rules
        WHERE id = $1
        LIMIT 1
      `,
      [ruleId],
    );
    return result.rows[0] ?? null;
  }

  async setPlatformAutomationRuleStatus(input: {
    ruleId: string;
    isActive: boolean;
    updatedByAdminId: string;
  }): Promise<PlatformAutomationRuleRecord | null> {
    const result = await this.databaseService.db.query<PlatformAutomationRuleRecord>(
      `
        UPDATE platform_automation_rules
        SET is_active = $2,
            updated_by_admin_id = $3,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          name,
          description,
          trigger_type,
          trigger_config,
          action_type,
          action_config,
          is_active,
          last_run_at,
          created_by_admin_id,
          updated_by_admin_id,
          created_at,
          updated_at
      `,
      [input.ruleId, input.isActive, input.updatedByAdminId],
    );
    return result.rows[0] ?? null;
  }

  async createPlatformAutomationRun(input: {
    ruleId: string;
    triggeredByAdminId: string;
    storeId: string | null;
    status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
    logs: string | null;
    metadata: Record<string, unknown>;
  }): Promise<PlatformAutomationRunRecord> {
    const now = new Date();
    const startedAt =
      input.status === 'running' || input.status === 'succeeded' || input.status === 'failed'
        ? now
        : null;
    const finishedAt =
      input.status === 'succeeded' || input.status === 'failed' || input.status === 'canceled'
        ? now
        : null;
    const result = await this.databaseService.db.query<PlatformAutomationRunRecord>(
      `
        INSERT INTO platform_automation_runs (
          id, rule_id, status, triggered_by_admin_id, store_id, started_at, finished_at, logs, metadata, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING
          id,
          rule_id,
          status,
          triggered_by_admin_id,
          store_id,
          started_at,
          finished_at,
          logs,
          metadata,
          created_at
      `,
      [
        uuidv4(),
        input.ruleId,
        input.status,
        input.triggeredByAdminId,
        input.storeId,
        startedAt,
        finishedAt,
        input.logs,
        JSON.stringify(input.metadata),
      ],
    );

    await this.databaseService.db.query(
      `
        UPDATE platform_automation_rules
        SET last_run_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
      `,
      [input.ruleId],
    );

    return result.rows[0] as PlatformAutomationRunRecord;
  }

  async updatePlatformAutomationRun(input: {
    runId: string;
    status: 'queued' | 'running' | 'succeeded' | 'failed' | 'canceled';
    logs?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<PlatformAutomationRunRecord | null> {
    const result = await this.databaseService.db.query<PlatformAutomationRunRecord>(
      `
        UPDATE platform_automation_runs
        SET status = $2,
            started_at = CASE
              WHEN $2 IN ('running', 'succeeded', 'failed')
              THEN COALESCE(started_at, NOW())
              ELSE started_at
            END,
            finished_at = CASE
              WHEN $2 IN ('succeeded', 'failed', 'canceled') THEN NOW()
              ELSE NULL
            END,
            logs = COALESCE($3, logs),
            metadata = COALESCE($4::jsonb, metadata)
        WHERE id = $1
        RETURNING
          id,
          rule_id,
          status,
          triggered_by_admin_id,
          store_id,
          started_at,
          finished_at,
          logs,
          metadata,
          created_at
      `,
      [
        input.runId,
        input.status,
        input.logs ?? null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
    return result.rows[0] ?? null;
  }

  async listPlatformAutomationRuns(limit: number): Promise<PlatformAutomationRunRecord[]> {
    const result = await this.databaseService.db.query<PlatformAutomationRunRecord>(
      `
        SELECT
          id,
          rule_id,
          status,
          triggered_by_admin_id,
          store_id,
          started_at,
          finished_at,
          logs,
          metadata,
          created_at
        FROM platform_automation_runs
        ORDER BY created_at DESC
        LIMIT $1
      `,
      [limit],
    );
    return result.rows;
  }

  async listPlatformSupportCases(limit: number): Promise<PlatformSupportCaseRecord[]> {
    const result = await this.databaseService.db.query<PlatformSupportCaseRecord>(
      `
        SELECT
          c.id,
          c.store_id,
          c.subject,
          c.description,
          c.priority,
          c.status,
          c.queue,
          c.assignee_admin_id,
          assignee.full_name AS assignee_name,
          c.sla_due_at,
          c.impact_score,
          c.created_by_admin_id,
          creator.full_name AS created_by_name,
          c.resolved_at,
          c.created_at,
          c.updated_at
        FROM platform_support_cases c
        LEFT JOIN platform_admin_users assignee
          ON assignee.id = c.assignee_admin_id
        LEFT JOIN platform_admin_users creator
          ON creator.id = c.created_by_admin_id
        ORDER BY c.updated_at DESC
        LIMIT $1
      `,
      [limit],
    );
    return result.rows;
  }

  async findPlatformSupportCaseById(caseId: string): Promise<PlatformSupportCaseRecord | null> {
    const result = await this.databaseService.db.query<PlatformSupportCaseRecord>(
      `
        SELECT
          c.id,
          c.store_id,
          c.subject,
          c.description,
          c.priority,
          c.status,
          c.queue,
          c.assignee_admin_id,
          assignee.full_name AS assignee_name,
          c.sla_due_at,
          c.impact_score,
          c.created_by_admin_id,
          creator.full_name AS created_by_name,
          c.resolved_at,
          c.created_at,
          c.updated_at
        FROM platform_support_cases c
        LEFT JOIN platform_admin_users assignee
          ON assignee.id = c.assignee_admin_id
        LEFT JOIN platform_admin_users creator
          ON creator.id = c.created_by_admin_id
        WHERE c.id = $1
        LIMIT 1
      `,
      [caseId],
    );
    return result.rows[0] ?? null;
  }

  async createPlatformSupportCase(input: {
    storeId: string | null;
    subject: string;
    description: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
    status: 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';
    queue: string;
    assigneeAdminId: string | null;
    impactScore: number;
    createdByAdminId: string;
  }): Promise<PlatformSupportCaseRecord> {
    const result = await this.databaseService.db.query<PlatformSupportCaseRecord>(
      `
        INSERT INTO platform_support_cases (
          id, store_id, subject, description, priority, status, queue,
          assignee_admin_id, impact_score, created_by_admin_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
        RETURNING
          id,
          store_id,
          subject,
          description,
          priority,
          status,
          queue,
          assignee_admin_id,
          NULL::text AS assignee_name,
          sla_due_at,
          impact_score,
          created_by_admin_id,
          NULL::text AS created_by_name,
          resolved_at,
          created_at,
          updated_at
      `,
      [
        uuidv4(),
        input.storeId,
        input.subject,
        input.description,
        input.priority,
        input.status,
        input.queue,
        input.assigneeAdminId,
        input.impactScore,
        input.createdByAdminId,
      ],
    );
    return result.rows[0] as PlatformSupportCaseRecord;
  }

  async updatePlatformSupportCase(input: {
    caseId: string;
    status?: 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';
    assigneeAdminId?: string;
    queue?: string;
  }): Promise<PlatformSupportCaseRecord | null> {
    const updates: string[] = [];
    const values: unknown[] = [input.caseId];
    let i = 2;

    if (input.status !== undefined) {
      updates.push(`status = $${i}`);
      values.push(input.status);
      i += 1;
      updates.push(
        `resolved_at = CASE WHEN $${i - 1} IN ('resolved', 'closed') THEN NOW() ELSE NULL END`,
      );
    }
    if (input.assigneeAdminId !== undefined) {
      updates.push(`assignee_admin_id = $${i}`);
      values.push(input.assigneeAdminId);
      i += 1;
    }
    if (input.queue !== undefined) {
      updates.push(`queue = $${i}`);
      values.push(input.queue);
      i += 1;
    }
    if (updates.length === 0) {
      return null;
    }

    updates.push('updated_at = NOW()');
    const result = await this.databaseService.db.query<PlatformSupportCaseRecord>(
      `
        UPDATE platform_support_cases
        SET ${updates.join(', ')}
        WHERE id = $1
        RETURNING
          id,
          store_id,
          subject,
          description,
          priority,
          status,
          queue,
          assignee_admin_id,
          NULL::text AS assignee_name,
          sla_due_at,
          impact_score,
          created_by_admin_id,
          NULL::text AS created_by_name,
          resolved_at,
          created_at,
          updated_at
      `,
      values,
    );
    return result.rows[0] ?? null;
  }

  async createPlatformSupportCaseEvent(input: {
    caseId: string;
    eventType: string;
    actorAdminId: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    await this.databaseService.db.query(
      `
        INSERT INTO platform_support_case_events (id, case_id, event_type, actor_admin_id, payload, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
      `,
      [uuidv4(), input.caseId, input.eventType, input.actorAdminId, JSON.stringify(input.payload)],
    );
  }

  async listPlatformSupportCaseEvents(caseId: string): Promise<PlatformSupportCaseEventRecord[]> {
    const result = await this.databaseService.db.query<PlatformSupportCaseEventRecord>(
      `
        SELECT
          e.id,
          e.case_id,
          e.event_type,
          e.actor_admin_id,
          u.full_name AS actor_name,
          e.payload,
          e.created_at
        FROM platform_support_case_events e
        LEFT JOIN platform_admin_users u
          ON u.id = e.actor_admin_id
        WHERE e.case_id = $1
        ORDER BY e.created_at ASC
      `,
      [caseId],
    );
    return result.rows;
  }

  async listPlatformRiskViolations(limit: number): Promise<PlatformRiskViolationRecord[]> {
    const result = await this.databaseService.db.query<PlatformRiskViolationRecord>(
      `
        SELECT
          v.id,
          v.store_id,
          v.category,
          v.severity,
          v.score,
          v.status,
          v.summary,
          v.details,
          v.detected_at,
          v.resolved_at,
          v.owner_admin_id,
          owner.full_name AS owner_name,
          v.created_at,
          v.updated_at
        FROM platform_risk_violations v
        LEFT JOIN platform_admin_users owner
          ON owner.id = v.owner_admin_id
        ORDER BY v.updated_at DESC
        LIMIT $1
      `,
      [limit],
    );
    return result.rows;
  }

  async findPlatformRiskViolationById(
    violationId: string,
  ): Promise<PlatformRiskViolationRecord | null> {
    const result = await this.databaseService.db.query<PlatformRiskViolationRecord>(
      `
        SELECT
          v.id,
          v.store_id,
          v.category,
          v.severity,
          v.score,
          v.status,
          v.summary,
          v.details,
          v.detected_at,
          v.resolved_at,
          v.owner_admin_id,
          owner.full_name AS owner_name,
          v.created_at,
          v.updated_at
        FROM platform_risk_violations v
        LEFT JOIN platform_admin_users owner
          ON owner.id = v.owner_admin_id
        WHERE v.id = $1
        LIMIT 1
      `,
      [violationId],
    );
    return result.rows[0] ?? null;
  }

  async createPlatformRiskViolation(input: {
    storeId: string | null;
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    score: number;
    status: 'open' | 'investigating' | 'mitigated' | 'accepted' | 'resolved';
    summary: string;
    details: Record<string, unknown>;
    ownerAdminId: string | null;
  }): Promise<PlatformRiskViolationRecord> {
    const result = await this.databaseService.db.query<PlatformRiskViolationRecord>(
      `
        INSERT INTO platform_risk_violations (
          id, store_id, category, severity, score, status, summary, details,
          detected_at, resolved_at, owner_admin_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), $9, $10, NOW(), NOW())
        RETURNING
          id,
          store_id,
          category,
          severity,
          score,
          status,
          summary,
          details,
          detected_at,
          resolved_at,
          owner_admin_id,
          NULL::text AS owner_name,
          created_at,
          updated_at
      `,
      [
        uuidv4(),
        input.storeId,
        input.category,
        input.severity,
        input.score,
        input.status,
        input.summary,
        JSON.stringify(input.details),
        input.status === 'resolved' ? new Date() : null,
        input.ownerAdminId,
      ],
    );
    return result.rows[0] as PlatformRiskViolationRecord;
  }

  async updatePlatformRiskViolationStatus(input: {
    violationId: string;
    status: 'open' | 'investigating' | 'mitigated' | 'accepted' | 'resolved';
  }): Promise<PlatformRiskViolationRecord | null> {
    const result = await this.databaseService.db.query<PlatformRiskViolationRecord>(
      `
        UPDATE platform_risk_violations
        SET status = $2,
            resolved_at = CASE WHEN $2 = 'resolved' THEN NOW() ELSE NULL END,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          store_id,
          category,
          severity,
          score,
          status,
          summary,
          details,
          detected_at,
          resolved_at,
          owner_admin_id,
          NULL::text AS owner_name,
          created_at,
          updated_at
      `,
      [input.violationId, input.status],
    );
    return result.rows[0] ?? null;
  }

  async mergePlatformRiskViolationDetails(input: {
    violationId: string;
    details: Record<string, unknown>;
  }): Promise<PlatformRiskViolationRecord | null> {
    const result = await this.databaseService.db.query<PlatformRiskViolationRecord>(
      `
        UPDATE platform_risk_violations
        SET details = details || $2::jsonb,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          store_id,
          category,
          severity,
          score,
          status,
          summary,
          details,
          detected_at,
          resolved_at,
          owner_admin_id,
          NULL::text AS owner_name,
          created_at,
          updated_at
      `,
      [input.violationId, JSON.stringify(input.details)],
    );
    return result.rows[0] ?? null;
  }

  async listPlatformComplianceTasks(limit: number): Promise<PlatformComplianceTaskRecord[]> {
    const result = await this.databaseService.db.query<PlatformComplianceTaskRecord>(
      `
        SELECT
          t.id,
          t.violation_id,
          t.policy_key,
          t.title,
          t.status,
          t.due_at,
          t.assignee_admin_id,
          assignee.full_name AS assignee_name,
          t.checklist,
          t.evidence,
          t.created_at,
          t.updated_at
        FROM platform_compliance_tasks t
        LEFT JOIN platform_admin_users assignee
          ON assignee.id = t.assignee_admin_id
        ORDER BY t.updated_at DESC
        LIMIT $1
      `,
      [limit],
    );
    return result.rows;
  }

  async findPlatformComplianceTaskById(
    taskId: string,
  ): Promise<PlatformComplianceTaskRecord | null> {
    const result = await this.databaseService.db.query<PlatformComplianceTaskRecord>(
      `
        SELECT
          t.id,
          t.violation_id,
          t.policy_key,
          t.title,
          t.status,
          t.due_at,
          t.assignee_admin_id,
          assignee.full_name AS assignee_name,
          t.checklist,
          t.evidence,
          t.created_at,
          t.updated_at
        FROM platform_compliance_tasks t
        LEFT JOIN platform_admin_users assignee
          ON assignee.id = t.assignee_admin_id
        WHERE t.id = $1
        LIMIT 1
      `,
      [taskId],
    );
    return result.rows[0] ?? null;
  }

  async createPlatformComplianceTask(input: {
    violationId: string | null;
    policyKey: string;
    title: string;
    status: 'pending' | 'in_progress' | 'done' | 'skipped';
    assigneeAdminId: string | null;
    checklist: Record<string, unknown>[];
    evidence: Record<string, unknown>;
  }): Promise<PlatformComplianceTaskRecord> {
    const result = await this.databaseService.db.query<PlatformComplianceTaskRecord>(
      `
        INSERT INTO platform_compliance_tasks (
          id, violation_id, policy_key, title, status, assignee_admin_id,
          checklist, evidence, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
        RETURNING
          id,
          violation_id,
          policy_key,
          title,
          status,
          due_at,
          assignee_admin_id,
          NULL::text AS assignee_name,
          checklist,
          evidence,
          created_at,
          updated_at
      `,
      [
        uuidv4(),
        input.violationId,
        input.policyKey,
        input.title,
        input.status,
        input.assigneeAdminId,
        JSON.stringify(input.checklist),
        JSON.stringify(input.evidence),
      ],
    );
    return result.rows[0] as PlatformComplianceTaskRecord;
  }

  async updatePlatformComplianceTaskStatus(input: {
    taskId: string;
    status: 'pending' | 'in_progress' | 'done' | 'skipped';
  }): Promise<PlatformComplianceTaskRecord | null> {
    const result = await this.databaseService.db.query<PlatformComplianceTaskRecord>(
      `
        UPDATE platform_compliance_tasks
        SET status = $2,
            updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          violation_id,
          policy_key,
          title,
          status,
          due_at,
          assignee_admin_id,
          NULL::text AS assignee_name,
          checklist,
          evidence,
          created_at,
          updated_at
      `,
      [input.taskId, input.status],
    );
    return result.rows[0] ?? null;
  }

  async updatePlatformComplianceTaskJson(input: {
    taskId: string;
    checklist?: Record<string, unknown>[];
    evidence?: Record<string, unknown>;
    assigneeAdminId?: string | null;
  }): Promise<PlatformComplianceTaskRecord | null> {
    const result = await this.databaseService.db.query<PlatformComplianceTaskRecord>(
      `
        UPDATE platform_compliance_tasks
        SET checklist = COALESCE($2::jsonb, checklist),
            evidence = COALESCE($3::jsonb, evidence),
            assignee_admin_id = COALESCE($4::uuid, assignee_admin_id),
            updated_at = NOW()
        WHERE id = $1
        RETURNING
          id,
          violation_id,
          policy_key,
          title,
          status,
          due_at,
          assignee_admin_id,
          NULL::text AS assignee_name,
          checklist,
          evidence,
          created_at,
          updated_at
      `,
      [
        input.taskId,
        input.checklist === undefined ? null : JSON.stringify(input.checklist),
        input.evidence === undefined ? null : JSON.stringify(input.evidence),
        input.assigneeAdminId ?? null,
      ],
    );
    return result.rows[0] ?? null;
  }

  async getPlatformFinanceOverview(): Promise<{
    totalMrr: number;
    openInvoicesAmount: number;
    failedInvoicesAmount: number;
    overdueInvoicesCount: number;
    activePaidSubscriptions: number;
  }> {
    const result = await this.databaseService.db.query<{
      total_mrr: string;
      open_invoices_amount: string;
      failed_invoices_amount: string;
      overdue_invoices_count: string;
      active_paid_subscriptions: string;
    }>(
      `
        SELECT
          COALESCE(SUM(
            CASE
              WHEN ss.is_current = TRUE AND ss.status = 'active'
              THEN COALESCE(p.monthly_price, 0)
              ELSE 0
            END
          ), 0)::text AS total_mrr,
          COALESCE(SUM(
            CASE
              WHEN i.status = 'open' THEN i.total_amount
              ELSE 0
            END
          ), 0)::text AS open_invoices_amount,
          COALESCE(SUM(
            CASE
              WHEN i.status = 'failed' THEN i.total_amount
              ELSE 0
            END
          ), 0)::text AS failed_invoices_amount,
          COUNT(*) FILTER (
            WHERE i.status = 'open'
              AND i.due_at IS NOT NULL
              AND i.due_at < NOW()
          )::text AS overdue_invoices_count,
          COUNT(*) FILTER (
            WHERE ss.is_current = TRUE
              AND ss.status = 'active'
              AND COALESCE(p.monthly_price, 0) > 0
          )::text AS active_paid_subscriptions
        FROM store_subscriptions ss
        LEFT JOIN plans p
          ON p.id = ss.plan_id
        LEFT JOIN subscription_invoices i
          ON i.store_id = ss.store_id
      `,
    );
    const row = result.rows[0];
    return {
      totalMrr: Number(row?.total_mrr ?? '0'),
      openInvoicesAmount: Number(row?.open_invoices_amount ?? '0'),
      failedInvoicesAmount: Number(row?.failed_invoices_amount ?? '0'),
      overdueInvoicesCount: Number(row?.overdue_invoices_count ?? '0'),
      activePaidSubscriptions: Number(row?.active_paid_subscriptions ?? '0'),
    };
  }

  async getBillingSubscriptionsOverview(): Promise<{
    totals: Record<string, number>;
    revenue: Record<string, number | string>;
    invoices: Record<string, number>;
    receipts: Record<string, number>;
    coupons: Record<string, number>;
  }> {
    const result = await this.databaseService.db.query<{
      active: string;
      trialing: string;
      past_due: string;
      suspended: string;
      canceled: string;
      expired: string;
      gross_amount: string;
      discount_amount: string;
      net_revenue: string;
      gifted_value: string;
      trial_value: string;
      compensation_value: string;
      currency_code: string;
      open_invoices: string;
      pending_review_invoices: string;
      paid_invoices: string;
      overdue_invoices: string;
      void_invoices: string;
      pending_review_receipts: string;
      approved_today_receipts: string;
      rejected_today_receipts: string;
      active_coupons: string;
      redemptions_this_month: string;
      discount_given_this_month: string;
    }>(
      `
        WITH invoice_totals AS (
          SELECT
            COALESCE(SUM(COALESCE(original_amount, subtotal_amount)), 0)::text AS gross_amount,
            COALESCE(SUM(COALESCE(discount_amount, 0)), 0)::text AS discount_amount,
            COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0)::text AS net_revenue,
            COALESCE(MAX(currency_code), 'YER') AS currency_code
          FROM subscription_invoices
        ),
        adjustment_totals AS (
          SELECT
            COALESCE(SUM(CASE WHEN accounting_category = 'marketing_gift' THEN COALESCE(amount, 0) ELSE 0 END), 0)::text AS gifted_value,
            COALESCE(SUM(CASE WHEN accounting_category = 'trial' THEN COALESCE(amount, 0) ELSE 0 END), 0)::text AS trial_value,
            COALESCE(SUM(CASE WHEN accounting_category = 'compensation' THEN COALESCE(amount, 0) ELSE 0 END), 0)::text AS compensation_value
          FROM subscription_adjustments
        )
        SELECT
          COUNT(*) FILTER (WHERE ss.is_current = TRUE AND ss.status = 'active')::text AS active,
          COUNT(*) FILTER (WHERE ss.is_current = TRUE AND ss.status = 'trialing')::text AS trialing,
          COUNT(*) FILTER (WHERE ss.is_current = TRUE AND ss.status = 'past_due')::text AS past_due,
          COUNT(*) FILTER (WHERE ss.is_current = TRUE AND ss.status = 'suspended')::text AS suspended,
          COUNT(*) FILTER (WHERE ss.is_current = TRUE AND ss.status = 'canceled')::text AS canceled,
          COUNT(*) FILTER (WHERE ss.is_current = TRUE AND ss.status = 'expired')::text AS expired,
          it.gross_amount,
          it.discount_amount,
          it.net_revenue,
          at.gifted_value,
          at.trial_value,
          at.compensation_value,
          it.currency_code,
          (SELECT COUNT(*)::text FROM subscription_invoices WHERE status = 'open') AS open_invoices,
          (SELECT COUNT(*)::text FROM subscription_payment_receipts WHERE status = 'pending_review' AND deleted_at IS NULL) AS pending_review_invoices,
          (SELECT COUNT(*)::text FROM subscription_invoices WHERE status = 'paid') AS paid_invoices,
          (SELECT COUNT(*)::text FROM subscription_invoices WHERE status = 'open' AND due_at IS NOT NULL AND due_at < NOW()) AS overdue_invoices,
          (SELECT COUNT(*)::text FROM subscription_invoices WHERE status = 'void') AS void_invoices,
          (SELECT COUNT(*)::text FROM subscription_payment_receipts WHERE status = 'pending_review' AND deleted_at IS NULL) AS pending_review_receipts,
          (SELECT COUNT(*)::text FROM subscription_payment_receipts WHERE status = 'approved' AND reviewed_at::date = CURRENT_DATE AND deleted_at IS NULL) AS approved_today_receipts,
          (SELECT COUNT(*)::text FROM subscription_payment_receipts WHERE status = 'rejected' AND reviewed_at::date = CURRENT_DATE AND deleted_at IS NULL) AS rejected_today_receipts,
          (SELECT COUNT(*)::text FROM subscription_coupons WHERE is_active = TRUE) AS active_coupons,
          (SELECT COUNT(*)::text FROM subscription_coupon_redemptions WHERE redeemed_at >= date_trunc('month', NOW())) AS redemptions_this_month,
          (SELECT COALESCE(SUM(discount_amount), 0)::text FROM subscription_coupon_redemptions WHERE redeemed_at >= date_trunc('month', NOW())) AS discount_given_this_month
        FROM store_subscriptions ss
        CROSS JOIN invoice_totals it
        CROSS JOIN adjustment_totals at
      `,
    );
    const row = result.rows[0];
    return {
      totals: {
        active: Number(row?.active ?? 0),
        trialing: Number(row?.trialing ?? 0),
        pastDue: Number(row?.past_due ?? 0),
        suspended: Number(row?.suspended ?? 0),
        canceled: Number(row?.canceled ?? 0),
        expired: Number(row?.expired ?? 0),
      },
      revenue: {
        grossAmount: Number(row?.gross_amount ?? 0),
        discountAmount: Number(row?.discount_amount ?? 0),
        netRevenue: Number(row?.net_revenue ?? 0),
        giftedValue: Number(row?.gifted_value ?? 0),
        trialValue: Number(row?.trial_value ?? 0),
        compensationValue: Number(row?.compensation_value ?? 0),
        currencyCode: row?.currency_code ?? 'YER',
      },
      invoices: {
        open: Number(row?.open_invoices ?? 0),
        pendingReview: Number(row?.pending_review_invoices ?? 0),
        paid: Number(row?.paid_invoices ?? 0),
        overdue: Number(row?.overdue_invoices ?? 0),
        void: Number(row?.void_invoices ?? 0),
      },
      receipts: {
        pendingReview: Number(row?.pending_review_receipts ?? 0),
        approvedToday: Number(row?.approved_today_receipts ?? 0),
        rejectedToday: Number(row?.rejected_today_receipts ?? 0),
      },
      coupons: {
        active: Number(row?.active_coupons ?? 0),
        redemptionsThisMonth: Number(row?.redemptions_this_month ?? 0),
        discountGivenThisMonth: Number(row?.discount_given_this_month ?? 0),
      },
    };
  }

  async getBillingReportSummary(input: {
    from: Date;
    to: Date;
    groupBy: 'day' | 'week' | 'month';
    currency: string | null;
  }) {
    const result = await this.databaseService.db.query<{
      totals: Record<string, unknown>;
      mrr: Record<string, unknown>;
      by_plan: Array<Record<string, unknown>>;
      by_accounting_category: Array<Record<string, unknown>>;
      by_payment_method: Array<Record<string, unknown>>;
      series: Array<Record<string, unknown>>;
    }>(
      `
        WITH params AS (
          SELECT $1::timestamptz AS from_at, $2::timestamptz AS to_at, $3::text AS group_by, $4::text AS currency_code
        ),
        filtered_invoices AS (
          SELECT i.*, p.code AS plan_code
          FROM subscription_invoices i
          LEFT JOIN plans p ON p.id = i.plan_id
          CROSS JOIN params prm
          WHERE i.created_at >= prm.from_at
            AND i.created_at < prm.to_at + INTERVAL '1 day'
            AND (prm.currency_code IS NULL OR i.currency_code = prm.currency_code)
        ),
        paid_payments AS (
          SELECT sp.*
          FROM subscription_payments sp
          CROSS JOIN params prm
          WHERE sp.status IN ('succeeded', 'paid', 'approved')
            AND sp.created_at >= prm.from_at
            AND sp.created_at < prm.to_at + INTERVAL '1 day'
            AND (prm.currency_code IS NULL OR sp.currency_code = prm.currency_code)
        ),
        filtered_adjustments AS (
          SELECT *
          FROM subscription_adjustments sa
          CROSS JOIN params prm
          WHERE sa.created_at >= prm.from_at
            AND sa.created_at < prm.to_at + INTERVAL '1 day'
            AND (prm.currency_code IS NULL OR sa.currency_code = prm.currency_code OR sa.currency_code IS NULL)
        ),
        periods AS (
          SELECT
            date_trunc((SELECT group_by FROM params), i.created_at) AS period,
            COALESCE(SUM(COALESCE(i.original_amount, i.subtotal_amount)), 0) AS gross_amount,
            COALESCE(SUM(CASE WHEN i.status = 'paid' THEN i.total_amount ELSE 0 END), 0) AS net_revenue,
            COUNT(*) FILTER (WHERE i.status = 'paid') AS paid_invoices
          FROM filtered_invoices i
          GROUP BY 1
        ),
        subscription_events AS (
          SELECT
            date_trunc((SELECT group_by FROM params), ss.created_at) AS period,
            COUNT(*) FILTER (WHERE ss.status IN ('active', 'trialing')) AS new_subscriptions,
            COUNT(*) FILTER (WHERE ss.status IN ('canceled', 'expired')) AS churned_subscriptions
          FROM store_subscriptions ss
          CROSS JOIN params prm
          WHERE ss.created_at >= prm.from_at
            AND ss.created_at < prm.to_at + INTERVAL '1 day'
          GROUP BY 1
        )
        SELECT
          jsonb_build_object(
            'grossAmount', COALESCE((SELECT SUM(COALESCE(original_amount, subtotal_amount)) FROM filtered_invoices), 0),
            'discountAmount', COALESCE((SELECT SUM(COALESCE(discount_amount, 0)) FROM filtered_invoices), 0),
            'netRevenue', COALESCE((SELECT SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END) FROM filtered_invoices), 0),
            'collectedRevenue', COALESCE((SELECT SUM(amount) FROM paid_payments), 0),
            'outstandingAmount', COALESCE((SELECT SUM(total_amount) FROM filtered_invoices WHERE status IN ('open', 'failed')), 0),
            'giftedValue', COALESCE((SELECT SUM(COALESCE(amount, 0)) FROM filtered_adjustments WHERE accounting_category = 'marketing_gift'), 0),
            'trialValue', COALESCE((SELECT SUM(COALESCE(amount, 0)) FROM filtered_adjustments WHERE accounting_category = 'trial'), 0),
            'compensationValue', COALESCE((SELECT SUM(COALESCE(amount, 0)) FROM filtered_adjustments WHERE accounting_category = 'compensation'), 0),
            'couponDiscountValue', COALESCE((SELECT SUM(discount_amount) FROM subscription_coupon_redemptions cr CROSS JOIN params prm WHERE cr.redeemed_at >= prm.from_at AND cr.redeemed_at < prm.to_at + INTERVAL '1 day'), 0)
          ) AS totals,
          jsonb_build_object(
            'realMrr', COALESCE((SELECT SUM(CASE WHEN ss.status = 'active' THEN CASE WHEN ss.billing_cycle = 'annual' THEN COALESCE(p.annual_price, 0) / 12 ELSE COALESCE(p.monthly_price, 0) END ELSE 0 END) FROM store_subscriptions ss INNER JOIN plans p ON p.id = ss.plan_id WHERE ss.is_current = TRUE), 0),
            'expectedMrr', COALESCE((SELECT SUM(CASE WHEN ss.billing_cycle = 'annual' THEN COALESCE(p.annual_price, 0) / 12 ELSE COALESCE(p.monthly_price, 0) END) FROM store_subscriptions ss INNER JOIN plans p ON p.id = ss.plan_id WHERE ss.is_current = TRUE), 0),
            'trialMrr', COALESCE((SELECT SUM(CASE WHEN ss.status = 'trialing' THEN CASE WHEN ss.billing_cycle = 'annual' THEN COALESCE(p.annual_price, 0) / 12 ELSE COALESCE(p.monthly_price, 0) END ELSE 0 END) FROM store_subscriptions ss INNER JOIN plans p ON p.id = ss.plan_id WHERE ss.is_current = TRUE), 0),
            'giftedMrr', 0,
            'discountedMrr', COALESCE((SELECT SUM(discount_amount) FROM subscription_coupon_redemptions), 0)
          ) AS mrr,
          COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (
            SELECT plan_code AS "planCode", COUNT(DISTINCT subscription_id)::int AS "activeSubscriptions", COALESCE(SUM(CASE WHEN status = 'paid' THEN total_amount ELSE 0 END), 0)::numeric AS "netRevenue", COALESCE(SUM(COALESCE(original_amount, subtotal_amount)), 0)::numeric AS "grossAmount"
            FROM filtered_invoices
            GROUP BY plan_code
            ORDER BY "netRevenue" DESC
          ) x), '[]'::jsonb) AS by_plan,
          COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (
            SELECT accounting_category AS category, COALESCE(SUM(COALESCE(amount, 0)), 0)::numeric AS amount, COUNT(*)::int AS count
            FROM filtered_adjustments
            GROUP BY accounting_category
            ORDER BY amount DESC
          ) x), '[]'::jsonb) AS by_accounting_category,
          COALESCE((SELECT jsonb_agg(row_to_json(x)) FROM (
            SELECT COALESCE(payment_method, provider, 'unknown') AS method, COALESCE(SUM(amount), 0)::numeric AS amount, COUNT(*)::int AS count
            FROM paid_payments
            GROUP BY COALESCE(payment_method, provider, 'unknown')
            ORDER BY amount DESC
          ) x), '[]'::jsonb) AS by_payment_method,
          COALESCE((SELECT jsonb_agg(row_to_json(x) ORDER BY x.period) FROM (
            SELECT
              p.period::date::text AS period,
              p.gross_amount::numeric AS "grossAmount",
              p.net_revenue::numeric AS "netRevenue",
              p.paid_invoices::int AS "paidInvoices",
              COALESCE(se.new_subscriptions, 0)::int AS "newSubscriptions",
              COALESCE(se.churned_subscriptions, 0)::int AS "churnedSubscriptions"
            FROM periods p
            LEFT JOIN subscription_events se ON se.period = p.period
          ) x), '[]'::jsonb) AS series
      `,
      [input.from, input.to, input.groupBy, input.currency],
    );
    const row = result.rows[0];
    return {
      totals: row?.totals ?? {},
      mrr: row?.mrr ?? {},
      byPlan: row?.by_plan ?? [],
      byAccountingCategory: row?.by_accounting_category ?? [],
      byPaymentMethod: row?.by_payment_method ?? [],
      series: row?.series ?? [],
    };
  }

  async listPlatformFinanceAging(): Promise<
    Array<{
      bucket: 'current' | '1_30' | '31_60' | '61_90' | '90_plus';
      invoices: number;
      amount: number;
    }>
  > {
    const result = await this.databaseService.db.query<{
      bucket: 'current' | '1_30' | '31_60' | '61_90' | '90_plus';
      invoices: string;
      amount: string;
    }>(
      `
        SELECT
          CASE
            WHEN i.due_at IS NULL OR i.due_at >= NOW() THEN 'current'
            WHEN NOW() - i.due_at < INTERVAL '31 days' THEN '1_30'
            WHEN NOW() - i.due_at < INTERVAL '61 days' THEN '31_60'
            WHEN NOW() - i.due_at < INTERVAL '91 days' THEN '61_90'
            ELSE '90_plus'
          END AS bucket,
          COUNT(*)::text AS invoices,
          COALESCE(SUM(i.total_amount), 0)::text AS amount
        FROM subscription_invoices i
        WHERE i.status = 'open'
        GROUP BY 1
        ORDER BY 1
      `,
    );
    return result.rows.map((row) => ({
      bucket: row.bucket,
      invoices: Number(row.invoices),
      amount: Number(row.amount),
    }));
  }

  async listPlatformFinanceCollections(limit: number): Promise<
    Array<{
      invoice_id: string;
      invoice_number: string;
      store_id: string;
      store_name: string;
      status: 'open' | 'failed';
      due_at: Date | null;
      total_amount: string;
      currency_code: string;
      updated_at: Date;
    }>
  > {
    const result = await this.databaseService.db.query<{
      invoice_id: string;
      invoice_number: string;
      store_id: string;
      store_name: string;
      status: 'open' | 'failed';
      due_at: Date | null;
      total_amount: string;
      currency_code: string;
      updated_at: Date;
    }>(
      `
        SELECT
          i.id AS invoice_id,
          i.invoice_number,
          i.store_id,
          s.name AS store_name,
          i.status,
          i.due_at,
          i.total_amount,
          i.currency_code,
          i.updated_at
        FROM subscription_invoices i
        INNER JOIN stores s
          ON s.id = i.store_id
        WHERE i.status IN ('open', 'failed')
        ORDER BY i.updated_at DESC
        LIMIT $1
      `,
      [limit],
    );
    return result.rows;
  }

  async listOnboardingPipeline(limit: number): Promise<
    Array<{
      store_id: string;
      store_name: string;
      store_slug: string;
      created_at: Date;
      onboarding_status: string;
      has_products: boolean;
      has_domain: boolean;
      first_order_at: Date | null;
      trial_ends_at: Date | null;
      subscription_status: string | null;
    }>
  > {
    const result = await this.databaseService.db.query<{
      store_id: string;
      store_name: string;
      store_slug: string;
      created_at: Date;
      onboarding_status: string;
      has_products: boolean;
      has_domain: boolean;
      first_order_at: Date | null;
      trial_ends_at: Date | null;
      subscription_status: string | null;
    }>(
      `
        SELECT
          s.id AS store_id,
          s.name AS store_name,
          s.slug AS store_slug,
          s.created_at,
          CASE
            WHEN s.onboarding_completed_at IS NOT NULL THEN 'completed'
            ELSE 'in_progress'
          END AS onboarding_status,
          EXISTS (
            SELECT 1
            FROM products p
            WHERE p.store_id = s.id
          ) AS has_products,
          EXISTS (
            SELECT 1
            FROM store_domains d
            WHERE d.store_id = s.id
              AND d.status = 'active'
          ) AS has_domain,
          (
            SELECT MIN(o.created_at)
            FROM orders o
            WHERE o.store_id = s.id
          ) AS first_order_at,
          ss.trial_ends_at,
          ss.status AS subscription_status
        FROM stores s
        LEFT JOIN store_subscriptions ss
          ON ss.store_id = s.id
         AND ss.is_current = TRUE
        ORDER BY s.created_at DESC
        LIMIT $1
      `,
      [limit],
    );
    return result.rows;
  }

  async listOnboardingStuckStores(limit: number): Promise<
    Array<{
      store_id: string;
      store_name: string;
      store_slug: string;
      created_at: Date;
      onboarding_status: string | null;
      has_products: boolean;
      has_domain: boolean;
      first_order_at: Date | null;
      trial_ends_at: Date | null;
      subscription_status: string | null;
      days_since_signup: number;
    }>
  > {
    const result = await this.databaseService.db.query<{
      store_id: string;
      store_name: string;
      store_slug: string;
      created_at: Date;
      onboarding_status: string | null;
      has_products: boolean;
      has_domain: boolean;
      first_order_at: Date | null;
      trial_ends_at: Date | null;
      subscription_status: string | null;
      days_since_signup: number;
    }>(
      `
        SELECT
          s.id AS store_id,
          s.name AS store_name,
          s.slug AS store_slug,
          s.created_at,
          CASE
            WHEN s.onboarding_completed_at IS NOT NULL THEN 'completed'
            ELSE 'in_progress'
          END AS onboarding_status,
          EXISTS (
            SELECT 1
            FROM products p
            WHERE p.store_id = s.id
          ) AS has_products,
          EXISTS (
            SELECT 1
            FROM store_domains d
            WHERE d.store_id = s.id
              AND d.status = 'active'
          ) AS has_domain,
          (
            SELECT MIN(o.created_at)
            FROM orders o
            WHERE o.store_id = s.id
          ) AS first_order_at,
          ss.trial_ends_at,
          ss.status AS subscription_status,
          FLOOR(EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 86400)::int AS days_since_signup
        FROM stores s
        LEFT JOIN store_subscriptions ss
          ON ss.store_id = s.id
         AND ss.is_current = TRUE
        WHERE (
          s.onboarding_completed_at IS NULL
          OR NOT EXISTS (SELECT 1 FROM products p WHERE p.store_id = s.id)
          OR NOT EXISTS (SELECT 1 FROM store_domains d WHERE d.store_id = s.id AND d.status = 'active')
          OR NOT EXISTS (SELECT 1 FROM orders o WHERE o.store_id = s.id)
        )
          AND s.created_at <= NOW() - INTERVAL '3 days'
        ORDER BY s.created_at ASC
        LIMIT $1
      `,
      [limit],
    );
    return result.rows;
  }

  async listPlatformSubscriptions(input: {
    status: string | null;
    limit: number;
    offset: number;
  }): Promise<{ rows: PlatformSubscriptionRecord[]; total: number }> {
    const rowsResult = await this.databaseService.db.query<PlatformSubscriptionRecord>(
      `
        SELECT
          ss.id,
          ss.store_id,
          s.name AS store_name,
          s.slug AS store_slug,
          p.code AS plan_code,
          p.name AS plan_name,
          ss.status,
          ss.starts_at,
          ss.current_period_end,
          ss.trial_ends_at,
          ss.billing_cycle,
          ss.next_billing_at,
          ss.cancel_at_period_end
        FROM store_subscriptions ss
        INNER JOIN stores s ON s.id = ss.store_id
        INNER JOIN plans p ON p.id = ss.plan_id
        WHERE ss.is_current = TRUE
          AND ($1::text IS NULL OR ss.status = $1)
        ORDER BY ss.created_at DESC
        LIMIT $2 OFFSET $3
      `,
      [input.status, input.limit, input.offset],
    );

    const countResult = await this.databaseService.db.query<{ total: string }>(
      `
        SELECT COUNT(*)::text AS total
        FROM store_subscriptions ss
        WHERE ss.is_current = TRUE
          AND ($1::text IS NULL OR ss.status = $1)
      `,
      [input.status],
    );

    return {
      rows: rowsResult.rows,
      total: Number(countResult.rows[0]?.total ?? '0'),
    };
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
