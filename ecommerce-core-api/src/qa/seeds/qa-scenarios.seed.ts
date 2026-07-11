import { QaImportService } from '../qa-import.service';

export async function seedQaScenarios(importService: QaImportService) {
  return importService.importBundledScenarios(true);
}
