// Phase 15 arts outside combat, each from its SRD text in vendor/wwn-srd/1.0 Character Creation/
// 1.5.0 Class List/: the sight arts (Earthsight, Flamesight, Gravesight, Sense Magic, Healer's Eye)
// and the Blood Priest's Light of Faith underground; Elemental Resilience, Wizard's Grandeur, Cold
// Flesh, and Tireless Vigor against the night's privations; the Necromancer's Bonetalker and
// Unaging; the Blood Priest's Transubstantiation and Words of Mercy; and the Healer's Refined
// Restoration (docs/rules-adaptation.md, Phase 15).
import type { PendingEncounter } from '../../data/schemas/index.ts';
import { roll } from '../../rules/dice.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import { armorFreeArts } from '../character/magic.ts';
import { alive, awake, note, setHp } from './members.ts';
import type { Member, World } from './types.ts';

/** Arts that see without light; Light of Faith lights the party instead. */
export const SIGHT_ARTS = ['earthsight', 'flamesight', 'gravesight', 'sense-magic', 'healers-eye'];
export const FAITH_LIGHT = 'the-light-of-faith';

/** A conscious member holds the art, it works in what they wear, and they have Effort left. */
export function artUsable(data: GameData, m: Member, art: string): boolean {
  const c = m.character;
  if (!awake(m) || !c.arts.includes(art)) return false;
  const magic = characterSheet(c, data).magic;
  if (!magic || m.effortDay >= magic.effort) return false;
  return magic.canCast || armorFreeArts(data, c.classes, c.arts).includes(art);
}

/** The first member who can use the art now. */
export const userOf = (w: World, data: GameData, art: string) =>
  w.members.find((m) => artUsable(data, m, art));

/** Someone in the party sees in the dark. */
export const seer = (w: World, data: GameData) =>
  SIGHT_ARTS.some((art) => userOf(w, data, art) !== undefined);

/** The night's privations a member's arts keep off. */
export function immuneTo(
  data: GameData,
  m: Member,
  condition: 'cold' | 'sleepless' | 'hungry',
): boolean {
  const arts = m.character.arts;
  if (condition === 'cold')
    return arts.includes('elemental-resilience') || artUsable(data, m, 'wizards-grandeur');
  const vigor = artUsable(data, m, 'tireless-vigor');
  return condition === 'hungry' ? vigor : vigor || arts.includes('cold-flesh');
}

/** Bonetalker: mindless undead let a party with a Necromancer who speaks to them pass. */
export function bonetalker(w: World, data: GameData, e: PendingEncounter): void {
  const all = e.enemies.flat();
  const mindless = all.every((id) => {
    const c = data.content.monsterCombat.find((x) => x.id === id);
    return c?.tags.includes('undead') && c.mind === 'mindless';
  });
  const talker = alive(w).find((m) => awake(m) && m.character.arts.includes('bonetalker'));
  if (!mindless || !talker || !e.hostile) return;
  e.hostile = false;
  note(w, `${talker.character.name} speaks to the dead, and they let the party be.`);
}

/**
 * Transubstantiation at day's end: Effort for the day turns water into sacred blood that feeds up
 * to six for the day, and heals each 1d6 plus the priest's Pray skill. True if it fed the party.
 */
export function sacredBlood(w: World, data: GameData): boolean {
  const priest = userOf(w, data, 'transubstantiation');
  if (!priest) return false;
  priest.effortDay += 1;
  const pray = priest.character.skills.pray ?? 0;
  for (const m of alive(w).filter(awake).slice(0, 6)) {
    const healed = roll(w.rng, { count: 1, sides: 6, modifier: pray }).total;
    setHp(m, Math.min(m.character.hp.max, m.character.hp.current + healed));
  }
  note(w, `${priest.character.name} turns water into sacred blood, and the party drinks.`);
  return true;
}

/** Words of Mercy: Effort for the day rerolls a failed plea for peace. */
export function mercy(w: World, data: GameData): Member | undefined {
  const priest = userOf(w, data, 'words-of-mercy');
  if (priest) priest.effortDay += 1;
  return priest;
}

/** Refined Restoration: a Healer in the party who tends the sleepers. */
export const tended = (w: World) =>
  w.members.some((m) => awake(m) && m.character.arts.includes('refined-restoration'));

/** Unaging: immune to poisons. */
export const poisonProof = (m: Member) => m.character.arts.includes('unaging');

/**
 * Tireless Vigor's regeneration (Sam's call, Phase 15): each Healer who can commit Effort heals
 * `hp` lost hit points: 1 after a fight, 1 every 10 dungeon turns, and 5 each quarter.
 */
export const VIGOR_QUARTER = 5;
export const VIGOR_TURNS = 10;

export function vigor(w: World, data: GameData, hp: number): void {
  for (const m of w.members.filter((x) => artUsable(data, x, 'tireless-vigor'))) {
    const c = m.character;
    setHp(m, Math.min(c.hp.max, c.hp.current + hp));
  }
}
