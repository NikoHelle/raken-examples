/**
 * Next `${prefix}${n}` id after the highest one already in `ids` — derived from state, not a module
 * counter, so it stays unique after a snapshot restore into a fresh module (and is deterministic).
 */
export function nextId(prefix: string, ids: Iterable<string>): string {
  let max = 0;
  for (const id of ids) {
    const n = id.startsWith(prefix) ? Number(id.slice(prefix.length)) : NaN;
    if (Number.isInteger(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}
