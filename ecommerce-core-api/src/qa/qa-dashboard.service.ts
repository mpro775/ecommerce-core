import { Injectable } from '@nestjs/common';
import type { QaDashboardQueryDto } from './dto/dashboard-query.dto';
import { QaRepository } from './qa.repository';

@Injectable()
export class QaDashboardService {
  constructor(private readonly qaRepository: QaRepository) {}

  async getDashboard(query: QaDashboardQueryDto) {
    return this.qaRepository.getDashboard(query);
  }
}
