// Obnubilation of the Will (vendor/wwn-srd/4.0 Magic and Spellcasting/4.4.0 High Magic Spells by
// Level.md; Sam's calls, docs/rules-adaptation.md, Obnubilation of the Will in Phase 21): cast
// outside a fight on one of the surrendered, a thinking, living foe, who makes a Mental save or is
// enthralled. The thrall tells everything the surrendered could, then joins the party as a fighting
// servant under the caster if there is room. A prisoner who saves is immune from then on.
import type { MonsterCombat } from '../../data/schemas/index.ts';
import { rollSave } from '../../rules/saves.ts';
import type { GameData } from '../character/context.ts';
import { cannotCast, spendCast } from './casting.ts';
import { note } from './members.ts';
import { mindOf } from './minds.ts';
import { addNpc, freshName, monsterOf } from './npcs.ts';
import type { TownResult } from './services.ts';
import { skullAnswer, type SkullQuestion } from './skull.ts';
import { surrenderedHere } from './surrender.ts';
import type { Member, Npc, World } from './types.ts';

export const ENTHRALL = 'obnubilation-of-the-will';

/** Everything a thrall tells: below ground the level and its prizes, above it the land about. */
const TELLS: Record<'below' | 'above', SkullQuestion[]> = {
  below: ['map', 'traps', 'secrets', 'boss', 'vault', 'hoard'],
  above: ['land'],
};

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Whether a surrendered foe could be enthralled: a thinking mind, and alive. */
export function enthrallable(data: GameData, monster: string): boolean {
  const mind = mindOf(data, monster);
  // Content checks give every monster a combat entry.
  const combat = data.content.monsterCombat.find((c) => c.id === monster) as MonsterCombat;
  const tags = combat.tags;
  return (mind === 'sapient' || mind === 'monster') && !tags.includes('unliving');
}

/** Why the caster can't enthrall the prisoner at `index`, or null. */
export function cannotEnthrall(
  w: World,
  data: GameData,
  casterId: string,
  index: number,
): string | null {
  const s = w.surrendered;
  const monster = surrenderedHere(w)[index];
  if (!s || monster === undefined) return 'No such prisoner.';
  if (!enthrallable(data, monster)) return 'Only a thinking, living foe can be enthralled.';
  if (s.immune?.[index]) return 'That one has already thrown off the spell.';
  return cannotCast(
    data,
    w.members.find((m) => m.id === casterId),
    ENTHRALL,
  );
}

/** Casts Obnubilation of the Will on the prisoner at `index`. */
export function enthrall(w: World, data: GameData, casterId: string, index: number): TownResult {
  const why = cannotEnthrall(w, data, casterId, index);
  if (why) return no(why);
  const s = w.surrendered as NonNullable<World['surrendered']>;
  const caster = w.members.find((m) => m.id === casterId) as Member;
  const monster = s.monsters[index] as string;
  const name = monsterOf(data, monster).name;
  spendCast(data, caster, ENTHRALL);
  const immune = s.monsters.map((_, i) => s.immune?.[i] ?? false);
  immune[index] = true;
  s.immune = immune;
  if (rollSave(w.rng, monsterOf(data, monster).save).success) {
    note(w, `The ${name.toLowerCase()} throws off ${caster.character.name}'s fetters.`);
    return { ok: true };
  }
  note(w, `The ${name.toLowerCase()} falls under ${caster.character.name}'s will.`);
  for (const q of TELLS[w.dungeon ? 'below' : 'above'])
    note(w, skullAnswer(w, data, q).replace('The dead', 'They'));
  s.questioned = true;
  const thrall = addNpc(w, data, 'thrall', monster, monster, freshName(w, name), true);
  if (!thrall) {
    note(w, 'There is no room for it in the party.');
    return { ok: true };
  }
  (thrall as Npc).master = caster.id;
  s.monsters.splice(index, 1);
  immune.splice(index, 1);
  if (s.monsters.length === 0) w.surrendered = null;
  note(w, `${thrall.name} follows ${caster.character.name} now.`);
  return { ok: true };
}
