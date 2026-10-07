// Worn gear, AC, attack lines, and carry load. Attack math: vendor/wwn-srd/2.0 The Rules of the
// Game/2.4.0 Combat.md (2.4.5) and 3.0 Equipment, Armor, and Weapons/3.5.0 Weapons.md (3.5.1);
// focus effects come from data/content (focus rules and racial foci).
import type {
  AttackMode,
  Dice,
  FocusEffect,
  NaturalWeapon,
  People,
  Weapon,
} from '../../data/schemas/index.ts';
import { armorClass, innateArmorClass, type ArmorClassInput } from '../../rules/armor-class.ts';
import { UNTRAINED_ATTACK_PENALTY, type ShockRating } from '../../rules/attacks.ts';
import {
  boostedModifier,
  type AttributeScores,
  type ModifierBonuses,
} from '../../rules/attributes.ts';
import { carryLoad, type Load } from '../../rules/encumbrance.ts';
import type { GameData } from './context.ts';
import { focusInfo, type HeldFocus } from './foci.ts';
import { entryEncumbrance, findItem, type CatalogItem, type InventoryEntry } from './items.ts';
import { upgrade } from './upgrades.ts';
import type { Skills } from './skills.ts';

/** Effects from foci held at or above each effect's level. */
export function activeEffects(data: GameData, foci: readonly HeldFocus[]): FocusEffect[] {
  return foci.flatMap((f) =>
    (focusInfo(data, f.id)?.effects ?? []).filter((e) => e.level <= f.level),
  );
}

type Resolved = { entry: InventoryEntry; item: CatalogItem };

function resolve(data: GameData, entries: readonly InventoryEntry[]): Resolved[] {
  return entries.flatMap((entry) => {
    const item = findItem(data, entry.id);
    return item ? [{ entry, item }] : [];
  });
}

/** Problems with what a character carries and wears; empty when the inventory is valid. */
export function inventoryErrors(
  data: GameData,
  entries: readonly InventoryEntry[],
  people: People,
): string[] {
  const errors: string[] = [];
  const worn = { armor: 0, barding: 0, shield: 0 };
  for (const entry of entries) {
    const item = findItem(data, entry.id);
    if (!item) {
      errors.push(`unknown item ${entry.id}`);
      continue;
    }
    if ((entry.small || entry.barding) && item.kind !== 'armor') {
      errors.push(`${item.name} can't be small or barding`);
    }
    if (entry.quality && item.kind !== 'weapon' && item.kind !== 'armor' && item.kind !== 'shield')
      errors.push(`${item.name} can't be ${entry.quality}`);
    if (entry.barding && !people.barding)
      errors.push(`${people.name} characters can't wear barding`);
    if (entry.location !== 'worn') continue;
    if (item.kind === 'armor') {
      if (entry.barding) worn.barding += entry.quantity;
      else worn.armor += entry.quantity;
      if (!entry.barding && (people.size === 'small') !== (entry.small === true)) {
        errors.push(
          people.size === 'small'
            ? `${people.name} characters can only wear small armor`
            : `${item.name} is sized for small peoples`,
        );
      }
    } else if (item.kind === 'shield') {
      worn.shield += entry.quantity;
    } else if (!(item.kind === 'gear' && item.gear.freeWhenWorn)) {
      errors.push(`${item.name} can't be worn`);
    }
  }
  if (worn.armor > 1) errors.push('only one suit of armor can be worn');
  if (worn.barding > 1) errors.push('only one suit of barding can be worn');
  if (worn.shield > 1) errors.push('only one shield can be carried at a time');
  return errors;
}

export interface Loadout {
  entries: readonly InventoryEntry[];
  people: People;
  scores: AttributeScores;
  bonuses: ModifierBonuses;
  skills: Skills;
  foci: readonly HeldFocus[];
  level: number;
  attackBonus: number;
  /** An alternate form's attacks and bonuses, beside the foci's (forms.ts). */
  formEffects?: readonly FocusEffect[];
  /** An alternate form's base AC: Intrinsic Armor (forms.ts). */
  formAc?: number | null;
}

const effectsOf = (data: GameData, l: Loadout) => [
  ...activeEffects(data, l.foci),
  ...(l.formEffects ?? []),
];

export function loadoutArmorClass(data: GameData, l: Loadout): number {
  return armorClass(loadoutArmorClassInput(data, l));
}

/** What the loadout's AC is made of, so a fight can lay a natural AC under it (Armor of God). */
export function loadoutArmorClassInput(data: GameData, l: Loadout): ArmorClassInput {
  const worn = resolve(data, l.entries).filter((r) => r.entry.location === 'worn');
  const armor = worn.find((r) => r.item.kind === 'armor' && !r.entry.barding);
  const barding = worn.find((r) => r.item.kind === 'armor' && r.entry.barding);
  const shield = worn.find((r) => r.item.kind === 'shield');
  // Crafting's AC changes apply to body armor, not barding (upgrades.ts).
  const acOf = (r: Resolved | undefined) =>
    r?.item.kind === 'armor'
      ? r.item.armor.ac + (r.entry.barding ? 0 : upgrade(data, r.entry).ac)
      : null;
  const innate = [
    ...activeEffects(data, l.foci).flatMap((e) =>
      e.kind === 'innate-ac' ? [innateArmorClass(e.base, l.level)] : [],
    ),
    ...(l.formAc ? [l.formAc] : []),
  ];
  return {
    armorAc: acOf(armor),
    ...(l.people.barding ? { barding: { ac: acOf(barding) } } : {}),
    ...(innate.length > 0 ? { innateAc: Math.max(...innate) } : {}),
    ...(shield?.item.kind === 'shield' ? { shield: shield.item.shield } : {}),
    dexModifier: boostedModifier(l.scores.dex, l.bonuses.dex),
  };
}

export function loadoutLoad(data: GameData, l: Loadout): Load {
  let readied = 0;
  let stowed = 0;
  for (const { entry, item } of resolve(data, l.entries)) {
    const enc = entryEncumbrance(data, item, entry);
    if (entry.location === 'stowed') stowed += enc;
    else readied += enc;
  }
  const extra = activeEffects(data, l.foci).some((e) => e.kind === 'extra-stowed-half-strength');
  return carryLoad(readied, stowed, l.scores.str, extra ? Math.floor(l.scores.str / 2) : 0);
}

export interface AttackLine {
  id: string;
  name: string;
  mode: AttackMode;
  hit: number;
  damage: Dice;
  /** Added to the damage dice. */
  damageBonus: number;
  /** Melee only; a null maxAc applies whatever the target's AC. */
  shock: ShockRating | null;
}

type Source = Pick<Weapon, 'id' | 'name' | 'damage' | 'shock' | 'attributes'> & {
  addsPunch: boolean;
  /** Crafting's to-hit and damage changes (upgrades.ts). */
  hitBonus?: number;
  damageExtra?: number;
  /** Unarmed and natural attacks, which some focus effects leave out. */
  unarmed: boolean;
  /** Fixed skill for natural and unarmed attacks. */
  skill?: string;
};

function modesOf(w: Weapon): AttackMode[] {
  if (!w.range) return ['melee'];
  return w.traits.includes('throwable') ? ['melee', 'thrown'] : ['ranged'];
}

function skillFor(src: Source, mode: AttackMode, skills: Skills): number | null {
  const level = (id: string) => (Object.hasOwn(skills, id) ? (skills[id] as number) : null);
  if (src.skill) return level(src.skill);
  if (mode === 'melee') return level('stab');
  if (mode === 'ranged') return level('shoot');
  const both = [level('stab'), level('shoot')].filter((v) => v !== null);
  return both.length > 0 ? Math.max(...both) : null;
}

function attackLine(
  data: GameData,
  l: Loadout,
  src: Source,
  mode: AttackMode,
  effects: readonly FocusEffect[],
): AttackLine {
  const attr = Math.max(...src.attributes.map((a) => boostedModifier(l.scores[a], l.bonuses[a])));
  const skill = skillFor(src, mode, l.skills);
  const noPenalty = data.content.equipmentRules.noUnskilledPenalty.includes(src.id);
  const skillTerm = skill ?? (noPenalty ? 0 : UNTRAINED_ATTACK_PENALTY);
  const punch = l.skills.punch;
  let hit = l.attackBonus + attr + skillTerm + (src.hitBonus ?? 0);
  let damage = src.damage;
  let damageBonus = attr + (src.addsPunch ? (punch ?? 0) : 0) + (src.damageExtra ?? 0);
  let shock: ShockRating | null = mode === 'melee' && src.shock ? { ...src.shock } : null;
  let shockExtra = src.damageExtra ?? 0;
  let ignoresAc = false;
  for (const e of effects) {
    if ('excludesUnarmed' in e && e.excludesUnarmed && src.unarmed) continue;
    if (e.kind === 'hit-bonus' && e.modes.includes(mode)) hit += e.amount;
    if (e.kind === 'damage-adds-skill' && e.modes.includes(mode)) {
      damageBonus += l.skills[e.skill] ?? 0;
      if (e.shock) shockExtra += l.skills[e.skill] ?? 0;
    }
    if (e.kind === 'shock-bonus') shockExtra += e.amount;
    if (e.kind === 'shock-ignores-ac') ignoresAc = true;
    if (e.kind === 'unarmed-damage' && src.addsPunch) {
      // The schema gives one die per Punch level 0-4, and skills never exceed 4.
      const level = Math.min(punch ?? 0, 4);
      damage = e.byPunchLevel[level] as Dice;
      if (level >= e.shock.minPunch) shock = { damage: level, maxAc: e.shock.maxAc };
    }
  }
  if (shock)
    shock = { damage: shock.damage + attr + shockExtra, maxAc: ignoresAc ? null : shock.maxAc };
  return { id: src.id, name: src.name, mode, hit, damage, damageBonus, shock };
}

/** One line per readied weapon and mode, plus natural weapons and an unarmed attack. */
export function loadoutAttacks(data: GameData, l: Loadout): AttackLine[] {
  const effects = effectsOf(data, l);
  const sources: [Source, AttackMode[]][] = [];
  const seen = new Set<string>();
  const readied = resolve(data, l.entries).flatMap(({ entry, item }) =>
    item.kind === 'weapon' && entry.location === 'readied' ? [{ entry, weapon: item.weapon }] : [],
  );
  for (const { weapon } of readied) {
    if (seen.has(weapon.id)) continue;
    seen.add(weapon.id);
    // Of several readied lines of one weapon, the character fights with the best.
    const best = readied
      .filter((r) => r.weapon.id === weapon.id)
      .map((r) => upgrade(data, r.entry))
      .reduce((a, b) => (b.hit + b.damage > a.hit + a.damage ? b : a));
    sources.push([
      {
        ...weapon,
        addsPunch: weapon.damageAddsSkill,
        unarmed: weapon.damageAddsSkill,
        hitBonus: best.hit,
        damageExtra: best.damage,
      },
      modesOf(weapon),
    ]);
  }
  for (const e of effects) {
    if (e.kind === 'natural-weapon') sources.push([naturalSource(e.weapon), ['melee']]);
  }
  // The SRD unarmed attack: the one weapon that adds the Punch skill to damage.
  for (const unarmed of data.srd.weapons.filter((w) => w.damageAddsSkill)) {
    sources.push([{ ...unarmed, addsPunch: true, unarmed: true, skill: 'punch' }, ['melee']]);
  }
  return sources.flatMap(([src, modes]) => modes.map((m) => attackLine(data, l, src, m, effects)));
}

function naturalSource(w: NaturalWeapon): Source {
  return { ...w, addsPunch: false, unarmed: true };
}

export interface EquipmentSummary {
  armorClass: number;
  armorClassInput: ArmorClassInput;
  attacks: AttackLine[];
  load: Load;
}

export function loadoutSummary(data: GameData, l: Loadout): EquipmentSummary {
  return {
    armorClass: loadoutArmorClass(data, l),
    armorClassInput: loadoutArmorClassInput(data, l),
    attacks: loadoutAttacks(data, l),
    load: loadoutLoad(data, l),
  };
}
