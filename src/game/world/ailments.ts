// Poisons and diseases that linger (vendor/wwn-srd/2.0 The Rules of the Game/2.5.0 Injury,
// Healing, And System Strain.md, 2.5.5; 2.10.0 Falling and Other Hazards.md, Poisons; Sam's calls
// in docs/rules-adaptation.md, Poison and disease). A failed save against poison leaves the victim
// Poisoned until a night save or a cure: a penalty to hit and to skill checks, and no natural
// healing. A disease takes hold after its onset, then each night a failed Physical save does its
// harm and enough successes end it. Nights in some places can pass a disease on.
import type { Exposure } from '../../data/schemas/index.ts';
import { roll } from '../../rules/dice.ts';
import { rollSave } from '../../rules/saves.ts';
import type { Combatant } from '../combat/types.ts';
import type { GameData } from '../character/context.ts';
import { addMemberStrain, alive, hurt, memberSheet, note } from './members.ts';
import { diseaseProof, findDisease, poisonProof } from './ailing.ts';
import { raisedMarks } from '../character/raised-marks.ts';
import { regionMap } from './region.ts';
import type { Member, World } from './types.ts';

/** A lingering poison takes hold; a venom with a save penalty also adds System Strain. */
export function poisonMember(w: World, data: GameData, m: Member, venomPenalty = 0): void {
  if (poisonProof(data, m)) return;
  m.poisoned = true;
  const strain = data.content.ailments.poisoned.venomStrain;
  if (venomPenalty > 0 && strain > 0) addMemberStrain(w, data, m, strain, 'poison');
}

/** A disease is caught, unless the member already carries one. */
export function infect(w: World, data: GameData, m: Member, id: string): void {
  if (m.disease || diseaseProof(data, m)) return;
  m.disease = { id, nights: 0, saves: 0 };
  note(w, `${m.character.name} has caught ${findDisease(data, id).name}.`);
}

/** The disease, if any, that the place where the party spends the night can pass on. */
export function exposureHere(w: World, data: GameData): Exposure | null {
  if (w.dungeon) {
    const s = w.dungeon;
    const dungeon = data.content.dungeons.find((d) => d.id === s.dungeon);
    return dungeon?.levels.find((l) => l.id === s.level)?.exposure ?? null;
  }
  const map = regionMap(data, w.region);
  if (map.siteAt(w.position) !== undefined) return null;
  return map.terrainAt(w.position).exposure ?? null;
}

/** A save against poison or disease, with the Half-Dead's bonus (Phase 20). */
const physical = (w: World, data: GameData, m: Member, penalty: number) =>
  rollSave(w.rng, memberSheet(data, m).saves.physical, {
    modifier: raisedMarks(data, m.character).ailmentSave - penalty,
    steps: m.character.strain.broken ? -1 : 0,
  }).success;

/**
 * The night's turn for poison and disease: the Poisoned save to shake it off; the sick save, and
 * the disease harms them on a failure or ends after enough successes; then the place may sicken
 * the healthy, `chance` in 6, each saving against it; a town or a coach's waystation never does.
 */
export function nightForAilments(w: World, data: GameData, inTown = false): void {
  for (const m of alive(w).filter((x) => !x.reviving)) {
    const name = m.character.name;
    if (m.poisoned && physical(w, data, m, 0)) {
      m.poisoned = false;
      note(w, `${name} sweats out the poison.`);
    }
    if (m.disease) sicken(w, data, m);
  }
  const exposure = inTown ? null : exposureHere(w, data);
  if (!exposure || roll(w.rng, { count: 1, sides: 6, modifier: 0 }).total > exposure.chance) return;
  const d = findDisease(data, exposure.disease);
  for (const m of alive(w).filter((x) => !x.disease))
    if (!physical(w, data, m, d.savePenalty)) infect(w, data, m, d.id);
}

function sicken(w: World, data: GameData, m: Member): void {
  const state = m.disease as NonNullable<Member['disease']>;
  const d = findDisease(data, state.id);
  const name = m.character.name;
  const active = state.nights >= d.onsetNights;
  state.nights += 1;
  if (!active) return;
  if (physical(w, data, m, d.savePenalty)) {
    state.saves += 1;
    if (state.saves >= d.savesToRecover) {
      m.disease = null;
      note(w, `${name} recovers from ${d.name}.`);
    } else note(w, `${name} fights off ${d.name} for the night.`);
    return;
  }
  note(w, `${d.name} worsens in ${name}.`);
  const h = d.harm;
  if (h.kind === 'strain') addMemberStrain(w, data, m, h.amount, 'disease');
  else if (h.kind === 'hp') hurt(w, m, roll(w.rng, h.dice).total);
}

/** What the fight left in a member who lived: the poison, a venom's strain, a disease caught. */
export function ailmentsBack(w: World, data: GameData, m: Member, c: Combatant): void {
  if (m.dead) return;
  if (c.poisoned && !poisonProof(data, m)) m.poisoned = true;
  if (c.venom > 0) addMemberStrain(w, data, m, c.venom, 'poison');
  if (c.drained > 0) addMemberStrain(w, data, m, c.drained, 'monster');
  if (c.caught) infect(w, data, m, c.caught);
}

/** A cure ends the ailment outright. */
export function cure(m: Member, ailment: 'poison' | 'disease'): void {
  if (ailment === 'poison') m.poisoned = false;
  else m.disease = null;
}
