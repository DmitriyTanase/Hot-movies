export type PageItem = number | 'ellipsis';

const SIBLINGS = 1; // pages on each side of the current page
const SLOTS = 2 * SIBLINGS + 5; // first + gap + window + gap + last

const range = (from: number, to: number): number[] =>
  Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

/** Precondition: total >= 0; 1 <= current <= max(total, 1). Fixed length (7) when total > 7. */
export function pageWindow(current: number, total: number): PageItem[] {
  if (total <= SLOTS) return range(1, total);
  if (current <= SIBLINGS + 3) return [...range(1, SLOTS - 2), 'ellipsis', total];
  if (current >= total - SIBLINGS - 2) return [1, 'ellipsis', ...range(total - SLOTS + 3, total)];
  return [1, 'ellipsis', ...range(current - SIBLINGS, current + SIBLINGS), 'ellipsis', total];
}
