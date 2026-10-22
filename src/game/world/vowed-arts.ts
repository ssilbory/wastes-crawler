// The Vowed's arts outside combat (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.17
// The Vowed.md): Master's Vigor's two hit points an hour, and Purified Body against poison,
// disease, hunger, and sleeplessness. When each applies is Sam's call (docs/rules-adaptation.md,
// The Vowed).
import { characterSheet } from '../character/derived.ts';
import type { GameData } from '../character/context.ts';
import { cure } from './ailments.ts';
import { alive, artUsable, note, setHp } from './members.ts';
import type { Member, World } from './types.ts';

/** Master's Vigor: two hit points an hour, so 12 a quarter and 2 every 6 dungeon turns. */
export const MASTERS_VIGOR_QUARTER = 12;
export const MASTERS_VIGOR_TURNS = 6;
export const MASTERS_VIGOR_HP = 2;

/** Holds the art and can use it, armor allowing; it needs no Effort. */
function holds(data: GameData, m: Member, art: string): boolean {
  const c = m.character;
  // Anyone with an art has magic.
  return (
    c.arts.includes(art) && (characterSheet(c, data, m.form).magic as { canCast: boolean }).canCast
  );
}

/** Master's Vigor heals `hp` lost hit points of each living Vowed who holds it, asleep or not. */
export function mastersVigor(w: World, data: GameData, hp: number): void {
  for (const m of alive(w).filter((x) => holds(data, x, 'masters-vigor'))) {
    const c = m.character;
    setHp(m, Math.min(c.hp.max, c.hp.current + hp));
  }
}

const PURIFIED = 'purified-body';

/**
 * Purified Body at day's end: Effort for the day cures a Vowed's poison, and again their disease,
 * while they have Effort left.
 */
export function purifyBodies(w: World, data: GameData): void {
  for (const m of alive(w)) {
    for (const s of ['poison', 'disease'] as const) {
      const sick = s === 'poison' ? m.poisoned : m.disease !== null;
      if (!sick || !artUsable(data, m, PURIFIED)) continue;
      m.effortDay += 1;
      cure(m, s);
      note(w, `${m.character.name} purges the ${s} from their own body.`);
    }
  }
}

/**
 * Purified Body against the night: Effort for the day spares a Vowed who would go hungry or
 * sleepless. Returns those it spared.
 */
export function purifiedNeeds(
  w: World,
  data: GameData,
  needs: (m: Member) => boolean,
): Set<Member> {
  const spared = alive(w).filter((m) => needs(m) && artUsable(data, m, PURIFIED));
  for (const m of spared) {
    m.effortDay += 1;
    note(w, `${m.character.name} needs neither food nor sleep tonight.`);
  }
  return new Set(spared);
}
