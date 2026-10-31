// Creature specials of Phase 19 (docs/rules-adaptation.md, Creature specials), each from the
// creature's description in data/content/monsters.json: the vampire's regeneration, the black
// widow's webs, the unicorn's healing horn (its blink is in morale.ts), the bears' hug, which
// grapples as vendor/wwn-srd/2.0 The Rules of the Game/2.4.0 Combat.md (2.4.7.1) does, at -4 for
// wrestling a quadruped, and the scorpion's sting once a claw has hit.
import { npcCheck, pcWinsOpposed, skillCheck } from '../../rules/checks.ts';
import { roll } from '../../rules/dice.ts';
import { harm, say } from './damage.ts';
import { save } from './saves.ts';
import { canAct, inLine, isUp } from './targeting.ts';
import type { Action, Attack, Battle, Combatant } from './types.ts';

const holder = (b: Battle, c: Combatant) => b.combatants.find((x) => x.id === c.heldBy);

/** A turn begins: no hits yet, and a regenerating creature knits its wounds. */
export function startTurn(b: Battle, actor: Combatant): void {
  actor.turnHits = [];
  if (actor.regenerate === 0 || actor.hp >= actor.maxHp) return;
  actor.hp = Math.min(actor.maxHp, actor.hp + actor.regenerate);
  say(b, `${actor.name}'s wounds knit.`);
}

/** The foe a web would catch: the first standing in the front row and not yet webbed. */
const webTarget = (b: Battle, actor: Combatant) =>
  inLine(b.combatants).find(
    (c) => c.side !== actor.side && c.row === 0 && canAct(c) && !c.noncombatant && c.webbed === 0,
  );

/** A heal at half hit points or less, or webs while they are left, in place of the blows. */
export function specialAction(b: Battle, actor: Combatant): Action | null {
  if (actor.selfHeal && actor.hp * 2 <= actor.maxHp) return { kind: 'self-heal' };
  const caught = actor.webs ? webTarget(b, actor) : undefined;
  return caught ? { kind: 'web', target: caught.id } : null;
}

export function selfHeal(b: Battle, actor: Combatant): void {
  if (!actor.selfHeal) return;
  const healed = roll(b.rng, actor.selfHeal).total;
  actor.selfHeal = null;
  actor.hp = Math.min(actor.maxHp, actor.hp + healed);
  say(b, `${actor.name} heals itself for ${healed}.`);
}

export function spinWeb(b: Battle, actor: Combatant, target: Combatant | undefined): void {
  const webs = actor.webs;
  if (!webs || !target || target !== webTarget(b, actor)) return;
  actor.webs = null;
  if (save(b, target, webs.save).success) {
    say(b, `${target.name} dodges ${actor.name}'s webs.`);
    return;
  }
  target.webbed = webs.difficulty;
  say(b, `${target.name} is caught in ${actor.name}'s webs.`);
}

/** A check with Str: a character's skill (−1 untrained) and Str, a monster's skill bonus. */
function strCheck(b: Battle, c: Combatant, skill: string, difficulty: number, modifier = 0) {
  if (c.kind === 'monster')
    return npcCheck(b.rng, { skillBonus: c.skillBonus, difficulty, modifier });
  return skillCheck(b.rng, {
    skill: c.skills[skill] ?? null,
    attributeModifier: c.modifiers.str - c.ailPenalty,
    difficulty,
    modifier,
    steps: c.strain?.broken ? -1 : 0,
  });
}

/** Caught in webs or a hug whose holder still stands: its turn goes to struggling free. */
export function bound(b: Battle, c: Combatant): boolean {
  const bear = holder(b, c);
  if (bear && !isUp(bear)) c.heldBy = null;
  return c.webbed > 0 || c.heldBy !== null;
}

/** One struggle a turn; winning only frees the creature. */
export function tearFree(b: Battle, c: Combatant): void {
  if (c.webbed > 0) {
    if (strCheck(b, c, 'exert', c.webbed).success) {
      c.webbed = 0;
      say(b, `${c.name} tears free of the webs.`);
    } else say(b, `${c.name} struggles in the webs.`);
    return;
  }
  const bear = holder(b, c) as Combatant;
  const hug = bear.hug as NonNullable<Combatant['hug']>;
  const mine = strCheck(b, c, 'punch', 0, -hug.penalty).score;
  const theirs = strCheck(b, bear, 'punch', 0).score;
  const free = c.kind === 'pc' ? pcWinsOpposed(mine, theirs) : mine > theirs;
  if (free) c.heldBy = null;
  say(b, free ? `${c.name} breaks the hug.` : `${c.name} struggles in the hug.`);
}

/** The scorpion's sting: easier once a claw has hit this turn. */
export function followUpBonus(actor: Combatant, attack: Attack): number {
  const f = actor.followUp;
  if (!f || attack.name !== f.strike) return 0;
  return actor.turnHits.some((h) => h.strike === f.after) ? f.hit : 0;
}

/** A hit lands: when every swing of a hug's strike has hit the same foe, the creature holds it. */
export function noteHit(b: Battle, actor: Combatant, attack: Attack, target: Combatant): void {
  actor.turnHits.push({ strike: attack.name, target: target.id });
  const hug = actor.hug;
  if (!hug || attack.name !== hug.strike || !isUp(target) || target.heldBy) return;
  if (b.combatants.some((c) => c.heldBy === actor.id)) return;
  // Content checks give a hugging creature a routine with the hug's strike.
  const routine = actor.routine as number[];
  const swings = routine.filter((i) => (actor.attacks[i] as Attack).name === hug.strike).length;
  const landed = actor.turnHits.filter((h) => h.strike === hug.strike && h.target === target.id);
  if (landed.length < swings) return;
  target.heldBy = actor.id;
  say(b, `${actor.name} catches ${target.name} in a crushing hug.`);
}

/** At the end of each round a hug crushes the one it holds, until either falls. */
export function squeeze(b: Battle): void {
  for (const c of b.combatants) {
    const bear = holder(b, c);
    if (!bear) continue;
    if (!isUp(bear) || !isUp(c)) {
      c.heldBy = null;
      continue;
    }
    const hug = bear.hug as NonNullable<Combatant['hug']>;
    const damage = roll(b.rng, hug.damage).total;
    say(b, `${bear.name} crushes ${c.name} for ${damage}.`);
    harm(b, c, damage);
  }
}
