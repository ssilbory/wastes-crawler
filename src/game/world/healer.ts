// The Healer's Revive the Fallen (Phase 14d; vendor/wwn-srd/1.0 Character Creation/1.5.0 Class
// List/1.5.9 The Healer.md): Effort for the day brings back a member slain in the party's last
// fight. The SRD allows a minute per caster level; Sam's call is the aftermath of that fight, where
// it was fought, before the party moves on or the day ends. The revived take maximum System Strain
// and lie unconscious until the next night passes, waking with 1 hit point.
import { characterSheet } from '../character/derived.ts';
import { armorFreeArts } from '../character/magic.ts';
import type { GameData } from '../character/context.ts';
import { cureFrailty, note, setHp } from './members.ts';
import { placeKey } from './necromancy.ts';
import type { TownResult } from './services.ts';
import type { Battle } from '../combat/types.ts';
import type { Member, World } from './types.ts';

export const REVIVE = 'revive-the-fallen';

/** Revive the Fallen as `cannotUseArt` names it. */
export const REVIVE_ART = {
  id: REVIVE,
  name: 'Revive the Fallen',
  unable: 'No one is able to revive the fallen.',
};

const no = (reason: string): TownResult => ({ ok: false, reason });

/** After a fight, the members it killed lie where it was fought. */
export function recordFallen(w: World, memberIds: readonly string[], battle: Battle): void {
  const slain = memberIds.filter((_, i) => battle.combatants[i]?.status === 'dead');
  w.fallen = slain.length > 0 ? { at: placeKey(w), members: slain } : null;
}

/** The members a Healer could still revive where the party stands. */
export function fallenHere(w: World): Member[] {
  const f = w.fallen;
  if (!f || f.at !== placeKey(w)) return [];
  return w.members.filter((m) => m.dead && f.members.includes(m.id));
}

/**
 * Why the member can't use a Healer art for day Effort now, or null if they can. `unable` is the
 * refusal when no conscious member was chosen.
 */
export function cannotUseArt(
  data: GameData,
  healer: Member | undefined,
  art: { id: string; name: string; unable: string },
): string | null {
  if (!healer || healer.dead || healer.character.hp.current <= 0) return art.unable;
  const c = healer.character;
  if (!c.arts.includes(art.id)) return `${c.name} doesn't know ${art.name}.`;
  const magic = characterSheet(c, data, healer.form).magic;
  // Healer arts work in armor (1.5.9); a sheet with arts always has magic.
  const sheet = magic as NonNullable<typeof magic>;
  if (!sheet.canCast && !armorFreeArts(data, c.classes, c.arts).includes(art.id))
    return `${c.name} can't use that art in armor.`;
  if (healer.effortDay >= sheet.effort) return `${c.name} has no Effort left today.`;
  return null;
}

/** Revive the Fallen on a member slain in the last fight, here. */
export function reviveFallen(
  w: World,
  data: GameData,
  healerId: string,
  targetId: string,
): TownResult {
  const healer = w.members.find((m) => m.id === healerId);
  const why = cannotUseArt(data, healer, REVIVE_ART);
  if (why) return no(why);
  const target = fallenHere(w).find((m) => m.id === targetId);
  if (!target) return no('Only those slain in the fight just won can be revived, where they fell.');
  (healer as Member).effortDay += 1;
  revive(target);
  const max = characterSheet(target.character, data).strainMax;
  target.character = { ...target.character, strain: { value: max, broken: false } };
  setHp(target, 0);
  target.reviving = true;
  const f = w.fallen as NonNullable<World['fallen']>;
  f.members = f.members.filter((id) => id !== targetId);
  note(
    w,
    `${(healer as Member).character.name} revives ${target.character.name}, who lies unconscious.`,
  );
  return { ok: true };
}

/** The night passes: the revived wake with 1 hit point. */
export function wakeRevived(w: World): void {
  for (const m of w.members.filter((x) => x.reviving && !x.dead)) {
    m.reviving = false;
    setHp(m, Math.max(1, m.character.hp.current));
    note(w, `${m.character.name} wakes.`);
  }
}

/** Brings a dead member back: 1 HP, no strain, and the XP they earned while dead. */
export function revive(m: Member): void {
  Object.assign(m, { dead: false, hungry: false, thirsty: false, sleepless: false, cold: false });
  cureFrailty(m);
  m.character = {
    ...m.character,
    xp: m.character.xp + m.pendingXp,
    strain: { value: 0, broken: false },
  };
  m.pendingXp = 0;
  setHp(m, 1);
}
