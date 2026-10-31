// Charm and possession (docs/rules-adaptation.md, Charm and possession in Phase 19; Sam's call:
// a creature can be turned against its own side). A charming gaze, the vampire's (its description
// in data/content/monsters.json: "its gaze bends the will"), turns one foe who fails the save to
// strike at its own side until it throws the charm off with a save at the end of a round, or the
// charmer falls. The dead who carried a disease that raises them, Grave Rot (the gnawing dead's
// description: "those who die of the sickness do not stay down"), rise at the end of the round in
// their foes' front row.
import type { SaveType } from '../../rules/saves.ts';
import { say } from './damage.ts';
import { monsterCombatant } from './monster-combatant.ts';
import { save } from './saves.ts';
import { foeSide, isUp } from './targeting.ts';
import type { Action, Battle, Combatant } from './types.ts';

/** Who the actor would gaze at now: the strongest foe standing, once a fight. */
export function gazeTarget(b: Battle, actor: Combatant): Combatant | null {
  if (!actor.charmSave || actor.gazed) return null;
  const open = b.combatants.filter(
    (c) =>
      c.side !== actor.side &&
      c.status === 'active' &&
      !c.noncombatant &&
      !c.amber &&
      !c.misted &&
      !c.tags.has('unliving'),
  );
  return open.reduce<Combatant | null>(
    (a, c) => (!a || c.hitDice > a.hitDice || (c.hitDice === a.hitDice && c.hp > a.hp) ? c : a),
    null,
  );
}

/** The gaze, when the actor has someone to turn. */
export function gazeAction(b: Battle, actor: Combatant): Action | null {
  const t = gazeTarget(b, actor);
  return t ? { kind: 'gaze', target: t.id } : null;
}

/** A charming gaze: the target saves or turns on its own side. */
export function gaze(b: Battle, actor: Combatant, target: Combatant | undefined): void {
  if (!target || !actor.charmSave || target !== gazeTarget(b, actor)) return;
  actor.gazed = true;
  if (save(b, target, actor.charmSave).success) {
    say(b, `${target.name} meets ${actor.name}'s gaze and holds firm.`);
    return;
  }
  target.charm = { by: actor.id, side: actor.side };
  say(b, `${target.name} falls under ${actor.name}'s spell and turns on their own side.`);
}

/** At the end of the round the charmed save to throw it off; it ends when the charmer falls. */
export function throwOffCharms(b: Battle): void {
  for (const c of b.combatants) {
    if (!c.charm) continue;
    const charmer = b.combatants.find((x) => x.id === c.charm?.by) as Combatant;
    if (isUp(c) && isUp(charmer) && !save(b, c, charmer.charmSave as SaveType).success) continue;
    c.charm = null;
    if (isUp(c)) say(b, `${c.name} shakes off ${charmer.name}'s charm.`);
  }
}

/** A fight's end frees everyone from charms. */
export function endCharms(b: Battle): void {
  for (const c of b.combatants) c.charm = null;
}

/** The disease a combatant dies with that raises its corpse, if any. */
function risesAs(b: Battle, c: Combatant): string | null {
  const id = c.caught ?? c.carries;
  return b.data.content.ailments.diseases.find((d) => d.id === id)?.rises ?? null;
}

/** The party's dead who carried a raising disease rise in the foes' front row. */
export function raiseTheDead(b: Battle): void {
  for (const c of b.combatants) {
    const monster = c.side === 'party' && c.status === 'dead' && !c.rose ? risesAs(b, c) : null;
    const side = foeSide(c);
    if (!monster || c.tags.has('unliving') || b.layout[side] !== 'rows') continue;
    c.rose = true;
    const kin = b.combatants.filter((x) => x.side === side);
    const risen = monsterCombatant(b.data, monster, `risen-${kin.length}`, b.rng);
    say(b, `${c.name}'s corpse rises as a ${risen.name.toLowerCase()}.`);
    Object.assign(risen, {
      name: `${risen.name} (${c.name})`,
      side,
      row: 0,
      column: kin.filter((x) => x.row === 0).length,
      group: Math.max(-1, ...kin.map((x) => x.group)) + 1,
    });
    b.combatants.push(risen);
  }
}
