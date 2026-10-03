// Morale per enemy row (docs/rules-adaptation.md, Morale), checked as SRD 5.3.1 suggests: when a
// group loses its first member, and when the side starts visibly losing (half its number down).
// Creatures that hold make an Instinct check (SRD 5.4.2).
import { actsOnInstinct, moraleHolds } from '../../rules/combat.ts';
import { say } from './damage.ts';
import type { Battle, Combatant } from './types.ts';

const lost = (c: Combatant) => c.status === 'dead' || c.status === 'out' || c.status === 'fled';

function checkGroup(b: Battle, group: number): void {
  const members = b.combatants.filter(
    (c) => c.side === 'enemy' && c.group === group && c.status === 'active',
  );
  if (members.length === 0) return;
  // The steadiest member's Morale stands for the row.
  const morale = Math.max(...members.map((m) => m.morale));
  if (!moraleHolds(b.rng, morale)) {
    for (const m of members) m.status = 'fled';
    say(b, `The enemy's row ${group + 1} breaks and flees.`);
    return;
  }
  for (const m of members) if (actsOnInstinct(b.rng, m.instinct)) m.instinctive = true;
}

export function checkMorale(b: Battle): void {
  const enemies = b.combatants.filter((c) => c.side === 'enemy');
  for (const group of new Set(enemies.map((e) => e.group))) {
    if (b.rowsChecked.has(group)) continue;
    if (!enemies.some((e) => e.group === group && (e.status === 'dead' || e.status === 'out')))
      continue;
    b.rowsChecked.add(group);
    checkGroup(b, group);
  }
  if (!b.halfChecked && enemies.filter(lost).length * 2 >= b.enemyStart) {
    b.halfChecked = true;
    for (const group of new Set(enemies.map((e) => e.group))) checkGroup(b, group);
  }
}
