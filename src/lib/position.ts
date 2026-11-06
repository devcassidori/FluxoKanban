// Posições fracionárias: inserir entre dois itens não exige renumerar a lista.
export const STEP = 1024;

export function positionBetween(before: number | null | undefined, after: number | null | undefined): number {
  if (before == null && after == null) return STEP;
  if (before == null) return (after as number) - STEP;
  if (after == null) return before + STEP;
  return (before + after) / 2;
}

/** Posição para colocar um item no índice `index` de uma lista já ordenada (sem o próprio item). */
export function positionAt<T extends { position: number }>(sorted: T[], index: number): number {
  const before = index > 0 ? sorted[index - 1]?.position : null;
  const after = index < sorted.length ? sorted[index]?.position : null;
  return positionBetween(before, after);
}

export function byPosition<T extends { position: number; created_at?: string }>(a: T, b: T) {
  return a.position - b.position || (a.created_at ?? "").localeCompare(b.created_at ?? "");
}
