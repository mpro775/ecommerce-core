import { BadRequestException } from '@nestjs/common';
import { createQaScenarioChecksum } from './qa-scenario-checksum';

export interface NormalizedQaScenario {
  scenarioKey: string;
  title: string;
  description: string | null;
  version: string;
  checksum: string;
  sourceFile: string | null;
  metadata: Record<string, unknown>;
  snapshot: Record<string, unknown>;
  phases: NormalizedQaPhase[];
}

export interface NormalizedQaPhase {
  phaseKey: string;
  orderIndex: number;
  title: string;
  sourceTitle: string;
  goal: string | null;
  instructions: Array<Record<string, unknown>>;
  metadata: Record<string, unknown>;
  checks: NormalizedQaCheck[];
  questions: NormalizedQaQuestion[];
}

export interface NormalizedQaCheck {
  checkKey: string;
  orderIndex: number;
  text: string;
  type: string;
  required: boolean;
  weight: number | null;
  expectedResult: string | null;
  metadata: Record<string, unknown>;
}

export interface NormalizedQaQuestion {
  questionKey: string;
  orderIndex: number;
  text: string;
  type: string;
  required: boolean;
  options: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
}

export function normalizeQaScenario(input: unknown): NormalizedQaScenario {
  if (!isRecord(input)) {
    throw invalid('scenario must be an object');
  }

  const source = input;
  const scenarioKey = requiredString(source.scenarioKey ?? source.scenarioId, 'scenarioKey');
  const title = requiredString(source.title, 'title');
  const version = requiredString(source.version, 'version');
  const phasesInput = requiredArray(source.phases, 'phases');
  const checksum = createQaScenarioChecksum(source);

  const phases = phasesInput.map((phase, index) => normalizePhase(phase, index + 1));
  assertUnique(
    phases.map((phase) => phase.phaseKey),
    'phaseId',
  );

  return {
    scenarioKey,
    title,
    description: typeof source.description === 'string' ? source.description : null,
    version,
    checksum,
    sourceFile: typeof source.sourceFile === 'string' ? source.sourceFile : null,
    metadata: {
      slug: source.slug ?? null,
      codePrefix: source.codePrefix ?? null,
      language: source.language ?? null,
      direction: source.direction ?? null,
      status: source.status ?? null,
      tags: source.tags ?? [],
      estimatedDurationMinutes: source.estimatedDurationMinutes ?? null,
      preconditions: source.preconditions ?? [],
      testData: source.testData ?? [],
      sourceMetadata: source.metadata ?? {},
      sourceChecksum:
        typeof (source.metadata as Record<string, unknown> | undefined)?.checksum === 'string'
          ? ((source.metadata as Record<string, unknown>).checksum as string)
          : null,
    },
    snapshot: source,
    phases,
  };
}

function normalizePhase(input: unknown, fallbackOrder: number): NormalizedQaPhase {
  if (!isRecord(input)) {
    throw invalid(`phase[${fallbackOrder - 1}] must be an object`);
  }
  const source = input;
  const checks = optionalArray(source.checks, `phase[${fallbackOrder - 1}].checks`).map(
    (check, index) => normalizeCheck(check, index + 1),
  );
  const questions = optionalArray(source.questions, `phase[${fallbackOrder - 1}].questions`).map(
    (question, index) => normalizeQuestion(question, index + 1),
  );
  assertUnique(
    checks.map((check) => check.checkKey),
    'checkId',
  );
  assertUnique(
    questions.map((question) => question.questionKey),
    'questionId',
  );

  return {
    phaseKey: requiredString(
      source.phaseKey ?? source.phaseId,
      `phase[${fallbackOrder - 1}].phaseKey`,
    ),
    orderIndex: typeof source.order === 'number' ? source.order : fallbackOrder,
    title: requiredString(source.title, `phase[${fallbackOrder - 1}].title`),
    sourceTitle:
      typeof source.sourceTitle === 'string'
        ? source.sourceTitle
        : requiredString(source.title, `phase[${fallbackOrder - 1}].title`),
    goal: typeof source.objective === 'string' ? source.objective : null,
    instructions: optionalArray(
      source.instructions,
      `phase[${fallbackOrder - 1}].instructions`,
    ).filter(isRecord),
    metadata: {
      notes: source.notes ?? [],
      testData: source.testData ?? [],
    },
    checks,
    questions,
  };
}

function normalizeCheck(input: unknown, fallbackOrder: number): NormalizedQaCheck {
  if (!isRecord(input)) {
    throw invalid(`check[${fallbackOrder - 1}] must be an object`);
  }
  const source = input;
  return {
    checkKey: requiredString(
      source.checkKey ?? source.checkId,
      `check[${fallbackOrder - 1}].checkKey`,
    ),
    orderIndex: typeof source.order === 'number' ? source.order : fallbackOrder,
    text: requiredString(source.text, 'check.text'),
    type: typeof source.type === 'string' ? source.type : 'status',
    required: typeof source.required === 'boolean' ? source.required : true,
    weight: typeof source.weight === 'number' ? source.weight : null,
    expectedResult: typeof source.expectedResult === 'string' ? source.expectedResult : null,
    metadata: {
      allowAttachment: source.allowAttachment ?? true,
      allowIssue: source.allowIssue ?? true,
    },
  };
}

function normalizeQuestion(input: unknown, fallbackOrder: number): NormalizedQaQuestion {
  if (!isRecord(input)) {
    throw invalid(`question[${fallbackOrder - 1}] must be an object`);
  }
  const source = input;
  return {
    questionKey: requiredString(
      source.questionKey ?? source.questionId,
      `question[${fallbackOrder - 1}].questionKey`,
    ),
    orderIndex: typeof source.order === 'number' ? source.order : fallbackOrder,
    text: requiredString(source.text, 'question.text'),
    type: typeof source.type === 'string' ? source.type : 'textarea',
    required: typeof source.required === 'boolean' ? source.required : false,
    options: isRecord(source.options) ? source.options : null,
    metadata: {},
  };
}

function requiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalid(`missing ${field}`);
  }
  return value.trim();
}

function requiredArray(value: unknown, field: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw invalid(`${field} must be a non-empty array`);
  }
  return value;
}

function optionalArray(value: unknown, field: string): unknown[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw invalid(`${field} must be an array`);
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assertUnique(values: string[], label: string): void {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      throw new BadRequestException(`Duplicate ${label}: ${value}`);
    }
    seen.add(value);
  }
}

function invalid(message: string): BadRequestException {
  return new BadRequestException(`Invalid QA scenario JSON: ${message}`);
}
