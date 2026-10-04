// Spells and arts in combat, from data/content/combat-magic.json (each entry's mechanics follow its
// SRD text in vendor/wwn-srd/4.0 Magic and Spellcasting/ and 1.5.7/1.5.10 arts). Slots and Effort
// as in 4.2.0; strain casting from docs/rules-adaptation.md.
import type { CombatMagic } from '../../data/schemas/index.ts';
import { attackRoll } from '../../rules/attacks.ts';
import { netSteps } from '../../rules/advantage.ts';
import { roll } from '../../rules/dice.ts';
import { strainCastCost } from '../../rules/magic.ts';
import type { SaveType } from '../../rules/saves.ts';
import { addStrain } from '../../rules/strain.ts';
import { effectiveAc, harm, save, say } from './damage.ts';
import { attackSteps, isUp } from './targeting.ts';
import type { Battle, CasterState, Combatant } from './types.ts';

export function combatMagic(b: Battle, id: string): CombatMagic | undefined {
  return b.data.content.combatMagic.find((m) => m.id === id);
}

const spellLevel = (b: Battle, id: string) =>
  b.data.srd.spells.find((s) => s.id === id)?.level ?? 1;
export const magicName = (b: Battle, id: string) =>
  [...b.data.srd.spells, ...b.data.srd.arts].find((x) => x.id === id)?.name ?? id;

function hasEffort(c: CasterState, art: string): boolean {
  return c.arts.includes(art) && c.effortUsed < c.effortMax;
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
  if (!c?.canCast) return false;
  if (m.limit === 'scene' && c.usedThisScene.has(m.id)) return false;
  if (m.limit === 'target-scene' && c.usedThisScene.has(`${m.id}:${target ?? ''}`)) return false;
  if (m.source === 'art') return hasEffort(c, m.id) && m.target !== 'none';
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
    c.effortUsed += 1;
    if (m.effort === 'day') c.effortDay += 1;
  } else if (strain && actor.strain) {
    const outcome = addStrain(actor.strain, strainCastCost(spellLevel(b, m.id)), 'strain-cast');
    actor.strain = outcome.state;
  } else c.spellsLeft -= 1;
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
        modifier: b.hitModifier[actor.side],
        steps: netSteps([attackSteps(b, actor, target, 'ranged')]),
        targetAc: effectiveAc(target),
      }).hit;
      if (hit) harm(b, target, roll(b.rng, e.damage).total + c.level + attr);
      return true;
    }
    case 'ac-bonus':
      actor.acBonus = e.amount;
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
      return true;
  }
}
