// What the fight screen shows moving (docs/presentation-plan.md, V3): who acts next this round, and
// the numbers that float up off a slot after a batch of turns. Read-only; the blows come from the
// battle's events (src/game/combat/attack.ts) and everything else from the change in HP.
import { describe } from '../game/combat/commands.ts';
import { canAct } from '../game/combat/targeting.ts';
import type { Battle, BattleEvent, SideId } from '../game/combat/types.ts';

export interface TurnView {
  id: string;
  label: string;
  side: SideId;
  /** Whose turn it is now. */
  now: boolean;
}

/** The turns left this round, in order, skipping anyone who can no longer act. */
export function turnOrder(b: Battle, actorId: string | null): TurnView[] {
  return b.queue.flatMap((id) => {
    const c = b.combatants.find((x) => x.id === id);
    if (!c || !canAct(c)) return [];
    return [{ id, label: describe(c), side: c.side, now: id === actorId }];
  });
}

export interface Float {
  text: string;
  kind: BattleEvent['kind'] | 'harm' | 'heal';
}

/** The most numbers one slot shows from one batch, the latest kept. */
export const MAX_FLOATS = 4;

const TEXT: Record<BattleEvent['kind'], (n: number) => string> = {
  hit: (n) => `-${n}`,
  shock: (n) => `-${n} Shock`,
  miss: () => 'miss',
  turned: () => 'turned',
};

/**
 * The numbers to float over each slot after a batch of turns: every blow since `eventsFrom`, and,
 * for anyone whose HP changed without a blow (a spell, a fire, a healing), the change itself.
 */
export function floats(
  b: Battle,
  eventsFrom: number,
  hpBefore: ReadonlyMap<string, number>,
): Map<string, Float[]> {
  const out = new Map<string, Float[]>();
  const add = (id: string, f: Float) => out.set(id, [...(out.get(id) ?? []), f]);
  for (const e of (b.events ?? []).slice(eventsFrom))
    add(e.target, { text: TEXT[e.kind](e.amount), kind: e.kind });
  for (const c of b.combatants) {
    const before = hpBefore.get(c.id);
    if (before === undefined || before === c.hp || out.has(c.id)) continue;
    const delta = c.hp - before;
    add(c.id, delta < 0 ? { text: `${delta}`, kind: 'harm' } : { text: `+${delta}`, kind: 'heal' });
  }
  for (const [id, list] of out) out.set(id, list.slice(-MAX_FLOATS));
  return out;
}

/** How a slot flashes for its numbers: struck by any harm, else healed, else missed. */
export function flash(list: readonly Float[] | undefined): 'struck' | 'healed' | 'missed' | null {
  if (!list || list.length === 0) return null;
  if (list.some((f) => f.kind === 'hit' || f.kind === 'shock' || f.kind === 'harm'))
    return 'struck';
  return list.some((f) => f.kind === 'heal') ? 'healed' : 'missed';
}
