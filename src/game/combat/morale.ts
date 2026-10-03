// Morale per monster row (docs/rules-adaptation.md, Morale), checked as SRD 5.3.1 suggests: when a
// group loses its first member, and when the side starts visibly losing (half its number down).
// Creatures that hold make an Instinct check (SRD 5.4.2). Sides in the party formation don't check.
import { actsOnInstinct, moraleHolds } from '../../rules/combat.ts';
import { say } from './damage.ts';
import type { Battle, Combatant, SideId } from './types.ts';

const lost = (c: Combatant) => c.status === 'dead' || c.status === 'out' || c.status === 'fled';

function checkGroup(b: Battle, side: SideId, group: number): void {
  const members = b.combatants.filter(
    (c) => c.side === side && c.group === group && c.status === 'active',
  );
  if (members.length === 0) return;
  // The steadiest member's Morale stands for the row.
  const morale = Math.max(...members.map((m) => m.morale));
  if (!moraleHolds(b.rng, morale)) {
    for (const m of members) m.status = 'fled';
    say(b, `Row ${group + 1} of ${b.sideNames[side]} breaks and flees.`);
    return;
  }
  for (const m of members) if (actsOnInstinct(b.rng, m.instinct)) m.instinctive = true;
}

function checkSide(b: Battle, side: SideId): void {
  const members = b.combatants.filter((c) => c.side === side);
  const groups = [...new Set(members.map((e) => e.group))];
  for (const group of groups) {
    const key = `${side}:${group}`;
    if (b.rowsChecked.has(key)) continue;
    if (!members.some((e) => e.group === group && (e.status === 'dead' || e.status === 'out')))
      continue;
    b.rowsChecked.add(key);
    checkGroup(b, side, group);
  }
  if (!b.halfChecked.has(side) && members.filter(lost).length * 2 >= b.startCount[side]) {
    b.halfChecked.add(side);
    for (const group of groups) checkGroup(b, side, group);
  }
}

export function checkMorale(b: Battle): void {
  for (const side of ['party', 'enemy'] as const) if (b.layout[side] === 'rows') checkSide(b, side);
}
