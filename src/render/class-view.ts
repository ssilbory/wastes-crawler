// The class picker's list (Sam's call, docs/rules-adaptation.md, Class names): the single classes
// first, then the partial ones, each in content order, a partial class labeled with its halves.
import type { ClassOption } from '../data/schemas/index.ts';

export interface ClassChoice {
  id: string;
  name: string;
  label: string;
}

export function classChoices(options: readonly ClassOption[]): ClassChoice[] {
  return [...options.filter((c) => !c.halves), ...options.filter((c) => c.halves)].map((c) => ({
    id: c.id,
    name: c.name,
    label: c.halves ? `${c.name} (${c.halves})` : c.name,
  }));
}
