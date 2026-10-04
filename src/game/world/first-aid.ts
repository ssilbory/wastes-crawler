// First aid (vendor/wwn-srd/2.0 The Rules of the Game/2.5.0 Injury, Healing, And System Strain.md,
// 2.5.4): a healer with a healer's kit restores 1d6 plus their Heal skill (1d6-1 without the
// skill), and each application adds 1 System Strain to the patient. Frail patients can be patched
// up but stay Frail. A Mundane Physician heals with the common hireling's total +1 (3.3.0), and
// their first application each day adds no strain (Sam's call).
import { roll } from '../../rules/dice.ts';
import { addStrain } from '../../rules/strain.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import { alive, note, setHp } from './members.ts';
import { typeOf } from './npcs.ts';
import type { TownResult } from './services.ts';
import type { World } from './types.ts';

export const HEALERS_KIT = 'healers-pouch';
const UNSKILLED = -1;

export interface Healer {
  id: string;
  name: string;
  /** Added to the 1d6. */
  bonus: number;
}

/** Conscious PCs carrying a healer's kit, and physicians. */
export function healers(w: World, data: GameData): Healer[] {
  const pcs = alive(w)
    .filter(
      (m) => m.character.hp.current > 0 && m.character.inventory.some((e) => e.id === HEALERS_KIT),
    )
    .map((m) => ({
      id: m.id,
      name: m.character.name,
      bonus: m.character.skills.heal ?? UNSKILLED,
    }));
  const npcs = w.npcs
    .filter((n) => n.hp > 0 && typeOf(data, n)?.role === 'physician')
    .map((n) => ({ id: n.id, name: n.name, bonus: data.content.npcRules.skillBonus }));
  return [...pcs, ...npcs];
}

const no = (reason: string): TownResult => ({ ok: false, reason });

/** One application of first aid to a party member or an NPC. */
export function firstAid(w: World, data: GameData, healerId: string, targetId: string): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const healer = healers(w, data).find((h) => h.id === healerId);
  if (!healer) return no('That healer has no healer’s kit at hand.');
  const npc = w.npcs.find((n) => n.id === targetId);
  const amount = () =>
    Math.max(0, roll(w.rng, { count: 1, sides: 6, modifier: healer.bonus }).total);
  if (npc) {
    if (npc.hp >= npc.maxHp) return no(`${npc.name} is unhurt.`);
    const healed = amount();
    npc.hp = Math.min(npc.maxHp, npc.hp + healed);
    note(w, `${healer.name} patches up ${npc.name} for ${healed} HP.`);
    return { ok: true };
  }
  const m = alive(w).find((x) => x.id === targetId);
  if (!m) throw new Error(`no living party member ${targetId}`);
  const c = m.character;
  if (c.hp.current >= c.hp.max) return no(`${c.name} is unhurt.`);
  // Sam's call: a physician's first application each day adds no System Strain.
  const physician = w.npcs.some((n) => n.id === healer.id);
  if (physician && w.hirelingDays.aid !== w.day) {
    w.hirelingDays.aid = w.day;
    const healed = amount();
    setHp(m, Math.min(c.hp.max, c.hp.current + healed));
    note(
      w,
      `${healer.name} patches up ${c.name} for ${healed} HP, gently enough to cost no strain.`,
    );
    return { ok: true };
  }
  const max = characterSheet(c, data).strainMax;
  const outcome = addStrain(
    { strain: c.strain.value, max, broken: c.strain.broken },
    1,
    'first-aid',
  );
  if (outcome.kind !== 'applied') return no(`${c.name} can't take any more strain.`);
  const healed = amount();
  m.character = { ...c, strain: { value: outcome.state.strain, broken: outcome.state.broken } };
  setHp(m, Math.min(c.hp.max, c.hp.current + healed));
  note(w, `${healer.name} patches up ${c.name} for ${healed} HP.`);
  return { ok: true };
}
