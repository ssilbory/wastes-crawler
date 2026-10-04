// Combatants from saved characters and SRD monsters (vendor/wwn-srd/5.0 Monsters and Foes/
// Monster and NPC Stats.md: 1d8 hit points per hit die; Wpn damage uses the weapon in
// data/content/monster-combat.json).
import type { Character, Monster, Weapon } from '../../data/schemas/index.ts';
import { boostedModifier } from '../../rules/attributes.ts';
import { rollDie } from '../../rules/dice.ts';
import { killingBlowBonus } from '../../rules/combat.ts';
import { characterLevel } from '../../rules/progression.ts';
import type { Rng } from '../../rules/rng.ts';
import { classOption } from '../character/class-step.ts';
import { findMonster, type GameData } from '../character/context.ts';
import { characterSheet, finalScores } from '../character/derived.ts';
import { activeEffects } from '../character/equipment.ts';
import { modifierBonuses } from '../character/foci.ts';
import { findItem } from '../character/items.ts';
import { monsterCaster } from './monster-caster.ts';
import type { Attack, Combatant } from './types.ts';

function base(
  id: string,
  name: string,
): Omit<Combatant, 'side' | 'kind' | 'hp' | 'maxHp' | 'ac' | 'attacks' | 'saves' | 'hitDice'> {
  return {
    id,
    name,
    row: 0,
    column: 0,
    group: 0,
    attacksPerRound: 1,
    modifiers: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    skills: {},
    skillBonus: 0,
    healModifier: 0,
    hasHealKit: false,
    tags: new Set(),
    morale: 12,
    instinct: 0,
    shield: false,
    towerShield: false,
    meleeShockImmune: false,
    rangedInMelee: null,
    initiativeBonus: 0,
    actsFirst: false,
    killingBlow: false,
    veteransLuck: false,
    caster: null,
    strain: null,
    status: 'active',
    frail: false,
    fellRound: 0,
    totalDefense: false,
    shieldUsed: false,
    stunned: false,
    instinctive: false,
    blindRounds: 0,
    wardRounds: 0,
    acBonus: 0,
    noncombatant: false,
  };
}

/** A PC with every sheet value, focus effect, and class ability folded in. */
export function pcCombatant(data: GameData, c: Character, id = c.id): Combatant {
  const sheet = characterSheet(c, data);
  const scores = finalScores(c);
  const bonuses = modifierBonuses(c.foci);
  const level = characterLevel(c.classes);
  const effects = activeEffects(data, c.foci);
  const abilities = new Set(
    Object.entries(c.classes.levels)
      .filter(([, l]) => l >= 1)
      .flatMap(([cls]) => classOption(data, cls)?.abilities ?? []),
  );
  const kb = abilities.has('killing-blow') ? killingBlowBonus(level) : 0;
  const traitsOf = (lineId: string) => {
    const item = findItem(data, lineId);
    return item?.kind === 'weapon' ? item.weapon.traits : [];
  };
  const attacks: Attack[] = sheet.equipment.attacks.map((a) => {
    const traits = traitsOf(a.id);
    return {
      id: a.id,
      name: a.name,
      mode: a.mode,
      hit: a.hit,
      damage: a.damage,
      damageBonus: a.damageBonus + kb,
      shock: a.shock ? { damage: a.shock.damage + kb, maxAc: a.shock.maxAc } : null,
      reach: traits.includes('long'),
      twoHanded: traits.includes('two-handed'),
    };
  });
  const worn = c.inventory.filter((e) => e.location === 'worn').map((e) => findItem(data, e.id));
  const shields = worn.filter((i) => i?.kind === 'shield');
  const ranged = effects.flatMap((e) => (e.kind === 'ranged-in-melee' ? [e.modifier] : []));
  const init = effects.flatMap((e) => (e.kind === 'initiative' ? [e] : []));
  const magic = sheet.magic;
  const casterLevel =
    Object.entries(c.classes.levels).find(
      ([cls, l]) => l >= 1 && classOption(data, cls)?.mage,
    )?.[1] ?? 0;
  return {
    ...base(id, c.name),
    side: 'party',
    kind: 'pc',
    hp: c.hp.current,
    maxHp: c.hp.max,
    ac: sheet.equipment.armorClass,
    attacks,
    saves: sheet.saves,
    hitDice: level,
    modifiers: sheet.modifiers,
    skills: { ...c.skills },
    healModifier: Math.max(
      boostedModifier(scores.dex, bonuses.dex),
      boostedModifier(scores.int, bonuses.int),
    ),
    hasHealKit: c.inventory.some((e) => e.id === 'healers-pouch'),
    shield: shields.length > 0,
    towerShield: shields.some((i) => i?.kind === 'shield' && i.shield.cover),
    meleeShockImmune: effects.some((e) => e.kind === 'melee-shock-immune'),
    rangedInMelee: ranged.length > 0 ? Math.max(...ranged) : null,
    initiativeBonus: Math.max(0, ...init.map((e) => e.bonus)),
    actsFirst: init.some((e) => e.actsFirst),
    killingBlow: kb > 0,
    veteransLuck: abilities.has('veterans-luck'),
    caster: magic
      ? {
          level: casterLevel,
          effortMax: Math.max(0, magic.effort),
          effortUsed: 0,
          effortDay: 0,
          spellsLeft: magic.slots.spellsCast,
          prepared: [...c.spells.prepared],
          known: [...c.spells.known],
          arts: [...c.arts],
          magicSkill: c.skills.magic ?? 0,
          castModifier: Math.max(sheet.modifiers.int, sheet.modifiers.cha),
          canCast: magic.canCast,
          usedThisScene: new Set(),
        }
      : null,
    strain: { strain: c.strain.value, max: sheet.strainMax, broken: c.strain.broken },
    status: c.hp.current > 0 ? 'active' : 'dead',
  };
}

function monsterAttack(m: Monster, weapon: Weapon | undefined, reach: boolean): Attack {
  const damage =
    m.damage.kind === 'dice'
      ? m.damage.dice
      : (weapon?.damage ?? { count: 1, sides: 6, modifier: 0 });
  const bonus = m.damage.kind === 'weapon' ? m.damage.bonus : 0;
  let shock: Attack['shock'] = null;
  if (m.shock?.kind === 'fixed') shock = { damage: m.shock.damage, maxAc: m.shock.maxAc };
  else if (m.shock?.kind === 'weapon' && weapon?.shock) {
    shock = {
      damage: weapon.shock.damage + m.shock.bonus,
      maxAc: m.shock.ignoresAc ? null : weapon.shock.maxAc,
    };
  }
  const ranged = weapon?.range && !weapon.traits.includes('throwable');
  return {
    id: weapon?.id ?? m.id,
    name: weapon?.name ?? 'Natural attack',
    mode: ranged ? 'ranged' : 'melee',
    hit: m.attackBonus,
    damage,
    damageBonus: bonus,
    shock: ranged ? null : shock,
    reach: reach || (weapon?.traits.includes('long') ?? false),
    twoHanded: weapon?.traits.includes('two-handed') ?? false,
  };
}

/** An SRD monster with rolled hit points: 1d8 per hit die. */
export function monsterCombatant(
  data: GameData,
  monsterId: string,
  id: string,
  rng: Rng,
): Combatant {
  const m = findMonster(data, monsterId);
  if (!m) throw new Error(`unknown monster ${monsterId}`);
  const combat = data.content.monsterCombat.find((x) => x.id === monsterId);
  const tags = new Set(combat?.tags ?? []);
  const weaponItem = combat?.weapon ? findItem(data, combat.weapon) : undefined;
  const weapon = weaponItem?.kind === 'weapon' ? weaponItem.weapon : undefined;
  let hp = 0;
  for (let i = 0; i < m.hitDice; i++) hp += rollDie(rng, 8);
  return {
    ...base(id, m.name),
    side: 'enemy',
    kind: 'monster',
    hp,
    maxHp: hp,
    ac: m.ac,
    attacks: [monsterAttack(m, weapon, tags.has('reach'))],
    attacksPerRound: m.attacks,
    saves: { physical: m.save, evasion: m.save, mental: m.save, luck: m.save },
    hitDice: m.hitDice,
    skillBonus: m.skill,
    tags,
    morale: m.morale,
    instinct: m.instinct,
    // A caster's Magic skill is its skill bonus, for Shackles and Elemental Blast.
    ...(combat?.caster && {
      caster: monsterCaster(data, m, combat.caster),
      skills: { magic: m.skill },
    }),
  };
}
