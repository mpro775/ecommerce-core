import { createHash } from 'node:crypto';

export function createQaScenarioChecksum(value: unknown): string {
  const stable = JSON.stringify(sortJson(value));
  return `sha256:${createHash('sha256').update(stable).digest('hex')}`;
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sortJson(item)]),
    );
  }
  return value;
}
