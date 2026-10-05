// Phase 15 arts in combat, each from its SRD text in vendor/wwn-srd/1.0 Character Creation/1.5.0
// Class List/: the High Mage's Counter Magic, Retain Sorcery, and Psychic Conversion (1.5.10); the
// Elementalist's Steps of Air and Petrifying Stare (1.5.7); the Necromancer's Keeper of the Gate and
// Unliving Persistence (1.5.14); the Blood Priest's Sanctified Ward (1.5.5); and the sight arts of
// several traditions. Limits per rest are Sam's call (docs/rules-adaptation.md, Phase 15).
import type { CombatEffect } from '../../data/schemas/index.ts';
import { roll2d6WithEdge } from '../../rules/advantage.ts';
import { pcWinsOpposed } from '../../rules/checks.ts';
import { addStrain } from '../../rules/strain.ts';
import { save } from './damage.ts';
import { say } from './log.ts';
import { artReady, spendDay, worksNow } from './reactions.ts';
import { canAct } from './targeting.ts';
import type { Battle, CasterState, Combatant } from './types.ts';

/** Rounds that outlast any fight. */
const SCENE_ROUNDS = 100;
const used = (c: CasterState, art: string) => c.uses[art] ?? 0;
const use = (c: CasterState, art: string) => (c.uses[art] = used(c, art) + 1);

/** The effects of Phase 15's combat arts; false for any other effect. */
export function artEffect(
  b: Battle,
  actor: Combatant,
  e: CombatEffect,
  target: Combatant | undefined,
): boolean {
  const c = actor.caster as CasterState;
  switch (e.kind) {
    case 'dark-sight':
      for (const x of e.party ? b.combatants.filter((y) => y.side === actor.side) : [actor])
        x.seesInDark = true;
      return true;
    case 'flight':
      // Boreal Wings lasts the scene (4.5.0).
      if (target) target.flyingRounds = e.scene ? SCENE_ROUNDS : c.level;
      return true;
    case 'petrify':
      if (target && !save(b, target, e.save).success) {
        target.tags.delete('flying');
        target.rootedRounds = Math.ceil(c.level / 2);
        say(b, `${target.name}'s limbs turn to stone.`);
      }
      return true;
    case 'sanctify':
      actor.sanctified = true;
      return true;
    default:
      return false;
  }
}

/** A check of 2d6 plus the caster's casting attribute and Magic skill. */
const castingScore = (b: Battle, c: CasterState) =>
  roll2d6WithEdge(b.rng, 0).total + c.castModifier + c.magicSkill;

/**
 * Counter Magic: when a foe casts a spell, an opposing High Mage may commit Effort for the day, once
 * a round, for an opposed casting check; on a win the spell fizzles, wasted. A PC wins ties.
 */
export function counterSpell(b: Battle, caster: Combatant): boolean {
  const c = caster.caster as CasterState;
  const counter = b.combatants.find(
    (x) =>
      x.side !== caster.side &&
      canAct(x) &&
      artReady(x, 'counter-magic') &&
      !x.caster?.usedThisScene.has(`counter-magic:${b.round}`),
  );
  if (!counter) return false;
  const cc = counter.caster as CasterState;
  spendDay(cc);
  cc.usedThisScene.add(`counter-magic:${b.round}`);
  const mine = castingScore(b, cc);
  const theirs = castingScore(b, c);
  const won = counter.kind === 'pc' ? pcWinsOpposed(mine, theirs) : !pcWinsOpposed(theirs, mine);
  say(
    b,
    `${counter.name} tries to counter ${caster.name}'s spell${won ? ', and it fizzles' : ''}.`,
  );
  return won;
}

/**
 * Retain Sorcery: once per rest, Effort for the day keeps a cast spell from counting against the
 * day's casting; no other spell before the end of the caster's next turn.
 */
export function retainsSpell(b: Battle, actor: Combatant): boolean {
  const c = actor.caster as CasterState;
  if (!artReady(actor, 'retain-sorcery') || used(c, 'retain-sorcery') > 0) return false;
  spendDay(c);
  use(c, 'retain-sorcery');
  c.castLock = b.round + 1;
  say(b, `${actor.name} holds the spell's energy and casts it again later.`);
  return true;
}

/**
 * On Turn arts with no command: Psychic Conversion for a hurt High Mage, and Keeper of the Gate or
 * Unliving Persistence for the dying.
 */
export function turnArts(b: Battle, actor: Combatant): void {
  const c = actor.caster;
  if (!c) return;
  // Psychic Conversion: once per rest, a spell slot for 2 hit points a level and 1 strain off.
  if (
    c.arts.includes('psychic-conversion') &&
    worksNow(actor, 'psychic-conversion') &&
    used(c, 'psychic-conversion') === 0 &&
    c.spellsLeft > 0 &&
    actor.hp * 2 <= actor.maxHp
  ) {
    use(c, 'psychic-conversion');
    c.spellsLeft -= 1;
    actor.hp = Math.min(actor.maxHp, actor.hp + 2 * c.level);
    if (actor.strain)
      actor.strain = { ...actor.strain, strain: Math.max(0, actor.strain.strain - 1) };
    say(b, `${actor.name} burns a spell into vigor.`);
  }
  const dying = b.combatants.filter((x) => x.side === actor.side && x.status === 'dying');
  // Keeper of the Gate: Effort for the day stabilizes every ally in reach, each taking 1 strain.
  if (dying.length > 0 && artReady(actor, 'keeper-of-the-gate')) {
    spendDay(c);
    for (const x of dying) {
      x.status = 'stable';
      if (x.strain) x.strain = addStrain(x.strain, 1, 'healing').state;
    }
    say(b, `${actor.name} holds the gate shut for the fallen.`);
    return;
  }
  // Unliving Persistence: Effort for the day stabilizes a dying ally anywhere in the party (Sam's
  // call: the whole party, Phase 15).
  const first = dying[0];
  if (first && artReady(actor, 'unliving-persistence')) {
    spendDay(c);
    first.status = 'stable';
    say(b, `${actor.name} will not let ${first.name} die.`);
  }
}
