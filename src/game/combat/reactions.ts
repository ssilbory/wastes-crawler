// Arts that answer a blow or a death without a command. Vital Furnace (Phase 14d; vendor/wwn-srd/1.0
// Character Creation/1.5.0 Class List/1.5.9 The Healer.md), and from Phase 15 the Necromancer's
// Unliving Persistence, Master of Bones, and Red Harvest (1.5.14 The Necromancer.md), and in
// Phase 18a the High Magic spell Prudentially Transient Abnegation of Life, and in Phase 18d the
// Invincible Citadel, and the Vowed's Revivifying Breath at zero hit points (1.5.17).
import { roll } from '../../rules/dice.ts';
import { canPay, payFor } from '../../rules/spell-points.ts';
import { say } from './log.ts';
import { spellLevel } from './spell-level.ts';
import { canAct } from './targeting.ts';
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

export const BREATH = 'revivifying-breath';

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
 * A PC falling to zero who need not lie dying: Die Hard stabilizes on its own
 * (vendor/wwn-srd/1.0 Character Creation/1.6.0 Foci.md, Die Hard), as does Vital Furnace for the
 * Healer, and Unliving Persistence does it for anyone in the party for the Necromancer's Effort for
 * the day.
 */
export function keepsDying(b: Battle, target: Combatant): boolean {
  if (target.selfStabilize) {
    say(b, `${target.name} falls, but hangs on.`);
    return true;
  }
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
    if (!c?.canCast) continue;
    const spell = b.data.content.combatMagic.find(
      (m) => m.effect.kind === 'abnegation' && c.prepared.includes(m.id),
    );
    const effect = spell?.effect;
    if (!spell || effect?.kind !== 'abnegation' || !canPay(c, spellLevel(b, spell.id))) continue;
    payFor(c, spellLevel(b, spell.id));
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
    if (!c?.canCast) continue;
    const m = b.data.content.combatMagic.find(
      (y) => y.effect.kind === 'everlasting' && c.prepared.includes(y.id),
    );
    if (m?.effect.kind !== 'everlasting' || c.usedThisScene.has(m.id)) continue;
    if (!canPay(c, spellLevel(b, m.id))) continue;
    payFor(c, spellLevel(b, m.id));
    c.usedThisScene.add(m.id);
    b.everlasting = { side: x.side, caster: x.id, until: b.round + m.effect.rounds - 1 };
    say(b, `${x.name} pours unquenchable life into ${b.sideNames[x.side]}.`);
    return true;
  }
  return false;
}

/**
 * The Invincible Citadel: as a PC of the party would fall, the first ally with it prepared and a
 * spell left raises the bubble, and the party escapes the fight. Once raised, it holds. Only the
 * party's PCs call on it; rivals in the arena (docs/rules-adaptation.md, Arena rivals) never do.
 */
export function shelter(b: Battle, target: Combatant): boolean {
  if (target.side !== 'party') return false;
  if (b.escaped) return true;
  for (const x of b.combatants) {
    const c = x.caster;
    if (x.side !== 'party' || !(x === target || canAct(x))) continue;
    if (!c?.canCast) continue;
    const m = b.data.content.combatMagic.find(
      (y) => y.effect.kind === 'citadel' && c.prepared.includes(y.id),
    );
    if (!m || !canPay(c, spellLevel(b, m.id))) continue;
    payFor(c, spellLevel(b, m.id));
    b.escaped = true;
    b.outcome = 'draw';
    say(b, `${x.name} raises the Invincible Citadel; the foes can't reach the party and give up.`);
    return true;
  }
  return false;
}

/** Revivifying Breath's 1d6 plus the level, with no System Strain (1.5.17); once a scene. */
export function breathe(b: Battle, actor: Combatant): void {
  const c = actor.caster as CasterState;
  c.usedThisScene.add(BREATH);
  const healed = roll(b.rng, { count: 1, sides: 6, modifier: c.level }).total;
  actor.hp = Math.min(actor.maxHp, actor.hp + healed);
  say(b, `${actor.name} breathes deep and heals ${healed}.`);
}

/**
 * Revivifying Breath at zero hit points: as the Vowed falls, if they haven't used it this scene,
 * it commits all their Effort left for the day and they rise healed.
 */
export function breathesAgain(b: Battle, target: Combatant): boolean {
  const c = target.caster;
  if (!c?.arts.includes(BREATH) || !worksNow(target, BREATH) || c.usedThisScene.has(BREATH))
    return false;
  const left = c.effortMax - c.effortUsed;
  if (left <= 0) return false;
  c.effortUsed += left;
  c.effortDay += left;
  breathe(b, target);
  return true;
}
