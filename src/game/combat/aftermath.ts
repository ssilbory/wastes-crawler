// After a won fight (vendor/wwn-srd/2.0 The Rules of the Game/2.5.0, 2.5.1; docs/rules-adaptation.md,
// Combat engine): the mortal-wound clock keeps running for the party's dying. Each round every
// victim gets the best free medic's Heal check, and the medics left over try to aid it (+1 at most,
// SRD 2.3.3). Healing magic that can save a victim is offered to a decider first: the player on
// the fight screen, or the first option when no one is asked.
import { skillCheck } from '../../rules/checks.ts';
import { stabilizeDifficulty } from '../../rules/combat.ts';
import { addStrain, type StrainState } from '../../rules/strain.ts';
import { act, stabilize } from './actions.ts';
import { say } from './damage.ts';
import { endOfRound, MAX_ROUNDS, runRound } from './round.ts';
import { canUse, magicName } from './spells.ts';
import { canAct } from './targeting.ts';
import type { Battle, Combatant, Controller, Outcome } from './types.ts';

/** Healing that can bring one of the dying back: who uses which magic on whom. */
export interface Rescue {
  caster: string;
  magic: string;
  target: string;
  label: string;
}

export type RescueDecider = (options: Rescue[]) => Rescue | null;

/** The party's dying, those who fell first first. */
export const dyingOf = (b: Battle): Combatant[] =>
  b.combatants
    .filter((c) => c.side === 'party' && c.status === 'dying' && !c.amber)
    .sort((x, y) => x.fellRound - y.fellRound);

/** Magic that saves the dying: healing, Conjunct the Vital Viscera, and The Long Amber Moment. */
const HEALING = new Set(['heal', 'touch-heal', 'conjunct', 'amber']);

/** Every healing art or spell a conscious party member could use on a dying ally now. */
export const rescues = (b: Battle): Rescue[] => offers(b, dyingOf(b), HEALING);

/** Magic that mends the wounded after a fight: healing and Conjunct the Vital Viscera. */
const MENDING = new Set(['heal', 'touch-heal', 'conjunct']);

/** The party's wounded who still stand, not frozen in amber. */
export const woundedOf = (b: Battle): Combatant[] =>
  b.combatants.filter(
    (c) => c.side === 'party' && c.status === 'active' && !c.amber && c.hp < c.maxHp,
  );

/** Every healing a conscious party member could use on a wounded ally after the fight. */
export const mendings = (b: Battle): Rescue[] => offers(b, woundedOf(b), MENDING);

function offers(b: Battle, victims: Combatant[], kinds: ReadonlySet<string>): Rescue[] {
  const healing = b.data.content.combatMagic.filter((m) => kinds.has(m.effect.kind));
  return b.combatants
    .filter((c) => c.side === 'party' && canAct(c) && c.caster)
    .flatMap((caster) =>
      healing.flatMap((m) =>
        victims
          .filter((v) => canUse(b, caster, m, false, v.id))
          .map((v) => ({
            caster: caster.id,
            magic: m.id,
            target: v.id,
            label: `${caster.name}: ${magicName(b, m.id)} on ${v.name}`,
          })),
      ),
    );
}

export function castRescue(b: Battle, r: Rescue): void {
  const caster = b.combatants.find((c) => c.id === r.caster);
  if (caster) act(b, caster, { kind: 'cast', magic: r.magic, target: r.target });
}

const medicBonus = (c: Combatant) =>
  (c.skills.heal ?? -1) + c.healModifier + (c.hasHealKit ? 2 : 0);

/** One round of Heal checks for the dying, then the round ends and the clock moves on. */
export function tendRound(b: Battle): void {
  const free = b.combatants
    .filter((c) => c.side === 'party' && canAct(c))
    .sort((x, y) => medicBonus(y) - medicBonus(x));
  // Each victim gets a medic before anyone is left over to aid.
  const tended = dyingOf(b).flatMap((victim) => {
    const medic = free.shift();
    return medic ? [{ victim, medic }] : [];
  });
  for (const { victim, medic } of tended) {
    const difficulty = stabilizeDifficulty(b.round - victim.fellRound, medic.hasHealKit);
    let aid = 0;
    // Helpers try until one succeeds: aid never adds more than +1 (SRD 2.3.3).
    while (aid === 0 && free.length > 0) {
      const helper = free.shift() as Combatant;
      const check = skillCheck(b.rng, {
        skill: helper.skills.heal ?? null,
        attributeModifier: helper.healModifier,
        difficulty,
      });
      if (check.success) {
        aid = 1;
        say(b, `${helper.name} helps ${medic.name} tend ${victim.name}.`);
      }
    }
    stabilize(b, medic, victim, aid);
  }
  endOfRound(b);
}

/** Tends the dying until each lives or dies, letting `decide` spend healing magic first. */
export function tendDying(b: Battle, decide: RescueDecider): void {
  while (dyingOf(b).length > 0) {
    const options = rescues(b);
    const pick = options.length > 0 ? decide(options) : null;
    if (pick) castRescue(b, pick);
    else tendRound(b);
  }
}

/** With no one to ask, the first healing on offer is used. */
export const firstRescue: RescueDecider = (options) => options[0] ?? null;

/** Whether a won fight should wait for the player to decide on healing magic. */
export const awaitsRescue = (b: Battle) =>
  safe(b) && dyingOf(b).length > 0 && rescues(b).length > 0;

/**
 * Whether a won fight should wait for the player to heal the wounded (Sam's call): only while no
 * one is dying, someone is hurt, healing could reach them, and the player hasn't said they're done.
 */
export const awaitsMending = (b: Battle) =>
  safe(b) && !b.mended && dyingOf(b).length === 0 && mendings(b).length > 0;

/** The party holds the field: it won, or escaped behind the Invincible Citadel. */
const safe = (b: Battle) => b.outcome === 'party' || b.escaped;

/** The Long Amber Moment ends with the fight; the frozen dying come out of it stable. */
function thaw(b: Battle): void {
  for (const c of b.combatants.filter((x) => x.amber)) {
    c.amber = false;
    if (c.status === 'dying') Object.assign(c, { status: 'stable', frail: true });
  }
}

/**
 * Prudentially Transient Abnegation of Life (4.4.0): with the field held, the seemingly slain come
 * back with their hit points and two System Strain. A lost field leaves them to the victors.
 */
function reassemble(b: Battle): void {
  for (const c of b.combatants) {
    const back = c.revives;
    if (!back) continue;
    c.status = 'active';
    c.hp = Math.min(c.maxHp, back.hp);
    c.revives = null;
    // Only PCs are spared this way, and every PC bears System Strain.
    c.strain = addStrain(c.strain as StrainState, back.strain, 'condition').state;
    say(b, `${c.name}'s remains flow back together.`);
  }
}

export interface BattleResult {
  outcome: Outcome;
  rounds: number;
  deaths: number;
  battle: Battle;
}

/** Sums up a finished battle, tending the party's dying first after a win. */
export function concludeBattle(b: Battle, decide: RescueDecider = firstRescue): BattleResult {
  const outcome: Outcome = b.outcome ?? 'draw';
  const rounds = Math.min(b.round, MAX_ROUNDS);
  if (safe(b)) tendDying(b, decide);
  thaw(b);
  if (outcome !== 'enemy') reassemble(b);
  // A summoned servant's end is no death in the party.
  const deaths = b.combatants.filter(
    (c) => c.side === 'party' && c.status === 'dead' && !c.summoned,
  ).length;
  return { outcome, rounds, deaths, battle: b };
}

export function runBattle(b: Battle, party?: Controller, enemy?: Controller): BattleResult {
  while (!b.outcome) runRound(b, party, enemy);
  return concludeBattle(b);
}
