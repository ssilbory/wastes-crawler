// Arts that answer a blow or a death without a command. Vital Furnace (Phase 14d; vendor/wwn-srd/1.0
// Character Creation/1.5.0 Class List/1.5.9 The Healer.md), and from Phase 15 the Necromancer's
// Unliving Persistence, Master of Bones, and Red Harvest (1.5.14 The Necromancer.md), and in
// Phase 18a the High Magic spell Prudentially Transient Abnegation of Life.
import { roll } from '../../rules/dice.ts';
import { say } from './log.ts';
import type { Battle, CasterState, Combatant } from './types.ts';

/** Whether an art works now: armor blocks it unless it is one that works in armor. */
export const worksNow = (c: Combatant, art: string) =>
  c.caster !== null && (c.caster.canCast || c.caster.armorFree.includes(art));

/** Held, working, and with Effort left to commit. */
export const artReady = (c: Combatant, art: string): boolean =>
  c.caster !== null &&
  c.caster.arts.includes(art) &&
  worksNow(c, art) &&
  c.caster.effortUsed < c.caster.effortMax;

/** Commits Effort for the day. */
export function spendDay(c: CasterState): void {
  c.effortUsed += 1;
  c.effortDay += 1;
}

/**
 * Vital Furnace: Effort for the day negates a wound that leaves the Healer standing; it is spent on
 * any blow of a quarter of their hit points or more (docs/rules-adaptation.md, Phase 14d).
 */
export function vitalFurnace(b: Battle, target: Combatant, amount: number): boolean {
  if (!artReady(target, 'vital-furnace')) return false;
  if (amount >= target.hp || amount * 4 < target.maxHp) return false;
  spendDay(target.caster as CasterState);
  say(b, `${target.name}'s wound closes at once.`);
  return true;
}

/**
 * A PC falling to zero who need not lie dying: Vital Furnace stabilizes the Healer on its own, and
 * Unliving Persistence does it for anyone in the party for the Necromancer's Effort for the day.
 */
export function keepsDying(b: Battle, target: Combatant): boolean {
  // Like the Stones and Augment Mortal Vitality: the body stabilizes at zero on its own.
  if (target.stone > 0 || target.vitality) {
    say(b, `${target.name} falls, still as stone, but lives.`);
    return true;
  }
  const c = target.caster;
  if (c?.arts.includes('vital-furnace') && worksNow(target, 'vital-furnace')) {
    say(b, `${target.name} falls, but their life burns on.`);
    return true;
  }
  // Unliving Persistence covers the whole party (Sam's call, Phase 15): the Necromancer, or one
  // still standing, keeps the fallen from dying.
  const keeper = b.combatants.find(
    (x) =>
      x.side === target.side &&
      (x === target || x.status === 'active') &&
      artReady(x, 'unliving-persistence'),
  );
  if (!keeper) return false;
  spendDay(keeper.caster as CasterState);
  say(
    b,
    keeper === target
      ? `${target.name} falls, but will not die.`
      : `${target.name} falls, but ${keeper.name} will not let them die.`,
  );
  return true;
}

/**
 * Master of Bones: Effort for the scene negates an undead's attack on the Necromancer, unless it
 * has more than twice their level in hit dice.
 */
export function negatesUndead(b: Battle, attacker: Combatant, target: Combatant): boolean {
  if (!attacker.tags.has('undead') || !artReady(target, 'master-of-bones')) return false;
  const c = target.caster as CasterState;
  if (attacker.hitDice > 2 * c.level) return false;
  c.effortUsed += 1;
  say(b, `${target.name} turns aside ${attacker.name}'s attack with a word.`);
  return true;
}

/**
 * Red Harvest: when an intelligent living creature of a hit die or more dies, a Necromancer may
 * commit Effort for the day, once a round, to heal 1d6 plus their level (taken when at half their
 * hit points or less) or else gain +4 on their next hit roll.
 */
export function redHarvest(b: Battle, dead: Combatant): void {
  if (!dead.sapient || dead.hitDice < 1 || dead.tags.has('unliving')) return;
  for (const x of b.combatants) {
    if (x.status !== 'active' || x.harvestRound === b.round || !artReady(x, 'red-harvest'))
      continue;
    spendDay(x.caster as CasterState);
    x.harvestRound = b.round;
    if (x.hp * 2 <= x.maxHp) {
      const healed = roll(b.rng, { count: 1, sides: 6, modifier: x.hitDice }).total;
      x.hp = Math.min(x.maxHp, x.hp + healed);
      say(b, `${x.name} drinks ${dead.name}'s death and heals ${healed}.`);
    } else {
      x.nextHitBonus = 4;
      say(b, `${x.name} drinks ${dead.name}'s death.`);
    }
  }
}

/**
 * Prudentially Transient Abnegation of Life (4.4.0, an Instant spell): as a PC falls, an ally with
 * it prepared and a slot left casts it, and the PC seems to die horribly; they come back after the
 * fight (aftermath.ts). Cast for them, not chosen, as Instant spells can't wait for a command.
 */
export function abnegate(b: Battle, target: Combatant): boolean {
  for (const x of b.combatants) {
    const c = x.caster;
    if (x.side !== target.side || !(x === target || x.status === 'active')) continue;
    if (!c?.canCast || c.spellsLeft === 0) continue;
    const effect = b.data.content.combatMagic.find(
      (m) => m.effect.kind === 'abnegation' && c.prepared.includes(m.id),
    )?.effect;
    if (effect?.kind !== 'abnegation') continue;
    c.spellsLeft -= 1;
    target.status = 'out';
    target.revives = { hp: effect.hpPerLevel * c.level, strain: effect.strain };
    say(b, `${target.name} is cut down in a spray of gore, to all eyes dead.`);
    return true;
  }
  return false;
}

/**
 * Everlasting (4.6.0, an Instant spell): as a PC would fall, an ally with it prepared and a slot
 * left casts it for them, once a fight; for its rounds no one on that side drops below 1 HP, and
 * then the caster is left with 1 (conditions.ts).
 */
export function everlast(b: Battle, target: Combatant): boolean {
  if (target.kind !== 'pc' || b.everlasting) return false;
  for (const x of b.combatants) {
    const c = x.caster;
    if (x.side !== target.side || !(x === target || x.status === 'active')) continue;
    if (!c?.canCast || c.spellsLeft === 0) continue;
    const m = b.data.content.combatMagic.find(
      (y) => y.effect.kind === 'everlasting' && c.prepared.includes(y.id),
    );
    if (m?.effect.kind !== 'everlasting' || c.usedThisScene.has(m.id)) continue;
    c.spellsLeft -= 1;
    c.usedThisScene.add(m.id);
    b.everlasting = { side: x.side, caster: x.id, until: b.round + m.effect.rounds - 1 };
    say(b, `${x.name} pours unquenchable life into ${b.sideNames[x.side]}.`);
    return true;
  }
  return false;
}
