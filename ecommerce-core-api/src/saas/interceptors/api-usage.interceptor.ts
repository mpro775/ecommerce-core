import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { SaasService } from '../saas.service';

@Injectable()
export class ApiUsageInterceptor implements NestInterceptor {
  constructor(private readonly saasService: SaasService) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const request = context.switchToHttp().getRequest<Request & { storeId?: string }>();
    const storeId = request.storeId;
    const shouldTrack = Boolean(storeId) && this.shouldTrackRequest(request);

    if (shouldTrack && storeId) {
      try {
        await this.saasService.assertFeatureEnabled(storeId, 'api_access');
        await this.saasService.assertMetricCanGrow(storeId, 'api_calls.monthly', 1);
      } catch (error) {
        if (error instanceof UnprocessableEntityException) {
          throw new UnprocessableEntityException(
            'API quota reached for your current plan. Please upgrade to continue.',
          );
        }
        throw error;
      }
    }

    return next.handle().pipe(
      tap({
        next: () => {
          if (shouldTrack && storeId) {
            void this.recordApiUsage(storeId, request);
          }
        },
        error: () => {
          if (shouldTrack && storeId) {
            void this.recordApiUsage(storeId, request);
          }
        },
      }),
    );
  }

  private shouldTrackRequest(request: Request): boolean {
    if (request.method === 'OPTIONS') {
      return false;
    }

    return !(
      request.path.startsWith('/health') ||
      request.path.startsWith('/metrics') ||
      request.path.startsWith('/docs') ||
      request.path.startsWith('/billing') ||
      request.path.startsWith('/support') ||
      request.path.startsWith('/platform') ||
      request.path.startsWith('/auth/refresh') ||
      request.path.startsWith('/public/')
    );
  }

  private async recordApiUsage(storeId: string, request: Request): Promise<void> {
    try {
      await this.saasService.recordUsageEvent(storeId, 'api_calls.monthly', 1, {
        method: request.method,
        path: request.path,
      });
    } catch {
      return;
    }
  }
}
