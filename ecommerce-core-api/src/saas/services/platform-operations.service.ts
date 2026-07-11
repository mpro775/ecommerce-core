import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import type { RequestContextData } from '../../common/utils/request-context.util';
import type { PlatformAdminUser } from '../../platform/interfaces/platform-admin-user.interface';
import type { CreatePlatformAutomationRuleDto } from '../dto/create-platform-automation-rule.dto';
import type { CreatePlatformComplianceTaskDto } from '../dto/create-platform-compliance-task.dto';
import type { CreatePlatformIncidentDto } from '../dto/create-platform-incident.dto';
import type { CreatePlatformRiskViolationDto } from '../dto/create-platform-risk-violation.dto';
import type { CreatePlatformSupportCaseDto } from '../dto/create-platform-support-case.dto';
import type { PlatformInternalCommentDto } from '../dto/platform-internal-comment.dto';
import type { TriggerPlatformAutomationRuleDto } from '../dto/trigger-platform-automation-rule.dto';
import type { UpdatePlatformAutomationRuleStatusDto } from '../dto/update-platform-automation-rule-status.dto';
import type { UpdatePlatformComplianceTaskStatusDto } from '../dto/update-platform-compliance-task-status.dto';
import type { UpdatePlatformIncidentStatusDto } from '../dto/update-platform-incident-status.dto';
import type { UpdatePlatformRiskViolationStatusDto } from '../dto/update-platform-risk-violation-status.dto';
import type { UpdatePlatformSupportCaseDto } from '../dto/update-platform-support-case.dto';
import { SaasRepository } from '../saas.repository';
import { SaasHelpers } from './helpers';

@Injectable()
export class PlatformOperationsService {
  private readonly logger = new Logger(PlatformOperationsService.name);

  constructor(
    private readonly saasRepository: SaasRepository,
    private readonly auditService: AuditService,
  ) {}

  async listPlatformIncidents() {
    const rows = await this.saasRepository.listPlatformIncidents(100);
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      severity: row.severity,
      service: row.service,
      title: row.title,
      summary: row.summary,
      status: row.status,
      relatedStoreId: row.related_store_id,
      createdByAdminId: row.created_by_admin_id,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      updatedAt: row.updated_at,
    }));
  }

  async createPlatformIncident(
    input: CreatePlatformIncidentDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const incident = await this.saasRepository.createPlatformIncident({
      type: input.type.trim().toLowerCase(),
      severity: input.severity,
      service: input.service.trim().toLowerCase(),
      title: input.title.trim(),
      summary: input.summary.trim(),
      status: input.status ?? 'open',
      relatedStoreId: input.relatedStoreId ?? null,
      createdByAdminId: currentUser.id,
    });

    await this.auditService.log({
      action: 'platform.incident_created',
      storeId: incident.related_store_id,
      storeUserId: null,
      targetType: 'platform_incident',
      targetId: incident.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        severity: incident.severity,
        service: incident.service,
      },
    });

    return {
      id: incident.id,
      type: incident.type,
      severity: incident.severity,
      service: incident.service,
      title: incident.title,
      summary: incident.summary,
      status: incident.status,
      relatedStoreId: incident.related_store_id,
      createdByAdminId: incident.created_by_admin_id,
      createdByName: currentUser.fullName,
      createdAt: incident.created_at,
      resolvedAt: incident.resolved_at,
      updatedAt: incident.updated_at,
    };
  }

  async updatePlatformIncidentStatus(
    incidentId: string,
    input: UpdatePlatformIncidentStatusDto,
    context: RequestContextData,
  ) {
    const incident = await this.saasRepository.updateIncidentStatus({
      incidentId,
      status: input.status,
    });
    if (!incident) {
      throw new NotFoundException('Incident not found');
    }

    await this.auditService.log({
      action: 'platform.incident_status_updated',
      storeId: incident.related_store_id,
      storeUserId: null,
      targetType: 'platform_incident',
      targetId: incident.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        status: incident.status,
      },
    });

    return {
      id: incident.id,
      status: incident.status,
      resolvedAt: incident.resolved_at,
      updatedAt: incident.updated_at,
    };
  }

  async listPlatformAutomationRules() {
    const rows = await this.saasRepository.listPlatformAutomationRules();
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      triggerType: row.trigger_type,
      triggerConfig: row.trigger_config,
      actionType: row.action_type,
      actionConfig: row.action_config,
      isActive: row.is_active,
      lastRunAt: row.last_run_at,
      createdByAdminId: row.created_by_admin_id,
      updatedByAdminId: row.updated_by_admin_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async createPlatformAutomationRule(
    input: CreatePlatformAutomationRuleDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const created = await this.saasRepository.createPlatformAutomationRule({
      name: input.name.trim(),
      description: input.description?.trim() ?? null,
      triggerType: input.triggerType,
      triggerConfig: input.triggerConfig,
      actionType: input.actionType.trim(),
      actionConfig: input.actionConfig,
      isActive: input.isActive ?? true,
      createdByAdminId: currentUser.id,
    });

    await this.auditService.log({
      action: 'platform.automation_rule_created',
      storeId: null,
      storeUserId: null,
      targetType: 'platform_automation_rule',
      targetId: created.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        triggerType: created.trigger_type,
        actionType: created.action_type,
      },
    });

    return {
      id: created.id,
      name: created.name,
      description: created.description,
      triggerType: created.trigger_type,
      triggerConfig: created.trigger_config,
      actionType: created.action_type,
      actionConfig: created.action_config,
      isActive: created.is_active,
      lastRunAt: created.last_run_at,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    };
  }

  async updatePlatformAutomationRuleStatus(
    ruleId: string,
    input: UpdatePlatformAutomationRuleStatusDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const updated = await this.saasRepository.setPlatformAutomationRuleStatus({
      ruleId,
      isActive: input.isActive,
      updatedByAdminId: currentUser.id,
    });
    if (!updated) {
      throw new NotFoundException('Automation rule not found');
    }

    await this.auditService.log({
      action: 'platform.automation_rule_status_updated',
      storeId: null,
      storeUserId: null,
      targetType: 'platform_automation_rule',
      targetId: updated.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        isActive: updated.is_active,
      },
    });

    return {
      id: updated.id,
      isActive: updated.is_active,
      updatedAt: updated.updated_at,
    };
  }

  async triggerPlatformAutomationRule(
    ruleId: string,
    input: TriggerPlatformAutomationRuleDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const rule = await this.saasRepository.findPlatformAutomationRuleById(ruleId);
    if (!rule) {
      throw new NotFoundException('Automation rule not found');
    }
    if (!rule.is_active) {
      throw new BadRequestException('Automation rule is inactive');
    }

    const metadata = {
      ...(input.metadata ?? {}),
      trigger: 'manual',
      triggeredByAdminId: currentUser.id,
      actionType: rule.action_type,
      triggerType: rule.trigger_type,
    };

    const run = await this.saasRepository.createPlatformAutomationRun({
      ruleId,
      triggeredByAdminId: currentUser.id,
      storeId: input.storeId ?? null,
      status: 'queued',
      logs: 'Queued from platform console',
      metadata,
    });

    await this.auditService.log({
      action: 'platform.automation_run_triggered',
      storeId: input.storeId ?? null,
      storeUserId: null,
      targetType: 'platform_automation_run',
      targetId: run.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        ruleId,
        status: run.status,
      },
    });

    void this.processPlatformAutomationRun(run.id, rule.id, rule.action_type, rule.action_config);

    return {
      id: run.id,
      ruleId: run.rule_id,
      status: run.status,
      storeId: run.store_id,
      startedAt: run.started_at,
      finishedAt: run.finished_at,
      metadata: run.metadata,
      createdAt: run.created_at,
    };
  }

  private async processPlatformAutomationRun(
    runId: string,
    ruleId: string,
    actionType: string,
    actionConfig: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.saasRepository.updatePlatformAutomationRun({
        runId,
        status: 'running',
        logs: 'Automation run started',
      });
      await this.executePlatformAutomationAction(actionType, actionConfig);
      await this.saasRepository.updatePlatformAutomationRun({
        runId,
        status: 'succeeded',
        logs: 'Automation run completed successfully',
      });
    } catch (error) {
      this.logger.error(
        `Automation run failed for rule ${ruleId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      await this.saasRepository.updatePlatformAutomationRun({
        runId,
        status: 'failed',
        logs: error instanceof Error ? error.message : 'Automation run failed',
      });
    }
  }

  private async executePlatformAutomationAction(
    actionType: string,
    actionConfig: Record<string, unknown>,
  ): Promise<void> {
    const normalized = actionType.trim().toLowerCase();

    if (normalized === 'notify') {
      if (!actionConfig.channel || typeof actionConfig.channel !== 'string') {
        throw new BadRequestException('Automation notify action requires a channel');
      }
      return;
    }

    if (normalized === 'set_setting') {
      if (!actionConfig.key || typeof actionConfig.key !== 'string') {
        throw new BadRequestException('Automation set_setting action requires key');
      }
      return;
    }

    throw new BadRequestException(`Unsupported automation action type: ${actionType}`);
  }

  async listPlatformAutomationRuns(limit = 100) {
    const rows = await this.saasRepository.listPlatformAutomationRuns(limit);
    return rows.map((row) => ({
      id: row.id,
      ruleId: row.rule_id,
      status: row.status,
      triggeredByAdminId: row.triggered_by_admin_id,
      storeId: row.store_id,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      logs: row.logs,
      metadata: row.metadata,
      createdAt: row.created_at,
    }));
  }

  async listPlatformSupportCases(limit = 100) {
    const rows = await this.saasRepository.listPlatformSupportCases(limit);
    return rows.map((row) => SaasHelpers.toPlatformSupportCaseResponse(row));
  }

  async getPlatformSupportCaseById(caseId: string) {
    const item = await this.saasRepository.findPlatformSupportCaseById(caseId);
    if (!item) {
      throw new NotFoundException('Support case not found');
    }
    const [events, audit] = await Promise.all([
      this.saasRepository.listPlatformSupportCaseEvents(caseId),
      this.saasRepository.listAuditLogsByTarget('platform_support_case', caseId),
    ]);
    return {
      case: SaasHelpers.toPlatformSupportCaseResponse(item),
      comments: events
        .filter((event) => event.event_type === 'comment.added')
        .map((event) => ({
          id: event.id,
          body: String(event.payload.body ?? ''),
          authorAdminId: event.actor_admin_id,
          authorName: event.actor_name,
          createdAt: event.created_at,
        })),
      timeline: [
        ...events.map((event) => ({
          id: event.id,
          type: event.event_type,
          actorAdminId: event.actor_admin_id,
          actorName: event.actor_name,
          payload: event.payload,
          createdAt: event.created_at,
        })),
        ...audit.map((event) => ({
          id: event.id,
          type: event.action,
          actorAdminId: null,
          actorName: null,
          payload: event.metadata,
          createdAt: event.created_at,
        })),
      ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()),
    };
  }

  async createPlatformSupportCase(
    input: CreatePlatformSupportCaseDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const created = await this.saasRepository.createPlatformSupportCase({
      storeId: input.storeId ?? null,
      subject: input.subject.trim(),
      description: input.description.trim(),
      priority: input.priority,
      status: 'open',
      queue: input.queue?.trim() || 'general',
      assigneeAdminId: input.assigneeAdminId ?? null,
      impactScore: input.impactScore ?? 0,
      createdByAdminId: currentUser.id,
    });

    await this.saasRepository.createPlatformSupportCaseEvent({
      caseId: created.id,
      eventType: 'case.created',
      actorAdminId: currentUser.id,
      payload: {
        priority: created.priority,
        queue: created.queue,
      },
    });

    await this.auditService.log({
      action: 'platform.support_case_created',
      storeId: created.store_id,
      storeUserId: null,
      targetType: 'platform_support_case',
      targetId: created.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        priority: created.priority,
        queue: created.queue,
      },
    });

    return {
      id: created.id,
      storeId: created.store_id,
      subject: created.subject,
      description: created.description,
      priority: created.priority,
      status: created.status,
      queue: created.queue,
      assigneeAdminId: created.assignee_admin_id,
      impactScore: created.impact_score,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    };
  }

  async updatePlatformSupportCase(
    caseId: string,
    input: UpdatePlatformSupportCaseDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const repoInput: {
      caseId: string;
      status?: 'open' | 'in_progress' | 'escalated' | 'resolved' | 'closed';
      assigneeAdminId?: string;
      queue?: string;
    } = { caseId };
    if (input.status !== undefined) repoInput.status = input.status;
    if (input.assigneeAdminId !== undefined) repoInput.assigneeAdminId = input.assigneeAdminId;
    if (input.queue !== undefined) repoInput.queue = input.queue.trim();

    const updated = await this.saasRepository.updatePlatformSupportCase(repoInput);
    if (!updated) {
      throw new NotFoundException('Support case not found');
    }

    await this.saasRepository.createPlatformSupportCaseEvent({
      caseId,
      eventType: 'case.updated',
      actorAdminId: currentUser.id,
      payload: {
        status: input.status,
        assigneeAdminId: input.assigneeAdminId,
        queue: input.queue,
      },
    });

    await this.auditService.log({
      action: 'platform.support_case_updated',
      storeId: updated.store_id,
      storeUserId: null,
      targetType: 'platform_support_case',
      targetId: updated.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        status: updated.status,
        queue: updated.queue,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      queue: updated.queue,
      assigneeAdminId: updated.assignee_admin_id,
      resolvedAt: updated.resolved_at,
      updatedAt: updated.updated_at,
    };
  }

  async addPlatformSupportCaseComment(
    caseId: string,
    input: PlatformInternalCommentDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const item = await this.saasRepository.findPlatformSupportCaseById(caseId);
    if (!item) {
      throw new NotFoundException('Support case not found');
    }
    const body = input.body.trim();
    if (!body) {
      throw new BadRequestException('Comment body is required');
    }
    await this.saasRepository.createPlatformSupportCaseEvent({
      caseId,
      eventType: 'comment.added',
      actorAdminId: currentUser.id,
      payload: { body },
    });
    await this.auditService.log({
      action: 'platform.support_case_comment_added',
      storeId: item.store_id,
      storeUserId: null,
      targetType: 'platform_support_case',
      targetId: caseId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });
    return this.getPlatformSupportCaseById(caseId);
  }

  async listPlatformRiskViolations(limit = 100) {
    const rows = await this.saasRepository.listPlatformRiskViolations(limit);
    return rows.map((row) => SaasHelpers.toPlatformRiskViolationResponse(row));
  }

  async getPlatformRiskViolationById(violationId: string) {
    const item = await this.saasRepository.findPlatformRiskViolationById(violationId);
    if (!item) {
      throw new NotFoundException('Risk violation not found');
    }
    const audit = await this.saasRepository.listAuditLogsByTarget(
      'platform_risk_violation',
      violationId,
    );
    const details = item.details ?? {};
    return {
      violation: SaasHelpers.toPlatformRiskViolationResponse(item),
      notes: Array.isArray(details.notes) ? details.notes : [],
      timeline: audit.map((event) => ({
        id: event.id,
        type: event.action,
        payload: event.metadata,
        createdAt: event.created_at,
      })),
    };
  }

  async createPlatformRiskViolation(
    input: CreatePlatformRiskViolationDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const created = await this.saasRepository.createPlatformRiskViolation({
      storeId: input.storeId ?? null,
      category: input.category.trim().toLowerCase(),
      severity: input.severity,
      score: input.score,
      status: 'open',
      summary: input.summary.trim(),
      details: input.details ?? {},
      ownerAdminId: input.ownerAdminId ?? currentUser.id,
    });

    await this.auditService.log({
      action: 'platform.risk_violation_created',
      storeId: created.store_id,
      storeUserId: null,
      targetType: 'platform_risk_violation',
      targetId: created.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        severity: created.severity,
        score: created.score,
      },
    });

    return {
      id: created.id,
      storeId: created.store_id,
      category: created.category,
      severity: created.severity,
      score: created.score,
      status: created.status,
      summary: created.summary,
      details: created.details,
      detectedAt: created.detected_at,
      resolvedAt: created.resolved_at,
      ownerAdminId: created.owner_admin_id,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    };
  }

  async updatePlatformRiskViolationStatus(
    violationId: string,
    input: UpdatePlatformRiskViolationStatusDto,
    context: RequestContextData,
  ) {
    const updated = await this.saasRepository.updatePlatformRiskViolationStatus({
      violationId,
      status: input.status,
    });
    if (!updated) {
      throw new NotFoundException('Risk violation not found');
    }

    await this.auditService.log({
      action: 'platform.risk_violation_status_updated',
      storeId: updated.store_id,
      storeUserId: null,
      targetType: 'platform_risk_violation',
      targetId: updated.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        status: updated.status,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      resolvedAt: updated.resolved_at,
      updatedAt: updated.updated_at,
    };
  }

  async addPlatformRiskViolationNote(
    violationId: string,
    input: PlatformInternalCommentDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const item = await this.saasRepository.findPlatformRiskViolationById(violationId);
    if (!item) {
      throw new NotFoundException('Risk violation not found');
    }
    const body = input.body.trim();
    if (!body) {
      throw new BadRequestException('Note body is required');
    }
    const currentNotes = Array.isArray(item.details?.notes) ? item.details.notes : [];
    const note = {
      body,
      authorAdminId: currentUser.id,
      authorName: currentUser.fullName,
      createdAt: new Date().toISOString(),
    };
    const updated = await this.saasRepository.mergePlatformRiskViolationDetails({
      violationId,
      details: { notes: [...currentNotes, note] },
    });
    await this.auditService.log({
      action: 'platform.risk_violation_note_added',
      storeId: item.store_id,
      storeUserId: null,
      targetType: 'platform_risk_violation',
      targetId: violationId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });
    return updated ? SaasHelpers.toPlatformRiskViolationResponse(updated) : null;
  }

  async listPlatformComplianceTasks(limit = 100) {
    const rows = await this.saasRepository.listPlatformComplianceTasks(limit);
    return rows.map((row) => SaasHelpers.toPlatformComplianceTaskResponse(row));
  }

  async getPlatformComplianceTaskById(taskId: string) {
    const item = await this.saasRepository.findPlatformComplianceTaskById(taskId);
    if (!item) {
      throw new NotFoundException('Compliance task not found');
    }
    const audit = await this.saasRepository.listAuditLogsByTarget(
      'platform_compliance_task',
      taskId,
    );
    return {
      task: SaasHelpers.toPlatformComplianceTaskResponse(item),
      comments: Array.isArray(item.evidence.comments) ? item.evidence.comments : [],
      evidence: item.evidence,
      timeline: audit.map((event) => ({
        id: event.id,
        type: event.action,
        payload: event.metadata,
        createdAt: event.created_at,
      })),
    };
  }

  async createPlatformComplianceTask(
    input: CreatePlatformComplianceTaskDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const created = await this.saasRepository.createPlatformComplianceTask({
      violationId: input.violationId ?? null,
      policyKey: input.policyKey.trim(),
      title: input.title.trim(),
      status: input.status,
      assigneeAdminId: input.assigneeAdminId ?? currentUser.id,
      checklist: input.checklist ?? [],
      evidence: input.evidence ?? {},
    });

    await this.auditService.log({
      action: 'platform.compliance_task_created',
      storeId: null,
      storeUserId: null,
      targetType: 'platform_compliance_task',
      targetId: created.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        policyKey: created.policy_key,
        status: created.status,
      },
    });

    return {
      id: created.id,
      violationId: created.violation_id,
      policyKey: created.policy_key,
      title: created.title,
      status: created.status,
      dueAt: created.due_at,
      assigneeAdminId: created.assignee_admin_id,
      checklist: created.checklist,
      evidence: created.evidence,
      createdAt: created.created_at,
      updatedAt: created.updated_at,
    };
  }

  async updatePlatformComplianceTaskStatus(
    taskId: string,
    input: UpdatePlatformComplianceTaskStatusDto,
    context: RequestContextData,
  ) {
    const updated = await this.saasRepository.updatePlatformComplianceTaskStatus({
      taskId,
      status: input.status,
    });
    if (!updated) {
      throw new NotFoundException('Compliance task not found');
    }

    await this.auditService.log({
      action: 'platform.compliance_task_status_updated',
      storeId: null,
      storeUserId: null,
      targetType: 'platform_compliance_task',
      targetId: updated.id,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        status: updated.status,
      },
    });

    return {
      id: updated.id,
      status: updated.status,
      updatedAt: updated.updated_at,
    };
  }

  async addPlatformComplianceTaskComment(
    taskId: string,
    input: PlatformInternalCommentDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const item = await this.saasRepository.findPlatformComplianceTaskById(taskId);
    if (!item) {
      throw new NotFoundException('Compliance task not found');
    }
    const body = input.body.trim();
    if (!body) {
      throw new BadRequestException('Comment body is required');
    }
    const comments = Array.isArray(item.evidence.comments) ? item.evidence.comments : [];
    const updated = await this.saasRepository.updatePlatformComplianceTaskJson({
      taskId,
      evidence: {
        ...item.evidence,
        comments: [
          ...comments,
          {
            body,
            authorAdminId: currentUser.id,
            authorName: currentUser.fullName,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    await this.auditService.log({
      action: 'platform.compliance_task_comment_added',
      storeId: null,
      storeUserId: null,
      targetType: 'platform_compliance_task',
      targetId: taskId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });
    return updated ? SaasHelpers.toPlatformComplianceTaskResponse(updated) : null;
  }

  async addPlatformComplianceTaskEvidence(
    taskId: string,
    input: PlatformInternalCommentDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const item = await this.saasRepository.findPlatformComplianceTaskById(taskId);
    if (!item) {
      throw new NotFoundException('Compliance task not found');
    }
    const body = input.body.trim();
    if (!body) {
      throw new BadRequestException('Evidence body is required');
    }
    const entries = Array.isArray(item.evidence.entries) ? item.evidence.entries : [];
    const updated = await this.saasRepository.updatePlatformComplianceTaskJson({
      taskId,
      evidence: {
        ...item.evidence,
        entries: [
          ...entries,
          {
            body,
            authorAdminId: currentUser.id,
            authorName: currentUser.fullName,
            createdAt: new Date().toISOString(),
          },
        ],
      },
    });
    await this.auditService.log({
      action: 'platform.compliance_task_evidence_added',
      storeId: null,
      storeUserId: null,
      targetType: 'platform_compliance_task',
      targetId: taskId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });
    return updated ? SaasHelpers.toPlatformComplianceTaskResponse(updated) : null;
  }

  async getPlatformFinanceOverview() {
    return this.saasRepository.getPlatformFinanceOverview();
  }

  async getBillingSubscriptionsOverview() {
    return this.saasRepository.getBillingSubscriptionsOverview();
  }

  async getBillingReportSummary(input: {
    from?: string;
    to?: string;
    groupBy?: 'day' | 'week' | 'month';
    currency?: string;
  }) {
    const now = new Date();
    const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const from = input.from ? new Date(input.from) : defaultFrom;
    const to = input.to ? new Date(input.to) : now;
    const groupBy = input.groupBy ?? 'day';
    const currency = input.currency?.trim().toUpperCase() || null;
    return {
      range: {
        from: from.toISOString(),
        to: to.toISOString(),
        groupBy,
      },
      ...(await this.saasRepository.getBillingReportSummary({ from, to, groupBy, currency })),
    };
  }

  async listPlatformFinanceAging() {
    return this.saasRepository.listPlatformFinanceAging();
  }

  async listPlatformFinanceCollections(limit = 100) {
    const rows = await this.saasRepository.listPlatformFinanceCollections(limit);
    return rows.map((row) => ({
      invoiceId: row.invoice_id,
      invoiceNumber: row.invoice_number,
      storeId: row.store_id,
      storeName: row.store_name,
      status: row.status,
      dueAt: row.due_at,
      totalAmount: Number(row.total_amount),
      currencyCode: row.currency_code,
      updatedAt: row.updated_at,
    }));
  }
}
