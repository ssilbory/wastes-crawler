// Spells and arts in combat, from data/content/combat-magic.json (each entry's mechanics follow its
// SRD text in vendor/wwn-srd/4.0 Magic and Spellcasting/, including 4.6.0's Smite the Dead, and
// 1.5.7/1.5.9/1.5.10 arts). Slots and Effort as in 4.2.0; strain casting from docs/rules-adaptation.md.
import type { CombatMagic } from '../../data/schemas/index.ts';
import { attackRoll } from '../../rules/attacks.ts';
import { netSteps } from '../../rules/advantage.ts';
import { roll } from '../../rules/dice.ts';
import { strainCastCost } from '../../rules/magic.ts';
import type { SaveType } from '../../rules/saves.ts';
import { addStrain } from '../../rules/strain.ts';
import { effectiveAc, harm, save, say } from './damage.ts';
import { attackSteps, hitModifier, isUp } from './targeting.ts';
import { artEffect, counterSpell, retainsSpell } from './arts.ts';
import { elementalistEffect } from './elementalist.ts';
import { healingFails, necromancerEffect } from './necromancer.ts';
import { bearsHealing, takeHealingStrain } from './healing-strain.ts';
import { donorFor, sanctuaryEffect } from './sanctuary.ts';
import { highMagicEffect, type Resists } from './high-magic.ts';
import type { Battle, CasterState, Combatant } from './types.ts';
import { gameSpells } from '../../data/spells.ts';

export function combatMagic(b: Battle, id: string): CombatMagic | undefined {
  return b.data.content.combatMagic.find((m) => m.id === id);
}

const spellLevel = (b: Battle, id: string) =>
  gameSpells(b.data.srd, b.data.content).find((s) => s.id === id)?.level ?? 1;
export const magicName = (b: Battle, id: string) =>
  [...gameSpells(b.data.srd, b.data.content), ...b.data.srd.arts].find((x) => x.id === id)?.name ??
  id;

function hasEffort(c: CasterState, art: string): boolean {
  return c.arts.includes(art) && c.effortUsed < c.effortMax;
}

/** Healing Touch costs nothing once active this scene, or ever with Facile Healer (1.5.9.1). */
const freeUse = (c: CasterState, m: CombatMagic) =>
  m.effort === 'activate' && (c.usedThisScene.has(m.id) || c.arts.includes('facile-healer'));

/** The Long Amber Moment never freezes its caster; Conjunct the Vital Viscera needs a giver. */
function fitsTarget(b: Battle, actor: Combatant, m: CombatMagic, id?: string): boolean {
  const t = b.combatants.find((x) => x.id === id);
  if (!t) return true;
  if (m.effect.kind === 'amber') return t !== actor;
  // Healing the target couldn't bear is never offered (SRD 2.5.2).
  if (m.effect.kind === 'heal' || m.effect.kind === 'touch-heal')
    return bearsHealing(t, m.effect.strain);
  return m.effect.kind !== 'conjunct' || donorFor(b, t) !== null;
}

/** Whether the caster can use this spell or art now, on this target. */
export function canUse(
  b: Battle,
  actor: Combatant,
  m: CombatMagic,
  strain = false,
  target?: string,
): boolean {
  const c = actor.caster;
  if (!c || !(c.canCast || (m.source === 'art' && c.armorFree.includes(m.id)))) return false;
  // Retain Sorcery's stress and Swift Casting's spell hold off other spells (Phase 15).
  if (m.source === 'spell' && c.castLock >= b.round) return false;
  // Deluge of Hell can't be cast indoors (4.4.0).
  if (m.effect.kind === 'burst' && m.effect.outdoorsOnly && b.indoors) return false;
  if (m.limit === 'scene' && c.usedThisScene.has(m.id)) return false;
  if (m.limit === 'target-scene' && c.usedThisScene.has(`${m.id}:${target ?? ''}`)) return false;
  if (!fitsTarget(b, actor, m, target)) return false;
  if (m.source === 'art')
    return (freeUse(c, m) ? c.arts.includes(m.id) : hasEffort(c, m.id)) && m.target !== 'none';
  if (strain) {
    const s = actor.strain;
    return (
      c.known.includes(m.id) && s !== null && !s.broken && s.strain + spellLevel(b, m.id) <= s.max
    );
  }
  return c.prepared.includes(m.id) && c.spellsLeft > 0;
}

/** A target's save, which Inexorable Effect can make the target reroll once per scene. */
function enemySave(
  b: Battle,
  actor: Combatant,
  target: Combatant,
  type: SaveType,
  modifier = 0,
): boolean {
  let ok = save(b, target, type, modifier).success;
  const c = actor.caster as CasterState;
  // Master of Bones: the undead save twice and take the worse (1.5.14).
  if (ok && target.tags.has('undead') && c.arts.includes('master-of-bones'))
    ok = save(b, target, type, modifier).success;
  if (ok && hasEffort(c, 'inexorable-effect') && !c.usedThisScene.has('inexorable-effect')) {
    c.effortUsed += 1;
    c.effortDay += 1;
    c.usedThisScene.add('inexorable-effect');
    ok = save(b, target, type, modifier).success;
    say(b, `${actor.name} forces ${target.name} to resist again.`);
  }
  return ok;
}

function pay(b: Battle, actor: Combatant, m: CombatMagic, strain: boolean): void {
  const c = actor.caster as CasterState;
  if (m.source === 'art') {
    if (freeUse(c, m)) return;
    c.effortUsed += 1;
    if (m.effort === 'day') c.effortDay += 1;
  } else if (strain && actor.strain) {
    const outcome = addStrain(actor.strain, strainCastCost(spellLevel(b, m.id)), 'strain-cast');
    actor.strain = outcome.state;
  } else if (!retainsSpell(b, actor)) c.spellsLeft -= 1;
}

/** Healing that revives the Mortally Wounded and adds System Strain, unless it is refused. */
function restore(b: Battle, target: Combatant, amount: number, strain: number): void {
  if (healingFails(b, target) || !takeHealingStrain(b, target, strain)) return;
  const healed = Math.max(0, amount);
  if (target.status === 'dying' || target.status === 'stable') {
    target.status = 'active';
    target.hp = Math.min(target.maxHp, healed);
  } else target.hp = Math.min(target.maxHp, target.hp + healed);
  say(b, `${target.name} is healed for ${healed}.`);
}

/** The highest tier the level reaches (the first, below them all). */
function tierAt<T extends { level: number }>(tiers: readonly T[], level: number): T {
  return tiers.reduce((best, t) => (t.level <= level ? t : best));
}

export function castMagic(
  b: Battle,
  actor: Combatant,
  id: string,
  targetId: string | undefined,
  row: number | undefined,
  strain = false,
): boolean {
  const m = combatMagic(b, id);
  if (!m || !canUse(b, actor, m, strain, targetId)) return false;
  const c = actor.caster as CasterState;
  const target = b.combatants.find((x) => x.id === targetId);
  pay(b, actor, m, strain);
  c.usedThisScene.add(m.limit === 'target-scene' ? `${m.id}:${targetId ?? ''}` : m.id);
  say(b, `${actor.name} ${m.source === 'art' ? 'uses' : 'casts'} ${magicName(b, m.id)}.`);
  if (m.source === 'spell' && counterSpell(b, actor)) return true;
  const e = m.effect;
  switch (e.kind) {
    case 'damage': {
      if (!target) return true;
      const dice = { ...e.perLevel, count: e.perLevel.count * c.level };
      let total = roll(b.rng, dice).total;
      const average = (dice.count * (dice.sides + 1)) / 2 + dice.modifier;
      if (total < average && hasEffort(c, 'empowered-sorcery')) {
        c.effortUsed += 1;
        c.effortDay += 1;
        total = Math.max(total, roll(b.rng, dice).total);
      }
      if (target.kind === 'monster' && target.hitDice <= e.slayHitDice) {
        harm(b, target, target.hp);
        return true;
      }
      harm(b, target, enemySave(b, actor, target, e.save) ? Math.floor(total / 2) : total);
      return true;
    }
    case 'sleep':
      for (const t of b.combatants) {
        if (
          t.side !== actor.side &&
          t.row === row &&
          isUp(t) &&
          !t.tags.has('unliving') &&
          t.hitDice <= e.maxHitDice
        ) {
          t.status = 'asleep';
          say(b, `${t.name} falls asleep.`);
        }
      }
      return true;
    case 'blind':
      if (target)
        target.blindRounds = enemySave(b, actor, target, e.save) ? 1 : Number.POSITIVE_INFINITY;
      return true;
    case 'ward':
      if (target) target.wardRounds = Math.ceil(c.level / 2);
      return true;
    case 'enthrall':
      if (target && !enemySave(b, actor, target, e.save, -(actor.skills[e.penaltySkill] ?? 0))) {
        target.status = 'out';
        target.spellbound = true;
        say(b, `${target.name} is enthralled and stops fighting.`);
      }
      return true;
    case 'blast': {
      if (!target) return true;
      const attr = Math.max(...e.attributes.map((a) => actor.modifiers[a]));
      const hit = attackRoll(b.rng, {
        attackBonus: c.level,
        attributeModifier: attr,
        skill: actor.skills[e.skill] ?? null,
        modifier: hitModifier(b, actor),
        steps: netSteps([attackSteps(b, actor, target, 'ranged')]),
        targetAc: effectiveAc(target),
      }).hit;
      if (hit) harm(b, target, roll(b.rng, e.damage).total + c.level + attr);
      return true;
    }
    case 'ac-bonus': {
      // Pavis of Elements on the caster, Ward of the Turning Wind on any ally; they don't combine.
      const warded = target ?? actor;
      warded.acBonus = Math.max(warded.acBonus, e.amount);
      return true;
    }
    case 'smite': {
      const dice = { ...e.perLevel, count: e.perLevel.count * c.level };
      for (const t of b.combatants.filter(
        (x) => x.side !== actor.side && x.row === row && isUp(x) && x.tags.has(e.requiresTag),
      )) {
        if (t.hitDice <= c.level && !enemySave(b, actor, t, e.save)) {
          say(b, `${t.name} is destroyed.`);
          harm(b, t, t.hp);
        } else harm(b, t, roll(b.rng, dice).total);
      }
      return true;
    }
    case 'ac-floor':
      actor.acFloor = e.base + Math.floor(c.level / 2);
      return true;
    case 'heal':
      if (target) restore(b, target, roll(b.rng, tierAt(e.tiers, c.level).dice).total, e.strain);
      return true;
    case 'touch-heal': {
      if (!target) return true;
      const empowered = c.arts.includes('empowered-healer') ? c.level : 0;
      const dice = roll(b.rng, e.dice).total;
      restore(b, target, dice + (actor.skills[e.skill] ?? 0) + empowered, e.strain);
      return true;
    }
    case 'repose':
      if (target && !target.tags.has('unliving')) target.reposePenalty = actor.skills[e.skill] ?? 0;
      return true;
    case 'bless': {
      const bonus = tierAt(e.tiers, c.level).bonus;
      b.hitModifier[actor.side] += bonus;
      b.damageBonus[actor.side] += bonus;
      return true;
    }
    case 'turn': {
      let budget = roll(b.rng, e.dice).total + c.level;
      const foes = b.combatants
        .filter(
          (x) =>
            x.side !== actor.side &&
            isUp(x) &&
            e.tags.some((tag) => x.tags.has(tag)) &&
            x.hitDice <= 2 * c.level,
        )
        .sort((x, y) => x.hitDice - y.hitDice);
      for (const t of foes) {
        if (t.hitDice > budget) continue;
        budget -= t.hitDice;
        if (enemySave(b, actor, t, e.save)) continue;
        t.status = 'out';
        t.spellbound = true;
        say(b, `${t.name} cowers.`);
      }
      return true;
    }
    case 'wrath':
      if (target) target.wrath = { until: b.round + 1, bonus: roll(b.rng, e.dice).total + c.level };
      return true;
    case 'stun':
      if (
        target &&
        (target.kind === 'pc' || target.tags.has(e.requiresTag)) &&
        !enemySave(b, actor, target, e.save)
      ) {
        target.stunned = true;
      }
      return true;
    default:
      if (!artEffect(b, actor, e, target)) {
        const resists: Resists = (t, type, mod) => enemySave(b, actor, t, type, mod);
        if (!highMagicEffect(b, actor, e, target, row, resists))
          if (!elementalistEffect(b, actor, e, target, row, resists))
            if (!sanctuaryEffect(b, actor, e, target))
              necromancerEffect(b, actor, e, target, row, resists);
      }
      return true;
  }
}
