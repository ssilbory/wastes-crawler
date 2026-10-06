// Combatants from saved characters, with every sheet value folded in; the defaults every
// combatant starts from. SRD monsters are built in monster-combatant.ts.
import type { Character } from '../../data/schemas/index.ts';
import { boostedModifier } from '../../rules/attributes.ts';
import { killingBlowBonus } from '../../rules/combat.ts';
import { characterLevel } from '../../rules/progression.ts';
import { classOption } from '../character/class-step.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet, finalScores } from '../character/derived.ts';
import { activeEffects } from '../character/equipment.ts';
import { modifierBonuses } from '../character/foci.ts';
import { armorFreeArts } from '../character/magic.ts';
import { findItem } from '../character/items.ts';
import type { Attack, Combatant } from './types.ts';

export function base(
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
    routine: null,
    volley: null,
    forcedAttack: null,
    breath: null,
    breathLeft: 0,
    heldRounds: 0,
    resist: null,
    actsLast: false,
    acFloor: 0,
    acInput: null,
    wrath: null,
    character: null,
    reposePenalty: 0,
    seesInDark: false,
    sanctified: false,
    sapient: false,
    rootedRounds: 0,
    flyingRounds: 0,
    nextHitBonus: 0,
    harvestRound: 0,
    shockCap: null,
    poisonImmune: false,
    mantle: null,
    echo: null,
    torment: null,
    spellbound: false,
    returnsRound: 0,
    berserk: false,
    revives: null,
    subdues: false,
    summoned: null,
    servant: false,
    flame: 0,
    stone: 0,
    misted: false,
    vitality: null,
    enfeebledUntil: 0,
    compelled: 0,
    deathlessUntil: 0,
    mergedWith: null,
    doomedUntil: 0,
    amber: false,
    fleet: false,
    finalDeath: false,
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
      blunt: data.content.equipmentRules.bluntWeapons.includes(a.id),
      onHit: null,
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
    acInput: sheet.equipment.armorClassInput,
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
          armorFree: armorFreeArts(data, c.classes, c.arts),
          uses: {},
          castLock: 0,
          usedThisScene: new Set(),
        }
      : null,
    strain: { strain: c.strain.value, max: sheet.strainMax, broken: c.strain.broken },
    status: c.hp.current > 0 ? 'active' : 'dead',
    sapient: true,
    character: c,
    // Cold Flesh: Shock of 2 at most, and a natural AC of 12 plus half the level (1.5.14).
    ...(c.arts.includes('cold-flesh') ? { shockCap: 2, acFloor: 12 + Math.floor(level / 2) } : {}),
    // Unaging: immune to poisons (1.5.14).
    poisonImmune: c.arts.includes('unaging'),
  };
}
