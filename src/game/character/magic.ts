// Arts and starting spells: vendor/wwn-srd/4.0 Magic and Spellcasting/4.1.0 Spells and Arts.md,
// 4.2.0 Preparing and Casting Spells.md, 4.3.0 Dual Partial Spellcasters.md, and 1.7.5 Mages Choose
// Starting Spells. Effort across classes: docs/rules-adaptation.md (Class switching).
import type { Art, ClassOption } from '../../data/schemas/index.ts';
import {
  boostedModifier,
  type AttributeScores,
  type ModifierBonuses,
} from '../../rules/attributes.ts';
import { canCastIn, effortMaximum, type ArmoredCasting } from '../../rules/magic.ts';
import { castingRow, type CastingLevelRow, type ClassLevels } from '../../rules/progression.ts';
import { classOption, findTradition } from './class-step.ts';
import type { GameData } from './context.ts';
import { activeEffects } from './equipment.ts';
import type { HeldFocus } from './foci.ts';
import { entryEncumbrance, findItem, type InventoryEntry } from './items.ts';
import type { Skills } from './skills.ts';
import { fail, INCOMPLETE, OK, type StepStatus } from './steps.ts';
import { gameSpells, type GameSpell } from '../../data/spells.ts';

type Mage = NonNullable<ClassOption['mage']>;

function table(data: GameData, id: string) {
  const t = data.srd['casting-progressions'].find((c) => c.id === id);
  if (!t) throw new Error(`unknown casting table ${id}`);
  return t;
}

export interface ArtPick {
  tradition: string;
  /** Arts the tradition grants outright at this level. */
  automatic: string[];
  /** Free picks from the tradition's other arts. */
  picks: number;
}

/** Each class picks its own arts (4.1.0), from its tradition's arts table. */
export function artPicks(data: GameData, mage: Mage, level = 1): ArtPick[] {
  return mage.traditions.map((t) => {
    const row = castingRow(table(data, t.arts), level);
    // Excluded arts are never granted, not even automatically (Elemental Sparks, Phase 15).
    const excluded = findTradition(data, t.tradition)?.excludedArts ?? [];
    const automatic = row.arts.filter((a) => !excluded.includes(a));
    return { tradition: t.tradition, automatic, picks: row.anyArts };
  });
}

/** Whether the class ever gains arts, and so has Effort to spend; the Invoker doesn't (1.5.11). */
export const gainsArts = (data: GameData, mage: Mage): boolean =>
  mage.traditions.some((t) =>
    table(data, t.arts).levels.some((l) => l.arts.length + l.anyArts > 0),
  );

/** Whether the class's spell points and preparations add the Int modifier: the Invoker (1.5.11). */
export const addsInt = (data: GameData, mage: Mage): boolean => !!table(data, mage.slots).plusInt;

/** `intModifier` counts only for the Invoker, whose points and preparations add it (1.5.11). */
export function spellSlots(
  data: GameData,
  mage: Mage,
  level = 1,
  intModifier = 0,
): CastingLevelRow {
  const row = castingRow(table(data, mage.slots), level);
  if (!addsInt(data, mage)) return row;
  return {
    ...row,
    spellPoints: Math.max(0, row.spellPoints + intModifier),
    spellsPrepared: Math.max(0, row.spellsPrepared + intModifier),
  };
}

/**
 * Whether the game does anything with a spell: a combat effect, or a use outside fights, and not
 * left out for good (docs/rules-adaptation.md, High Magic). Others wait until they are built.
 */
export function playableSpell(data: GameData, id: string): boolean {
  const rules = data.content.spellRules;
  if (rules.excluded.includes(id)) return false;
  return rules.outsideCombat.includes(id) || data.content.combatMagic.some((m) => m.id === id);
}

/** Spells from every list the class's traditions can learn, up to the castable level. */
export function learnableSpells(data: GameData, mage: Mage, maxLevel: number): GameSpell[] {
  const lists = new Set(
    mage.traditions.flatMap((t) => findTradition(data, t.tradition)?.spellLists ?? []),
  );
  return gameSpells(data.srd, data.content).filter(
    (s) =>
      lists.has(s.tradition) &&
      s.level <= maxLevel &&
      !mage.excludedSpells.includes(s.id) &&
      playableSpell(data, s.id),
  );
}

/** How many new spells a level asks for: the class's number, or as many as are left to learn. */
export function spellPicks(
  data: GameData,
  mage: Mage,
  maxLevel: number,
  known: readonly string[],
  wanted: number,
): number {
  const left = learnableSpells(data, mage, maxLevel).filter((s) => !known.includes(s.id)).length;
  return Math.min(wanted, left);
}

/**
 * Why an art can't be picked at the class level, or null if it can: the game leaves some out, and
 * some wait for a level the SRD names in their text (the Healer's Revive the Fallen, at 8th).
 */
export function artBar(
  data: GameData,
  tradition: string,
  art: string,
  level: number,
): string | null {
  const t = findTradition(data, tradition);
  if (t?.excludedArts.includes(art)) return `${art} isn't used in this game`;
  return (t?.artLevels[art] ?? 1) <= level ? null : `${art} waits for a higher level`;
}

/** Whether an art can be picked at the class level. */
export const artOpen = (data: GameData, tradition: string, art: string, level: number) =>
  artBar(data, tradition, art, level) === null;

/** The arts a pick can choose: the tradition's, not held or granted, open at the level. */
export function artChoices(
  data: GameData,
  p: ArtPick,
  held: readonly string[],
  level: number,
): Art[] {
  return data.srd.arts.filter(
    (a) =>
      a.tradition === p.tradition &&
      !held.includes(a.id) &&
      !p.automatic.includes(a.id) &&
      artOpen(data, p.tradition, a.id, level),
  );
}

/**
 * A level's art picks for a character already holding `held`: an automatic art they hold becomes
 * a free pick instead (Sam's call), and picks never outnumber the arts left to choose.
 */
export function levelArtPicks(
  data: GameData,
  mage: Mage,
  level: number,
  held: readonly string[],
): ArtPick[] {
  return artPicks(data, mage, level).map((p) => {
    const fresh = { ...p, automatic: p.automatic.filter((a) => !held.includes(a)) };
    const owed = p.picks + p.automatic.length - fresh.automatic.length;
    return { ...fresh, picks: Math.min(owed, artChoices(data, fresh, held, level).length) };
  });
}

export interface MagicChoice {
  arts: string[];
  known: string[];
  prepared: string[];
}

export interface MagicOutcome {
  status: StepStatus;
  /** Automatic arts plus the chosen ones. */
  arts: string[];
  known: string[];
  prepared: string[];
}

const dupes = (ids: readonly string[]) => ids.filter((id, i) => ids.indexOf(id) !== i);

export function evaluateMagic(
  data: GameData,
  mage: Mage | undefined,
  choice: MagicChoice | null,
  intModifier = 0,
): MagicOutcome {
  const empty = (status: StepStatus): MagicOutcome => ({
    status,
    arts: [],
    known: [],
    prepared: [],
  });
  if (!mage) return empty(OK);
  if (!choice) return empty(INCOMPLETE);
  const picks = artPicks(data, mage);
  const automatic = picks.flatMap((p) => p.automatic);
  const done = (status: StepStatus): MagicOutcome => ({
    status,
    arts: [...automatic, ...choice.arts],
    known: choice.known,
    prepared: choice.prepared,
  });
  if (dupes(choice.arts).length > 0) return done(fail('each art can be picked only once'));
  let short = false;
  for (const p of picks) {
    const chosen = choice.arts.filter(
      (id) => data.srd.arts.find((a) => a.id === id)?.tradition === p.tradition,
    );
    if (chosen.some((id) => p.automatic.includes(id)))
      return done(fail('that art is already granted'));
    const barred = chosen.map((id) => artBar(data, p.tradition, id, 1)).find((why) => why);
    if (barred) return done(fail(barred));
    if (chosen.length > p.picks) return done(fail(`pick ${p.picks} ${p.tradition} arts`));
    if (chosen.length < p.picks) short = true;
  }
  const traditions = new Set(picks.map((p) => p.tradition));
  const stray = choice.arts.find(
    (id) => !traditions.has(data.srd.arts.find((a) => a.id === id)?.tradition ?? ''),
  );
  if (stray) return done(fail(`${stray} isn't an art of your tradition`));

  const slots = spellSlots(data, mage, 1, intModifier);
  const learnable = new Set(learnableSpells(data, mage, slots.maxSpellLevel).map((s) => s.id));
  const unknown = choice.known.find((id) => !learnable.has(id));
  if (unknown) return done(fail(`${unknown} isn't a spell you can learn yet`));
  if (dupes(choice.known).length > 0) return done(fail('each spell can be learned only once'));
  const starting = Math.min(mage.startingSpells, learnable.size);
  if (choice.known.length > starting) {
    return done(fail(`a new character knows ${starting} spells`));
  }
  if (choice.prepared.some((id) => !choice.known.includes(id)) || dupes(choice.prepared).length) {
    return done(fail('prepare each known spell at most once'));
  }
  if (choice.prepared.length > slots.spellsPrepared) {
    return done(fail(`you can prepare ${slots.spellsPrepared} spells`));
  }
  return done(short || choice.known.length < starting ? INCOMPLETE : OK);
}

/** The traditions of every casting class the character holds a level in. */
export const heldTraditions = (data: GameData, classes: ClassLevels) =>
  Object.entries(classes.levels)
    .filter(([, level]) => level >= 1)
    .flatMap(([id]) => classOption(data, id)?.mage?.traditions ?? []);

/**
 * One Effort pool from every casting class held: the best Effort skill and the best attribute any
 * of them allows, one lower only when all are partial. Null for characters with no casting class.
 */
export function effortFor(
  data: GameData,
  classes: ClassLevels,
  skills: Skills,
  scores: AttributeScores,
  bonuses: ModifierBonuses,
): number | null {
  const effort = heldTraditions(data, classes).flatMap((t) => {
    const tradition = findTradition(data, t.tradition);
    return tradition ? [{ ...tradition.effort, partial: t.partial }] : [];
  });
  if (effort.length === 0) return null;
  return effortMaximum({
    skill: Math.max(...effort.flatMap((e) => e.skills.map((s) => skills[s] ?? 0))),
    attributeModifier: Math.max(
      ...effort.flatMap((e) => e.attributes.map((a) => boostedModifier(scores[a], bonuses[a]))),
    ),
    offset: Math.max(...effort.map((e) => e.base - (e.partial && e.partialPenalty ? 1 : 0))),
    floorOne: effort.some((e) => e.floorOne || (e.partial && e.partialPenalty)),
  });
}

/** Whether every tradition the character holds works its arts in armor (the Blood Priest). */
export function armoredArts(data: GameData, classes: ClassLevels): boolean {
  const held = heldTraditions(data, classes);
  return held.length > 0 && held.every((t) => findTradition(data, t.tradition)?.armoredArts);
}

/**
 * The held arts of traditions that work in armor, usable when armor blocks the rest: a Priest of
 * Death's Healer arts (1.5.9: "simple enough to perform even when burdened by armor").
 */
export function armorFreeArts(
  data: GameData,
  classes: ClassLevels,
  arts: readonly string[],
): string[] {
  const traditions = new Set(
    heldTraditions(data, classes)
      .filter((t) => findTradition(data, t.tradition)?.armoredArts)
      .map((t) => t.tradition),
  );
  return arts.filter((id) =>
    traditions.has(data.srd.arts.find((a) => a.id === id)?.tradition ?? ''),
  );
}

/** Worn armor (barding included) and shields block casting unless Armored Magic allows them. */
export function castingAllowed(
  data: GameData,
  entries: readonly InventoryEntry[],
  foci: readonly HeldFocus[],
): boolean {
  const armor: number[] = [];
  let shield = false;
  for (const entry of entries) {
    const item = findItem(data, entry.id);
    if (entry.location !== 'worn' || !item) continue;
    if (item.kind === 'armor' && item.armor.encumbrance !== null) {
      armor.push(entryEncumbrance(data, item, entry));
    }
    if (item.kind === 'shield') shield = true;
  }
  const armored = activeEffects(data, foci).flatMap((e): ArmoredCasting[] =>
    e.kind === 'armored-casting' ? [e] : [],
  );
  const best: ArmoredCasting | null =
    armored.length === 0
      ? null
      : {
          maxEncumbrance: armored.some((a) => a.maxEncumbrance === null)
            ? null
            : Math.max(...armored.map((a) => a.maxEncumbrance as number)),
          shields: armored.some((a) => a.shields),
        };
  return canCastIn(armor, shield, best);
}
