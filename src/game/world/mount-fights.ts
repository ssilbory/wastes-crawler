// War mounts in overland fights (docs/rules-adaptation.md, Mounts): a ridden war mount fights from
// its rider's slot once its rider calms it with Cha/Ride (vendor/wwn-srd/2.0 The Rules of the
// Game/2.12.0 Wilderness Exploration and Expeditions.md, 2.12.3), and the Rider focus steadies and
// shields it (1.0 Character Creation/1.6.0 Foci.md).
import type { MountSetup } from '../combat/battle.ts';
import type { Battle } from '../combat/types.ts';
import type { GameData } from '../character/context.ts';
import { activeEffects } from '../character/equipment.ts';
import type { FocusEffect } from '../../data/schemas/index.ts';
import type { WorldBattle } from './fight.ts';
import { memberCheck, memberSheet, note } from './members.ts';
import { mountType, riderOf } from './mounts.ts';
import type { Member, Mount, World } from './types.ts';

const hasEffect = (data: GameData, m: Member, kind: FocusEffect['kind']) =>
  activeEffects(data, m.character.foci).some((e) => e.kind === kind);

/** The rider's Cha/Ride check to calm the mount; a Rider's mount never panics (Morale 12). */
function calms(w: World, data: GameData, rider: Member): boolean {
  if (hasEffect(data, rider, 'steady-steed')) return true;
  const { skill, attributes, difficulty } = data.content.mountRules.ride;
  return memberCheck(w, data, rider, skill, attributes, difficulty).success;
}

/**
 * The war mounts that join a fight above ground: living, ridden by someone fighting, and calmed.
 * A mount that panics sits the fight out.
 */
export function calmWarMounts(w: World, data: GameData, fighters: readonly Member[]): Mount[] {
  if (w.dungeon) return [];
  return w.mounts.filter((m) => {
    const rider = riderOf(w, m);
    if (mountType(data, m.type).role !== 'war' || m.hp <= 0 || !rider) return false;
    if (!fighters.includes(rider)) return false;
    if (calms(w, data, rider)) return true;
    note(w, `${m.name} panics and won't be ridden into the fight.`);
    return false;
  });
}

/** The war mounts' line-up, under riders given by their index among `fighters`. */
export function mountSetups(
  w: World,
  data: GameData,
  fighters: readonly Member[],
  mounts: readonly Mount[],
): MountSetup[] {
  return mounts.map((m) => {
    const rider = riderOf(w, m) as Member;
    const steady = hasEffect(data, rider, 'steady-steed');
    return {
      monster: mountType(data, m.type).monster,
      name: m.name,
      rider: fighters.indexOf(rider),
      hp: m.hp,
      maxHp: m.maxHp,
      ...(steady ? { ac: memberSheet(data, rider).equipment.armorClass } : {}),
      ...(hasEffect(data, rider, 'steed-guard') ? { guard: true } : {}),
    };
  });
}

/** War mounts' hit points come back from the fight; one at 0 HP dies with its load. */
export function mountsBack(w: World, fight: WorldBattle): void {
  const first = fight.memberIds.length + fight.npcIds.length;
  fight.mountIds.forEach((id, i) => {
    const c = fight.battle.combatants[first + i] as Battle['combatants'][number];
    const m = w.mounts.find((x) => x.id === id) as Mount;
    if (c.status !== 'dead' && c.hp > 0) {
      m.hp = c.hp;
      return;
    }
    w.mounts = w.mounts.filter((x) => x !== m);
    const lost = m.inventory.length > 0 ? ', and its load is lost' : '';
    note(w, `${m.name} dies${lost}.`);
  });
}
