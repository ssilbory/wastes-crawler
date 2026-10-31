// A fight's line-up (docs/plan.md, Combat → Town): the conscious party with its Frailty, strain,
// and the day's spent spells and Effort (SRD 2.5.1, 4.2.0), its NPCs, companions and war mounts,
// as plain data the XP simulation (difficulty.ts) replays, and the battle built from it. Applying
// the finished battle is fight.ts.
import { createBattle, type MountSetup, type NpcSetup } from '../combat/battle.ts';
import type { Battle, WaitingCompanion } from '../combat/types.ts';
import type { Character, Element } from '../../data/schemas/index.ts';
import type { Rng } from '../../rules/rng.ts';
import type { GameData } from '../character/context.ts';
import { alive } from './members.ts';
import { fights, isServant, npcMonster, typeOf } from './npcs.ts';
import { ailPenalty } from './ailing.ts';
import { mountSetups } from './mount-fights.ts';
import { faithLit, inDark } from '../dungeon/light.ts';
import { FAITH_LIGHT, userOf } from './arts.ts';
import { onSpecial } from '../dungeon/specials.ts';
import { pactOf } from './pacts.ts';
import type { Member, Mount, Npc, World } from './types.ts';
import { BIND, companionOf } from './companion-sync.ts';
import { companionSetup, waitingSetup } from './companion-fight.ts';
import { riddenBy } from './companion-mounts.ts';

function npcSetup(data: GameData, n: Npc, party: readonly Member[]): NpcSetup {
  const physician = typeOf(data, n)?.role === 'physician';
  const master = party.findIndex((m) => n.kind === 'companion' && m.id === n.master);
  const m = party[master];
  return {
    ...(m ? { companion: companionSetup(data, m, n, master) } : {}),
    monster: npcMonster(data, n).id,
    name: n.name,
    row: n.row,
    column: n.column,
    hp: n.hp,
    maxHp: n.maxHp,
    noncombatant: !fights(data, n),
    servant: isServant(n),
    ...(physician ? { healer: data.content.npcRules.skillBonus } : {}),
  };
}

/** Fighters carried by a living companion, which fights from their slot above ground. */
export const riders = (w: World, party: readonly Member[]) =>
  party.filter((m) => (riddenBy(w, m)?.hp ?? 0) > 0);

export const fighters = (w: World) =>
  alive(w).filter((m) => m.character.hp.current > 0 && !m.reviving);

/** A fight's starting line-up as plain data, so the XP simulation can replay it in a worker. */
export interface PartySetup {
  party: {
    character: Character;
    row: number;
    column: number;
    frail: boolean;
    spellsCast: number;
    pointsSpent: number;
    /** The alternate form worn into the fight (1.5.15). */
    form: number | null;
    effortDay: number;
    /** Limited art uses since the last rest (Phase 15). */
    artUses: Record<string, number>;
    /** Effort already committed: Light of Faith lighting the way (Phase 15). */
    committed: number;
    /** The element of a Pact of Stone and Sea on them, if any. */
    pact: Element | null;
    /** Die Hard's daily escape from a felling blow already spent today (1.6.0). */
    lastStandSpent: boolean;
    /** Poisoned, and the penalty their poison and disease bring into the fight. */
    poisoned: boolean;
    ailPenalty: number;
    /** The disease they carry into the fight, which may raise them if they die (Phase 19). */
    disease: string | null;
    /** May bind a beast among the foes, and a companion sent away to howl for (1.5.4). */
    canBind: boolean;
    waiting: WaitingCompanion | null;
  }[];
  npcs: NpcSetup[];
  /** War mounts under their riders (docs/rules-adaptation.md, Mounts). */
  mounts: MountSetup[];
  enemies: string[][];
  /** The party fights without light. */
  dark: boolean;
  /** The fight is on an anti-magic square. */
  antiMagic: boolean;
  /** The fight is underground. */
  indoors: boolean;
}

/**
 * The conscious party as it stands (or `party`), its NPCs if `withNpcs`, and war mounts, against
 * enemy rows.
 */
export function partySetup(
  w: World,
  data: GameData,
  enemies: string[][],
  withNpcs: boolean,
  mounts: readonly Mount[] = [],
  party: readonly Member[] = fighters(w),
): PartySetup {
  const faith = faithLit(w, data) ? userOf(w, data, FAITH_LIGHT) : undefined;
  return {
    party: party.map((m) => ({
      character: m.character,
      row: m.row,
      column: m.column,
      frail: m.frail,
      spellsCast: m.spellsCast,
      pointsSpent: m.pointsSpent,
      form: m.form,
      effortDay: m.effortDay,
      artUses: { ...m.artUses },
      committed: m === faith ? 1 : 0,
      pact: pactOf(w, m.id) ?? null,
      poisoned: m.poisoned,
      disease: m.disease?.id ?? null,
      lastStandSpent: m.lastStandDay === w.day,
      ailPenalty: ailPenalty(data, m),
      canBind: m.character.arts.includes(BIND) && !companionOf(w, m),
      waiting: waitingSetup(data, m),
    })),
    npcs: withNpcs
      ? [
          ...w.npcs.filter((n) => n.hp > 0).map((n) => npcSetup(data, n, party)),
          ...riders(w, party).map((m) => ({
            ...npcSetup(data, riddenBy(w, m) as Npc, party),
            rider: party.indexOf(m),
          })),
        ]
      : [],
    mounts: mountSetups(w, data, party, mounts),
    enemies,
    dark: inDark(w, data),
    antiMagic: onSpecial(w, data, 'anti-magic'),
    indoors: w.dungeon !== null,
  };
}

/** A battle from a line-up, carrying in each PC's Frailty and the day's spent spells and Effort. */
export function battleFrom(data: GameData, rng: Rng, setup: PartySetup, log: boolean): Battle {
  const battle = createBattle({
    data,
    rng,
    party: setup.party.map((p) => ({
      character: p.character,
      row: p.row,
      column: p.column,
      form: p.form,
      canBind: p.canBind,
      waiting: p.waiting,
    })),
    npcs: setup.npcs,
    mounts: setup.mounts,
    enemies: setup.enemies.map((r) => [...r]),
    dark: setup.dark,
    antiMagic: setup.antiMagic,
    indoors: setup.indoors,
    log,
  });
  setup.party.forEach((p, i) => {
    const c = battle.combatants[i] as Battle['combatants'][number];
    c.frail = p.frail;
    c.pact = p.pact;
    c.poisoned = p.poisoned;
    c.carries = p.disease;
    c.ailPenalty = p.ailPenalty;
    if (p.lastStandSpent) c.lastStand = false;
    if (c.caster) {
      c.caster.spellsLeft = Math.max(0, c.caster.spellsLeft - p.spellsCast);
      c.caster.pointsLeft = Math.max(0, c.caster.pointsLeft - p.pointsSpent);
      c.caster.effortDay = Math.min(c.caster.effortMax, p.effortDay);
      c.caster.effortUsed = Math.min(c.caster.effortMax, c.caster.effortDay + p.committed);
      c.caster.uses = { ...p.artUses };
    }
  });
  return battle;
}
