import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import type { RequestContextData } from '../../common/utils/request-context.util';
import type { PlatformAdminUser } from '../../platform/interfaces/platform-admin-user.interface';
import type { ListSubscriptionInvoicesQueryDto } from '../dto/list-subscription-invoices-query.dto';
import type { PlatformInvoiceNoteDto } from '../dto/platform-invoice-note.dto';
import type { ProviderWebhookDto } from '../dto/provider-webhook.dto';
import type { SettleInvoiceDto } from '../dto/settle-invoice.dto';
import type { VoidInvoiceDto } from '../dto/void-invoice.dto';
import { SaasRepository } from '../saas.repository';
import { SaasHelpers } from './helpers';
import type { InvoiceResponse } from './types';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);

  constructor(
    private readonly saasRepository: SaasRepository,
    private readonly auditService: AuditService,
  ) {}

  async listStoreInvoices(
    currentUser: { storeId: string },
    query: ListSubscriptionInvoicesQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const result = await this.saasRepository.listInvoicesByStore({
      storeId: currentUser.storeId,
      status: query.status ?? null,
      limit,
      offset: (page - 1) * limit,
    });

    return {
      items: result.rows.map((row) => SaasHelpers.toInvoiceResponse(row)),
      total: result.total,
      page,
      limit,
    };
  }

  async settleInvoice(
    invoiceId: string,
    input: SettleInvoiceDto,
    context: RequestContextData,
  ): Promise<InvoiceResponse> {
    const invoice = await this.saasRepository.findInvoiceById(invoiceId);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    if (invoice.status === 'paid') {
      throw new BadRequestException('Invoice is already paid');
    }
    if (invoice.status === 'void' || invoice.status === 'refunded') {
      throw new BadRequestException(`Invoice status ${invoice.status} cannot be settled`);
    }

    const paid = input.paymentStatus === 'succeeded';
    await this.saasRepository.updateInvoiceStatus({
      invoiceId,
      status: paid ? 'paid' : 'failed',
      paidAt: paid ? new Date() : null,
      metadata: {
        settledBy: 'platform_admin',
      },
    });

    await this.saasRepository.createPayment({
      invoiceId: invoice.id,
      storeId: invoice.store_id,
      provider: input.provider ?? 'manual',
      paymentMethod: input.paymentMethod ?? null,
      status: paid ? 'succeeded' : 'failed',
      amount: input.amount ? Number(input.amount) : Number(invoice.total_amount),
      currencyCode: input.currencyCode ?? invoice.currency_code,
      externalTransactionId: input.externalTransactionId ?? null,
      failureReason: input.failureReason ?? null,
      processedAt: new Date(),
      metadata: {},
    });

    if (paid) {
      await this.saasRepository.updateSubscriptionStatus(invoice.store_id, 'active');
      await this.saasRepository.setStoreSuspension({
        storeId: invoice.store_id,
        isSuspended: false,
        reason: null,
      });
    } else {
      await this.saasRepository.updateSubscriptionStatus(invoice.store_id, 'past_due');
      await this.saasRepository.setStoreSuspension({
        storeId: invoice.store_id,
        isSuspended: true,
        reason: input.failureReason ?? 'Invoice payment failed',
      });
    }

    await this.auditService.log({
      action: 'platform.invoice_settled',
      storeId: invoice.store_id,
      storeUserId: null,
      targetType: 'subscription_invoice',
      targetId: invoiceId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: {
        requestId: context.requestId,
        paymentStatus: input.paymentStatus,
      },
    });

    const refreshed = await this.saasRepository.findInvoiceById(invoiceId);
    if (!refreshed) {
      throw new NotFoundException('Invoice not found');
    }
    return SaasHelpers.toInvoiceResponse(refreshed);
  }

  async getPlatformInvoiceById(invoiceId: string) {
    const invoice = await this.saasRepository.findPlatformInvoiceDetailsById(invoiceId);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    const [payments, audit] = await Promise.all([
      this.saasRepository.listPaymentsByInvoice(invoiceId),
      this.saasRepository.listAuditLogsByTarget('subscription_invoice', invoiceId),
    ]);
    return {
      invoice: {
        ...SaasHelpers.toInvoiceResponse(invoice),
        storeId: invoice.store_id,
        storeName: invoice.store_name,
        storeSlug: invoice.store_slug,
        subscriptionId: invoice.subscription_id,
        subscriptionStatus: invoice.subscription_status,
        planId: invoice.plan_id,
        planCode: invoice.plan_code,
        planName: invoice.plan_name,
        metadata: invoice.metadata,
        externalInvoiceId: invoice.external_invoice_id,
      },
      lineItems: Array.isArray(invoice.metadata.lineItems)
        ? invoice.metadata.lineItems
        : [
            {
              description: invoice.plan_name ?? invoice.billing_cycle,
              amount: Number(invoice.subtotal_amount),
              currencyCode: invoice.currency_code,
            },
          ],
      payments: payments.map((payment) => ({
        id: payment.id,
        provider: payment.provider,
        paymentMethod: payment.payment_method,
        status: payment.status,
        amount: Number(payment.amount),
        currencyCode: payment.currency_code,
        externalTransactionId: payment.external_transaction_id,
        failureReason: payment.failure_reason,
        processedAt: payment.processed_at,
        createdAt: payment.created_at,
      })),
      notes: Array.isArray(invoice.metadata.notes) ? invoice.metadata.notes : [],
      timeline: audit.map((event) => ({
        id: event.id,
        type: event.action,
        payload: event.metadata,
        createdAt: event.created_at,
      })),
    };
  }

  async addPlatformInvoiceNote(
    invoiceId: string,
    input: PlatformInvoiceNoteDto,
    currentUser: PlatformAdminUser,
    context: RequestContextData,
  ) {
    const invoice = await this.saasRepository.findInvoiceById(invoiceId);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    const body = input.body.trim();
    if (!body) {
      throw new BadRequestException('Note body is required');
    }
    const notes = Array.isArray(invoice.metadata.notes) ? invoice.metadata.notes : [];
    await this.saasRepository.updateInvoiceStatus({
      invoiceId,
      status: invoice.status,
      paidAt: invoice.paid_at,
      metadata: {
        ...invoice.metadata,
        notes: [
          ...notes,
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
      action: 'platform.invoice_note_added',
      storeId: invoice.store_id,
      storeUserId: null,
      targetType: 'subscription_invoice',
      targetId: invoiceId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId },
    });
    return this.getPlatformInvoiceById(invoiceId);
  }

  async voidPlatformInvoice(invoiceId: string, input: VoidInvoiceDto, context: RequestContextData) {
    const invoice = await this.saasRepository.findInvoiceById(invoiceId);
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException('Void reason is required');
    }
    if (invoice.status === 'paid' || invoice.status === 'refunded') {
      throw new BadRequestException('Paid or refunded invoices cannot be voided');
    }
    if (invoice.status === 'void') {
      throw new BadRequestException('Invoice is already void');
    }
    await this.saasRepository.updateInvoiceStatus({
      invoiceId,
      status: 'void',
      paidAt: null,
      metadata: {
        ...invoice.metadata,
        voidReason: reason,
        voidedAt: new Date().toISOString(),
      },
    });
    await this.auditService.log({
      action: 'platform.invoice_voided',
      storeId: invoice.store_id,
      storeUserId: null,
      targetType: 'subscription_invoice',
      targetId: invoiceId,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      metadata: { requestId: context.requestId, oldStatus: invoice.status, reason },
    });
    return this.getPlatformInvoiceById(invoiceId);
  }

  async handleProviderWebhook(
    input: ProviderWebhookDto,
  ): Promise<{ processed: boolean; reason?: string }> {
    const existing = await this.saasRepository.findBillingEventBySourceAndIdempotency(
      'provider_webhook',
      input.idempotencyKey,
    );
    if (existing) {
      return { processed: false, reason: 'duplicate' };
    }

    const event = await this.saasRepository.createBillingEvent({
      storeId: input.storeId ?? null,
      source: 'provider_webhook',
      eventType: input.eventType,
      idempotencyKey: input.idempotencyKey,
      payload: input.payload ?? {},
      status: 'received',
    });

    try {
      await this.processProviderWebhookEvent(input);
      await this.saasRepository.updateBillingEventStatus({
        billingEventId: event.id,
        status: 'processed',
        processedAt: new Date(),
      });
      return { processed: true };
    } catch (error) {
      await this.saasRepository.updateBillingEventStatus({
        billingEventId: event.id,
        status: 'failed',
        processingError: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  private async processProviderWebhookEvent(input: ProviderWebhookDto): Promise<void> {
    if (input.eventType === 'invoice.paid') {
      if (!input.externalInvoiceId) {
        throw new BadRequestException('externalInvoiceId is required for invoice.paid');
      }
      const invoice = await this.saasRepository.findInvoiceByExternalInvoiceId(
        input.externalInvoiceId,
      );
      if (!invoice) {
        throw new NotFoundException('Invoice not found for externalInvoiceId');
      }

      await this.saasRepository.updateInvoiceStatus({
        invoiceId: invoice.id,
        status: 'paid',
        paidAt: new Date(),
      });
      await this.saasRepository.updateSubscriptionStatus(invoice.store_id, 'active');
      await this.saasRepository.setStoreSuspension({
        storeId: invoice.store_id,
        isSuspended: false,
        reason: null,
      });
      return;
    }

    if (input.eventType === 'invoice.failed') {
      if (!input.externalInvoiceId) {
        throw new BadRequestException('externalInvoiceId is required for invoice.failed');
      }
      const invoice = await this.saasRepository.findInvoiceByExternalInvoiceId(
        input.externalInvoiceId,
      );
      if (!invoice) {
        throw new NotFoundException('Invoice not found for externalInvoiceId');
      }

      await this.saasRepository.updateInvoiceStatus({
        invoiceId: invoice.id,
        status: 'failed',
      });
      await this.saasRepository.updateSubscriptionStatus(invoice.store_id, 'past_due');
      await this.saasRepository.setStoreSuspension({
        storeId: invoice.store_id,
        isSuspended: true,
        reason: 'Subscription invoice failed',
      });
      return;
    }

    if (input.eventType === 'subscription.canceled') {
      if (!input.externalSubscriptionId) {
        throw new BadRequestException(
          'externalSubscriptionId is required for subscription.canceled',
        );
      }
      const subscription =
        await this.saasRepository.findCurrentSubscriptionByProviderSubscriptionId(
          input.externalSubscriptionId,
        );
      if (!subscription) {
        return;
      }
      await this.saasRepository.updateSubscriptionStatus(subscription.store_id, 'canceled');
      await this.saasRepository.setStoreSuspension({
        storeId: subscription.store_id,
        isSuspended: true,
        reason: 'Subscription canceled by provider',
      });
      return;
    }
  }

  async listPlatformBillingEvents(limit = 50) {
    const rows = await this.saasRepository.listRecentBillingEvents(limit);
    return rows.map((row) => ({
      id: row.id,
      storeId: row.store_id,
      source: row.source,
      eventType: row.event_type,
      idempotencyKey: row.idempotency_key,
      status: row.status,
      processingError: row.processing_error,
      processedAt: row.processed_at,
      createdAt: row.created_at,
    }));
  }
}
