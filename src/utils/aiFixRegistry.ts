/**
 * AI Fix Registry — tracks which resource+field combinations have been
 * fixed by AI. Prevents the AI from re-suggesting fixes on fields that
 * were already corrected. Persists in localStorage across sessions.
 * Clears only when the app is uninstalled (localStorage cleared).
 */

const STORAGE_KEY = 'axiom_ai_fixed';

export interface AIFixEntry {
  resourceId: string;
  field: string;
  fixedAt: string;    // ISO timestamp
  label: string;      // human-readable description
}

function getRegistry(): AIFixEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRegistry(entries: AIFixEntry[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

/** Register a field as "fixed by AI" */
export function registerAIFix(resourceId: string, field: string, label: string): void {
  const registry = getRegistry();
  const key = `${resourceId}::${field}`;

  // Don't duplicate
  if (registry.some(e => `${e.resourceId}::${e.field}` === key)) return;

  registry.push({
    resourceId,
    field,
    fixedAt: new Date().toISOString(),
    label,
  });

  saveRegistry(registry);
}

/** Check if a resource+field was already fixed by AI */
export function wasFixedByAI(resourceId: string, field: string): boolean {
  const registry = getRegistry();
  return registry.some(e => e.resourceId === resourceId && e.field === field);
}

/** Filter out fixes that target already-AI-fixed fields */
export function filterAlreadyFixed<T extends { resourceId?: string; field?: string }>(
  fixes: T[]
): T[] {
  const registry = getRegistry();
  const fixedKeys = new Set(registry.map(e => `${e.resourceId}::${e.field}`));
  return fixes.filter(f => {
    if (!f.resourceId || !f.field) return true;
    return !fixedKeys.has(`${f.resourceId}::${f.field}`);
  });
}
