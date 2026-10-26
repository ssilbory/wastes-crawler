// Apprehending the Arcane Form (vendor/wwn-srd/4.0 Magic and Spellcasting/4.4.0 High Magic Spells
// by Level.md; Sam's call, docs/rules-adaptation.md, High Magic outside fights): for fifteen minutes
// a caster level (a turn and a half each, rounded down), the caster sees by the quasi-light of the
// thaumic currents, so the party is not blind in the dark (light.ts). On casting, the magical
// squares of the level show on the map: teleporters, spinners, anti-map, darkness, and anti-magic.
import type { Special } from '../../data/schemas/index.ts';
import { cellKey } from '../../rules/grid.ts';
import { characterLevel } from '../../rules/progression.ts';
import type { GameData } from '../character/context.ts';
import { cannotCast, spendCast } from '../world/casting.ts';
import { note } from '../world/members.ts';
import type { TownResult } from '../world/services.ts';
import type { Member, World } from '../world/types.ts';
import { levelOf } from './levels.ts';

export const ARCANE_FORM = 'apprehending-the-arcane-form';

const MAGICAL: readonly Special['kind'][] = [
  'teleporter',
  'spinner',
  'anti-map',
  'darkness',
  'anti-magic',
];

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Exploration turns the sight lasts. */
export const sightTurns = (level: number) => Math.floor(1.5 * level);

/** Apprehending the Arcane Form: magic shows itself, and the dark is no bar. */
export function apprehend(w: World, data: GameData, memberId: string): TownResult {
  const s = w.dungeon;
  if (!s) return no('There is nothing here for the sight to find.');
  if (w.encounter) return no('Settle the encounter first.');
  const m = w.members.find((x) => x.id === memberId);
  const why = cannotCast(data, m, ARCANE_FORM);
  if (why) return no(why);
  const caster = m as Member;
  spendCast(data, caster, ARCANE_FORM);
  s.sight = {
    member: caster.id,
    until: s.turn + sightTurns(characterLevel(caster.character.classes)),
  };
  const found = levelOf(data, s.dungeon, s.level)
    .level.specials.filter((x) => MAGICAL.includes(x.kind))
    .map((x) => cellKey(x.at));
  s.sensed[s.level] = [...new Set([...(s.sensed[s.level] ?? []), ...found])];
  const n = new Set(found).size;
  note(
    w,
    `${caster.character.name}'s eyes open to the arcane. ${
      n === 0
        ? 'No working of magic shows on this level.'
        : `${n} working${n === 1 ? '' : 's'} of magic glow on this level.`
    }`,
  );
  return { ok: true };
}
