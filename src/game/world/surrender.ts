// Foes who surrendered (docs/rules-adaptation.md, Morale, escape, and surrender in Phase 19; SRD
// 5.3.1, vendor/wwn-srd/5.0 Monsters and Foes/Morale Checks and Fleeing.md: the beaten "throw down
// their weapons and beg for mercy"). Once the fight is won the party may question them once and
// recruit one, then releases or kills the rest. Moving on without choosing releases them.
import type { GameData } from '../character/context.ts';
import type { WorldBattle } from './fight.ts';
import { winBeast } from './beasts.ts';
import { note } from './members.ts';
import { mindOf } from './minds.ts';
import { leaveCorpses, placeKey } from './necromancy.ts';
import { addNpc, monsterOf } from './npcs.ts';
import type { TownResult } from './services.ts';
import { skullAnswer, type SkullQuestion } from './skull.ts';
import { LOCATE } from './skull-locate.ts';
import { shareText } from './wording.ts';
import type { World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** The monster ids of foes who surrendered in a won fight. */
export const surrenderedIn = (fight: WorldBattle): string[] =>
  fight.battle.combatants.flatMap((c) =>
    c.side === 'enemy' && c.surrendered && c.monster ? [c.monster] : [],
  );

/** Records the surrendered of a won fight where it was fought, in place of any before. */
export function takeSurrender(w: World, fight: WorldBattle): void {
  const monsters = surrenderedIn(fight);
  w.surrendered =
    monsters.length > 0 ? { at: placeKey(w), monsters, questioned: false, recruited: false } : null;
}

/** The surrendered waiting on the party where it stands. */
export const surrenderedHere = (w: World): string[] =>
  w.surrendered?.at === placeKey(w) ? w.surrendered.monsters : [];

/** What the surrendered can tell: below ground the boss, a vault, or the hoards; above, the land. */
export const surrenderQuestions = (w: World): SkullQuestion[] =>
  w.dungeon ? [...LOCATE] : ['land'];

const pending = (w: World) => {
  const s = w.surrendered;
  return s && surrenderedHere(w).length > 0 ? s : null;
};

/** Questions the surrendered, once, as Query the Skull's locating or land questions do. */
export function questionSurrendered(w: World, data: GameData, q: SkullQuestion): TownResult {
  const s = pending(w);
  if (!s) return no('No one here has surrendered.');
  if (s.questioned) return no('They have told all they will.');
  if (!surrenderQuestions(w).includes(q)) return no('They know nothing of that here.');
  s.questioned = true;
  note(w, 'The party questions the surrendered.');
  note(w, skullAnswer(w, data, q).replace('The dead', 'They'));
  return { ok: true };
}

/** The hireling type a surrendered foe fights as, if any. */
export const hirelingFor = (data: GameData, monster: string) =>
  data.content.npcRules.hirelings.find((h) => h.monster === monster);

/** Whether a surrendered foe could join: as a hireling type, or as a beast following a handler. */
export function recruitable(data: GameData, monster: string): 'hireling' | 'beast' | null {
  if (hirelingFor(data, monster)) return 'hireling';
  return mindOf(data, monster) === 'animal' ? 'beast' : null;
}

/**
 * One of the surrendered joins: a would-be hireling signs on at its type's share, a beast follows
 * the handler named (Beasts). Only one a surrender.
 */
export function recruitSurrendered(
  w: World,
  data: GameData,
  index: number,
  handlerId: string | null,
): TownResult {
  const s = pending(w);
  if (!s) return no('No one here has surrendered.');
  if (s.recruited) return no('One of them has already joined.');
  const monster = s.monsters[index];
  if (monster === undefined) return no('No such prisoner.');
  const t = hirelingFor(data, monster);
  if (t) {
    const npc = addNpc(w, data, 'hireling', t.id, t.monster, null, t.role === 'fighter');
    if (!npc) return no('There is no room in the party.');
    note(w, `${npc.name} signs on as a ${t.name} for ${shareText(t.share)} of the loot.`);
  } else {
    if (recruitable(data, monster) !== 'beast') return no('They will not serve.');
    const won = winBeast(w, data, handlerId ?? '', monster);
    if (!won.ok) return won;
  }
  s.recruited = true;
  s.monsters.splice(index, 1);
  s.immune?.splice(index, 1);
  if (s.monsters.length === 0) w.surrendered = null;
  return { ok: true };
}

/** The rest go free. */
export function releaseSurrendered(w: World, data: GameData): TownResult {
  const s = pending(w);
  if (!s) return no('No one here has surrendered.');
  const n = s.monsters.length;
  note(w, n === 1 ? `The party lets the ${name(data, s.monsters)} go.` : 'The party lets them go.');
  w.surrendered = null;
  return { ok: true };
}

/** The rest are put to the sword, and their corpses lie here. */
export function killSurrendered(w: World, data: GameData): TownResult {
  const s = pending(w);
  if (!s) return no('No one here has surrendered.');
  leaveCorpses(w, data, [s.monsters]);
  note(
    w,
    s.monsters.length === 1
      ? `The party kills the ${name(data, s.monsters)}.`
      : 'The party kills them.',
  );
  w.surrendered = null;
  return { ok: true };
}

const name = (data: GameData, monsters: string[]) =>
  monsterOf(data, monsters[0] as string).name.toLowerCase();
