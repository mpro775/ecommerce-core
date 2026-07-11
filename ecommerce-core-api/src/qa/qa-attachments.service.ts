import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_BYTES } from '../media/media.constants';
import { STORAGE_ADAPTER, type StorageAdapter } from '../media/storage.adapter';
import type { PlatformAdminUser } from '../platform/interfaces/platform-admin-user.interface';
import type { ConfirmQaAttachmentDto } from './dto/confirm-qa-attachment.dto';
import type { CreateQaAttachmentPresignDto } from './dto/create-qa-attachment-presign.dto';
import { QaRepository } from './qa.repository';
import { canManageQa } from './qa.service';
import { safeObjectKeySegment } from './utils/qa-id.util';

@Injectable()
export class QaAttachmentsService {
  constructor(
    private readonly qaRepository: QaRepository,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
  ) {}

  async createPresignedUpload(
    runId: string,
    body: CreateQaAttachmentPresignDto,
    user: PlatformAdminUser,
  ) {
    const run = await this.qaRepository.findRunById(runId);
    if (!run) {
      throw new NotFoundException('QA run not found');
    }
    this.assertRunAccess(run.tester_id, user);
    this.assertRunWritable(run.locked_at, run.status);
    this.validateFile(body.mimeType, body.sizeBytes);
    await this.assertTargetBelongsToRun(run.id, run.scenario_id, body);

    const objectKey = this.buildObjectKey(run.id, body.targetType, body.fileName);
    const upload = await this.storageAdapter.getPresignedPutUrl({
      key: objectKey,
      contentType: body.mimeType,
    });

    await this.qaRepository.logRunEvent({
      runId: run.id,
      eventType: 'attachment_presigned',
      actorId: user.id,
      metadata: {
        targetType: body.targetType,
        objectKey,
        mimeType: body.mimeType,
        sizeBytes: body.sizeBytes,
      },
    });

    return {
      objectKey,
      uploadUrl: upload.url,
      uploadHeaders: upload.headers,
      expiresAt: upload.expiresAt,
      maxFileSizeBytes: MAX_UPLOAD_BYTES,
    };
  }

  async confirmUpload(runId: string, body: ConfirmQaAttachmentDto, user: PlatformAdminUser) {
    const run = await this.qaRepository.findRunById(runId);
    if (!run) {
      throw new NotFoundException('QA run not found');
    }
    this.assertRunAccess(run.tester_id, user);
    this.assertRunWritable(run.locked_at, run.status);
    this.validateFile(body.mimeType, body.sizeBytes);
    await this.assertTargetBelongsToRun(run.id, run.scenario_id, body);
    if (!body.objectKey.startsWith(`qa-runs/${run.id}/`)) {
      throw new BadRequestException('Object key does not belong to this QA run');
    }

    const head = await this.storageAdapter.headObject(body.objectKey);
    if (!head) {
      throw new BadRequestException('Uploaded object was not found in storage');
    }
    const actualMimeType = head.contentType ?? body.mimeType;
    const actualSize = head.contentLength ?? body.sizeBytes;
    this.validateFile(actualMimeType, actualSize);
    if (actualMimeType !== body.mimeType) {
      throw new BadRequestException('Uploaded content type does not match confirmation payload');
    }
    if (actualSize !== body.sizeBytes) {
      throw new BadRequestException('Uploaded file size does not match confirmation payload');
    }

    const attachment = await this.qaRepository.createAttachment({
      run,
      issueId: body.issueId,
      phaseId: body.phaseId,
      checkId: body.checkId,
      questionId: body.questionId,
      targetType: body.targetType,
      bucketName: this.storageAdapter.getBucketName(),
      objectKey: body.objectKey,
      mimeType: actualMimeType,
      fileSizeBytes: actualSize,
      etag: head.etag ?? body.etag ?? null,
      fileName: body.fileName,
      uploadedBy: user.id,
      metadata: {
        requestedBy: user.email,
      },
    });
    await this.qaRepository.logRunEvent({
      runId: run.id,
      eventType: 'attachment_confirmed',
      actorId: user.id,
      metadata: { attachmentId: attachment.id },
    });
    return attachment;
  }

  async createDownloadUrl(attachmentId: string, user: PlatformAdminUser) {
    const attachment = await this.qaRepository.findAttachmentById(attachmentId);
    if (!attachment) {
      throw new NotFoundException('QA attachment not found');
    }
    const run = await this.qaRepository.findRunById(attachment.run_id);
    if (!run) {
      throw new NotFoundException('QA run not found');
    }
    this.assertRunAccess(run.tester_id, user);
    const download = await this.storageAdapter.getPresignedGetUrl({
      key: attachment.object_key,
    });
    return {
      url: download.url,
      expiresAt: download.expiresAt,
      headers: download.headers,
    };
  }

  private validateFile(mimeType: string, sizeBytes: number): void {
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(mimeType)) {
      throw new BadRequestException('Unsupported file type');
    }
    if (sizeBytes <= 0 || sizeBytes > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`File size must be between 1 and ${MAX_UPLOAD_BYTES} bytes`);
    }
  }

  private assertRunAccess(testerId: string | null, user: PlatformAdminUser): void {
    if (!canManageQa(user) && testerId !== user.id) {
      throw new BadRequestException('You do not have access to this QA run');
    }
  }

  private assertRunWritable(lockedAt: Date | null, status: string): void {
    if (lockedAt || status === 'completed') {
      throw new BadRequestException('QA run is completed and locked');
    }
  }

  private async assertTargetBelongsToRun(
    runId: string,
    scenarioId: string,
    body: CreateQaAttachmentPresignDto,
  ): Promise<void> {
    if (body.targetType === 'phase' && !body.phaseId) {
      throw new BadRequestException('phaseId is required for phase attachments');
    }
    if (body.targetType === 'check' && !body.checkId) {
      throw new BadRequestException('checkId is required for check attachments');
    }
    if (body.targetType === 'question' && !body.questionId) {
      throw new BadRequestException('questionId is required for question attachments');
    }
    if (body.targetType === 'issue' && !body.issueId) {
      throw new BadRequestException('issueId is required for issue attachments');
    }
    if (body.phaseId && !(await this.qaRepository.findPhaseById(body.phaseId, scenarioId))) {
      throw new BadRequestException('phaseId does not belong to the QA run scenario');
    }
    if (body.checkId && !(await this.qaRepository.findCheckById(body.checkId, scenarioId))) {
      throw new BadRequestException('checkId does not belong to the QA run scenario');
    }
    if (
      body.questionId &&
      !(await this.qaRepository.findQuestionById(body.questionId, scenarioId))
    ) {
      throw new BadRequestException('questionId does not belong to the QA run scenario');
    }
    if (body.issueId) {
      const issue = await this.qaRepository.findIssueById(body.issueId);
      if (!issue || issue.run_id !== runId) {
        throw new BadRequestException('issueId does not belong to the QA run');
      }
    }
  }

  private buildObjectKey(runId: string, targetType: string, fileName: string): string {
    const safeName = safeObjectKeySegment(fileName);
    return `qa-runs/${runId}/${targetType}/${Date.now()}-${safeName}`;
  }
}
