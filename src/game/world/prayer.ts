// Prayer (docs/rules-adaptation.md, Skills): once a day each member may pray at a temple or
// mortuary, never a necromancer's crypt. A heard prayer eases the one praying of 1 System Strain or
// lifts one member's Frailty.
import type { MissionGiver } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { alive, awake, cureFrailty, memberCheck, note } from './members.ts';
import type { TownResult } from './services.ts';
import { townHere } from './town.ts';
import type { World } from './types.ts';

export type Prayer = { kind: 'strain' } | { kind: 'frailty'; target: string };

const no = (reason: string): TownResult => ({ ok: false, reason });

/** The town's temple or mortuary keeper, if it has one. */
export function shrineHere(w: World, data: GameData): MissionGiver | undefined {
  const town = townHere(w, data).id;
  const places = data.content.skillRules.prayer.places;
  return data.content.missionGivers.find(
    (g) => g.town === town && g.raises !== undefined && places.includes(g.raises),
  );
}

export const prayedToday = (w: World, m: { prayedDay: number | null }) => m.prayedDay === w.day;

export function pray(w: World, data: GameData, memberId: string, prayer: Prayer): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const shrine = shrineHere(w, data);
  if (!shrine) return no(`${townHere(w, data).name} has no temple or mortuary.`);
  const m = w.members.find((x) => x.id === memberId && awake(x));
  if (!m) return no('Choose someone to pray.');
  const name = m.character.name;
  if (prayedToday(w, m)) return no(`${name} has already prayed today.`);
  const target =
    prayer.kind === 'frailty' ? alive(w).find((x) => x.id === prayer.target && x.frail) : m;
  if (!target) return no('Choose someone who is Frail.');
  if (prayer.kind === 'strain' && m.character.strain.value === 0)
    return no(`${name} has no strain to ease.`);
  const rules = data.content.skillRules.prayer;
  m.prayedDay = w.day;
  const place = `${shrine.name}'s ${shrine.raises}`;
  if (!memberCheck(w, data, m, 'pray', rules.attributes, rules.difficulty).success) {
    note(w, `${name} prays at ${place}, but no answer comes.`);
    return { ok: true };
  }
  if (prayer.kind === 'frailty') {
    cureFrailty(target);
    note(w, `${name} prays at ${place}, and ${target.character.name}'s Frailty lifts.`);
  } else {
    const s = m.character.strain;
    m.character = { ...m.character, strain: { ...s, value: s.value - 1 } };
    note(w, `${name} prays at ${place} and feels the strain ease.`);
  }
  return { ok: true };
}
