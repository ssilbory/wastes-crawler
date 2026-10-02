import type { SrdData } from '../../src/data/schemas/index.ts';

/** Checks that ids are unique per file and that references between files resolve. */
export function crossReferenceErrors(data: SrdData): string[] {
  const errors: string[] = [];
  for (const [name, records] of Object.entries(data)) {
    const seen = new Set<string>();
    for (const r of records as { id: string }[]) {
      if (seen.has(r.id)) errors.push(`${name}: duplicate id "${r.id}"`);
      seen.add(r.id);
    }
  }
  const traitIds = new Set(data['weapon-traits'].map((t) => t.id));
  for (const w of data.weapons) {
    for (const t of w.traits)
      if (!traitIds.has(t)) errors.push(`weapons/${w.id}: unknown trait ${t}`);
  }
  const artIds = new Set(data.arts.map((a) => a.id));
  for (const c of data['casting-progressions']) {
    for (const l of c.levels) {
      for (const a of l.arts) {
        if (!artIds.has(a))
          errors.push(`casting-progressions/${c.id} level ${l.level}: unknown art ${a}`);
      }
    }
  }
  for (const p of data.progressions) {
    p.levels.forEach((l, i) => {
      if (l.level !== i + 1) errors.push(`progressions/${p.id}: level ${l.level} at row ${i + 1}`);
    });
  }
  return errors;
}
