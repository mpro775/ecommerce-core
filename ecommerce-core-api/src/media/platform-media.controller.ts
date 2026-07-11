import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { v4 as uuidv4 } from 'uuid';
import { PlatformAccessTokenGuard } from '../platform/guards/platform-access-token.guard';
import { PlatformPermissionsGuard } from '../platform/guards/platform-permissions.guard';
import { PLATFORM_PERMISSIONS } from '../platform/constants/platform-permissions.constants';
import { RequirePlatformPermissions } from '../platform/decorators/require-platform-permissions.decorator';
import { CurrentPlatformUser } from '../platform/decorators/current-platform-user.decorator';
import type { PlatformAdminUser } from '../platform/interfaces/platform-admin-user.interface';
import { PresignMediaUploadDto } from './dto/presign-media-upload.dto';
import { ConfirmMediaUploadDto } from './dto/confirm-media-upload.dto';
import { ALLOWED_UPLOAD_MIME_TYPES, MAX_UPLOAD_BYTES } from './media.constants';
import { MediaRepository, type MediaAssetRecord } from './media.repository';
import { STORAGE_ADAPTER, type StorageAdapter } from './storage.adapter';
import { BadRequestException, NotFoundException } from '@nestjs/common';

const PLATFORM_MEDIA_NAMESPACE = '__platform__';

interface PlatformMediaResponse {
  id: string;
  url: string;
}

@ApiTags('platform-media')
@ApiBearerAuth()
@Controller('platform/media')
@UseGuards(PlatformAccessTokenGuard, PlatformPermissionsGuard)
export class PlatformMediaController {
  constructor(
    private readonly mediaRepository: MediaRepository,
    @Inject(STORAGE_ADAPTER) private readonly storageAdapter: StorageAdapter,
  ) {}

  @Post('presign-upload')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.paymentMethodsWrite)
  async presignUpload(
    @CurrentPlatformUser() _user: PlatformAdminUser,
    @Body() body: PresignMediaUploadDto,
  ) {
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(body.contentType)) {
      throw new BadRequestException('Unsupported file type');
    }
    if (body.fileSizeBytes <= 0 || body.fileSizeBytes > MAX_UPLOAD_BYTES) {
      throw new BadRequestException(`File size must be between 1 and ${MAX_UPLOAD_BYTES} bytes`);
    }

    const extension = body.fileName?.split('.').pop()?.toLowerCase() ?? 'png';
    const objectKey = `${PLATFORM_MEDIA_NAMESPACE}/${Date.now()}-${uuidv4()}.${extension}`;

    const upload = await this.storageAdapter.getPresignedPutUrl({
      key: objectKey,
      contentType: body.contentType,
    });

    return {
      objectKey,
      uploadUrl: upload.url,
      uploadHeaders: upload.headers,
      expiresAt: upload.expiresAt,
      maxFileSizeBytes: MAX_UPLOAD_BYTES,
    };
  }

  @Post('confirm')
  @HttpCode(HttpStatus.OK)
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.paymentMethodsWrite)
  async confirmUpload(
    @CurrentPlatformUser() _user: PlatformAdminUser,
    @Body() body: ConfirmMediaUploadDto,
  ) {
    if (!body.objectKey.startsWith(`${PLATFORM_MEDIA_NAMESPACE}/`)) {
      throw new BadRequestException('Invalid object key');
    }

    const existing = await this.mediaRepository.findByObjectKey(
      PLATFORM_MEDIA_NAMESPACE,
      body.objectKey,
    );
    if (existing) {
      return this.toResponse(existing);
    }

    const objectHead = await this.storageAdapter.headObject(body.objectKey);
    if (!objectHead) {
      throw new BadRequestException('Uploaded object was not found in storage');
    }

    const mimeType = objectHead.contentType ?? body.contentType ?? 'application/octet-stream';
    const fileSizeBytes = objectHead.contentLength ?? body.fileSizeBytes ?? 0;
    const etag = objectHead.etag?.replace(/^"|"$/g, '').trim() ?? null;

    const asset = await this.mediaRepository.create({
      storeId: PLATFORM_MEDIA_NAMESPACE,
      uploadedBy: null,
      bucketName: this.storageAdapter.getBucketName(),
      objectKey: body.objectKey,
      publicUrl: this.storageAdapter.getPublicUrl(body.objectKey),
      etag,
      mimeType,
      fileSizeBytes,
      metadata: { fileName: body.fileName, source: 'platform.payment_method_icon' },
    });

    return this.toResponse(asset);
  }

  @Get(':mediaAssetId')
  @RequirePlatformPermissions(PLATFORM_PERMISSIONS.paymentMethodsRead)
  async getById(
    @CurrentPlatformUser() _user: PlatformAdminUser,
    @Param('mediaAssetId', ParseUUIDPipe) mediaAssetId: string,
  ) {
    const asset = await this.mediaRepository.findById(PLATFORM_MEDIA_NAMESPACE, mediaAssetId);
    if (!asset) {
      throw new NotFoundException('Media asset not found');
    }
    return this.toResponse(asset);
  }

  private toResponse(asset: MediaAssetRecord): PlatformMediaResponse {
    return {
      id: asset.id,
      url: asset.public_url,
    };
  }
}
