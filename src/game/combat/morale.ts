// Morale per monster row (docs/rules-adaptation.md, Morale), checked as SRD 5.3.1 suggests: when a
// group loses its first member, when the side starts visibly losing (half its number down), and,
// in a boss fight, when the boss falls. Creatures that hold make an Instinct check (SRD 5.4.2).
// A row that breaks surrenders or tries to escape by SRD 2.6.1's foot chase (vendor/wwn-srd/2.0
// The Rules of the Game/2.6.0 Chases and Pursuit.md; Phase 19: Morale, escape, and surrender).
// Sides in the party formation don't check.
import { actsOnInstinct, footChase, moraleHolds } from '../../rules/combat.ts';
import { UNTRAINED_PENALTY } from '../../rules/checks.ts';
import { say } from './damage.ts';
import { canAct, foeSide } from './targeting.ts';
import type { Battle, Combatant, SideId } from './types.ts';

/** Sam's call: a boss's side has +2 Morale while the boss stands. */
export const MINION_MORALE = 2;

const lost = (c: Combatant) => c.status === 'dead' || c.status === 'out' || c.status === 'fled';

/** Those on a side still fighting for it: able to act, not captives or hirelings, nor charmed. */
export const fighters = (b: Battle, side: SideId): Combatant[] =>
  b.combatants.filter((c) => c.side === side && canAct(c) && !c.noncombatant && !c.charm);

/** A chase's Exert total: a character's Exert and better of Dex or Con, a monster's skill bonus. */
export function exertTotal(c: Combatant): number {
  if (c.kind === 'monster') return c.skillBonus;
  return (c.skills.exert ?? UNTRAINED_PENALTY) + Math.max(c.modifiers.dex, c.modifiers.con);
}

/** The boss of a boss fight: the enemy with the most hit dice, the first in the line on a tie. */
export function markBoss(b: Battle): void {
  const foes = b.combatants.filter((c) => c.side === 'enemy');
  const boss = foes.reduce<Combatant | null>((a, c) => (!a || c.hitDice > a.hitDice ? c : a), null);
  b.boss = boss?.id ?? null;
}

const bossOf = (b: Battle, side: SideId) =>
  b.combatants.find((c) => c.id === b.boss && c.side === side);

/** The Morale bonus a boss's standing lends the rest of its side. */
export function moraleBonus(b: Battle, c: Combatant): number {
  const boss = bossOf(b, c.side);
  return boss && boss !== c && !lost(boss) ? MINION_MORALE : 0;
}

/** Whether the creature can give itself up to the other side: people, or beasts to a talker. */
const yields = (b: Battle, c: Combatant) =>
  c.mind === 'sapient' ||
  c.mind === 'monster' ||
  (c.mind === 'animal' && b.talksToBeasts[foeSide(c)]);

const names = (list: Combatant[]) => list.map((c) => c.name).join(', ');

function surrender(b: Battle, list: Combatant[], how: string): void {
  if (list.length === 0) return;
  for (const c of list) Object.assign(c, { status: 'fled', surrendered: true });
  say(b, `${names(list)} ${how}.`);
}

/** The broken row's runners try to get away; the caught give up or are cornered. */
function escape(b: Battle, side: SideId, fleeing: Combatant[]): void {
  // A blink always gets the creature away (Phase 19: the unicorn).
  const blinkers = fleeing.filter((c) => c.blink);
  for (const c of blinkers) c.status = 'fled';
  if (blinkers.length > 0) say(b, `${names(blinkers)} blinks out of sight.`);
  const runners = fleeing.filter((c) => !c.blink);
  if (runners.length === 0) return;
  const pursuers = fighters(b, side === 'party' ? 'enemy' : 'party');
  const chase = footChase(
    b.rng,
    Math.max(...runners.map(exertTotal)),
    Math.max(0, ...pursuers.map(exertTotal)),
    pursuers.length > runners.length,
  );
  if (!chase.caught || pursuers.length === 0) {
    for (const c of runners) c.status = 'fled';
    say(b, `${names(runners)} ${runners.length === 1 ? 'gets' : 'get'} away.`);
    return;
  }
  surrender(
    b,
    runners.filter((c) => yields(b, c)),
    'are run down and surrender',
  );
  const cornered = runners.filter((c) => !yields(b, c));
  if (cornered.length > 0) say(b, `${names(cornered)}, cornered, fight on.`);
}

/** A broken row: people surrender to stronger or faster foes, else run; beasts run. */
function breakRow(b: Battle, side: SideId, members: Combatant[]): void {
  const pursuers = fighters(b, side === 'party' ? 'enemy' : 'party');
  const outnumbered = pursuers.length > fighters(b, side).length;
  const outrun =
    pursuers.length > 0 &&
    Math.min(...pursuers.map((c) => c.move)) > Math.max(...members.map((c) => c.move));
  const hopeless = outnumbered || outrun;
  const givers = hopeless ? members.filter((c) => yields(b, c) && !c.blink) : [];
  surrender(b, givers, 'throw down their arms and surrender');
  escape(
    b,
    side,
    members.filter((c) => !givers.includes(c)),
  );
}

function checkGroup(b: Battle, side: SideId, group: number, boss: Combatant | undefined): void {
  // The boss never checks Morale; the rest of its side stand firmer while it stands.
  const members = b.combatants.filter(
    (c) => c.side === side && c.group === group && c.status === 'active' && c !== boss,
  );
  if (members.length === 0) return;
  const bonus = moraleBonus(b, members[0] as Combatant);
  // The steadiest member's Morale stands for the row.
  const morale = Math.max(...members.map((m) => m.morale));
  if (!moraleHolds(b.rng, morale, bonus)) {
    say(b, `Row ${group + 1} of ${b.sideNames[side]} breaks.`);
    breakRow(b, side, members);
    return;
  }
  for (const m of members) if (actsOnInstinct(b.rng, m.instinct)) m.instinctive = true;
}

function checkSide(b: Battle, side: SideId): void {
  const members = b.combatants.filter((c) => c.side === side);
  const groups = [...new Set(members.map((e) => e.group))];
  const boss = bossOf(b, side);
  for (const group of groups) {
    const key = `${side}:${group}`;
    if (b.rowsChecked.has(key)) continue;
    if (!members.some((e) => e.group === group && (e.status === 'dead' || e.status === 'out')))
      continue;
    b.rowsChecked.add(key);
    checkGroup(b, side, group, boss);
  }
  if (!b.halfChecked.has(side) && members.filter(lost).length * 2 >= b.startCount[side]) {
    b.halfChecked.add(side);
    for (const group of groups) checkGroup(b, side, group, boss);
  }
  // The boss's fall shakes every row of its side, which no longer stands firmer for it.
  if (boss && !b.bossFell && lost(boss)) {
    b.bossFell = true;
    say(b, `${boss.name} has fallen.`);
    for (const group of groups) checkGroup(b, side, group, boss);
  }
}

export function checkMorale(b: Battle): void {
  for (const side of ['party', 'enemy'] as const) if (b.layout[side] === 'rows') checkSide(b, side);
}
