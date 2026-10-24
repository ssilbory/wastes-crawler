// World save migrations: each upgrades a save from version n to n + 1 (save.ts loads them).
import type { Migrations, Raw } from '../character/io.ts';
import { NO_LIGHT } from './types.ts';

const crownsOf = (m: Raw) => {
  const crowns = (m.character as Raw | undefined)?.crowns;
  return typeof crowns === 'number' ? crowns : 0;
};

/** Upgrades a world save from version n to n + 1, keyed by n. */
export const WORLD_MIGRATIONS: Migrations = {
  // Version 2 adds towns (Phase 6a): the members' crowns pool into the purse.
  1: (raw) => {
    const members = Array.isArray(raw.members) ? (raw.members as Raw[]) : [];
    return {
      ...raw,
      schemaVersion: 2,
      members: members.map((m) => ({
        ...m,
        pendingXp: 0,
        character: { ...(m.character as Raw), crowns: 0 },
      })),
      benched: [],
      purse: members.reduce((sum, m) => sum + crownsOf(m), 0),
      loot: [],
      towns: {},
      climateDay: raw.day,
    };
  },
  // Version 3 adds NPCs and parley (Phase 6c): no NPCs yet, and a pending encounter keeps its
  // fight-or-not with a matching mood.
  2: (raw) => {
    const e = raw.encounter as Raw | null | undefined;
    const encounter = e && {
      ...e,
      nature: 'hostile',
      reaction: e.hostile ? 'unfriendly' : 'friendly',
      parleyed: false,
      captive: null,
      offer: null,
    };
    return { ...raw, schemaVersion: 3, npcs: [], encounter: encounter ?? null };
  },
  // Version 4 adds coaches and town arenas (Phase 6d).
  3: (raw) => ({ ...raw, schemaVersion: 4, coach: null, arenaDay: null }),
  // Version 5 adds quests (Phase 6): none taken, and any pending encounter is a wandering one.
  4: (raw) => {
    const e = raw.encounter as Raw | null;
    return { ...raw, schemaVersion: 5, quests: {}, encounter: e && { ...e, quest: null } };
  },
  // Version 6 adds dungeons (Phase 7): the party starts on the surface.
  5: (raw) => ({ ...raw, schemaVersion: 6, dungeon: null }),
  // Version 7 adds exploration turns and light (Phase 8a): kits are ready, nothing is lit.
  6: (raw) => {
    const d = raw.dungeon as Raw | null;
    return {
      ...raw,
      schemaVersion: 7,
      dungeon: d && { ...d, turn: 0, steps: 0 },
      light: NO_LIGHT,
    };
  },
  // Version 8 adds secret doors, traps, and special squares (Phase 8b): nothing found yet.
  7: (raw) => {
    const d = raw.dungeon as Raw | null;
    return {
      ...raw,
      schemaVersion: 8,
      dungeon: d && { ...d, found: {}, glimpsed: {}, traps: {}, read: {} },
    };
  },
  // Version 9 adds dungeon quests and rescues (Phase 8c): no one freed yet.
  8: (raw) => ({ ...raw, schemaVersion: 9, rescues: [] }),
  // Version 10 adds raising quests: none offered or taken yet.
  9: (raw) => ({ ...raw, schemaVersion: 10, raising: { offer: null, accepted: null } }),
  // Version 11 adds crafting (Phase 10a): nothing under way, no workshops owned.
  10: (raw) => ({ ...raw, schemaVersion: 11, projects: [], workshops: [] }),
  // Version 12 adds mods (Phase 10b): every project so far builds gear; no components yet.
  11: (raw) => ({
    ...raw,
    schemaVersion: 12,
    projects: Array.isArray(raw.projects)
      ? (raw.projects as Raw[]).map((p) => ({ ...p, kind: 'gear' }))
      : raw.projects,
    components: {},
  }),
  // Version 13 adds craftsmen (Phase 10c): none visited, nothing commissioned.
  12: (raw) => ({ ...raw, schemaVersion: 13, craftsmen: {}, commissions: [] }),
  // Version 14 adds regions (Phase 12): every hex explored so far is in the current one.
  13: (raw) => ({ ...raw, schemaVersion: 14, elsewhere: {} }),
  // Version 15 adds standing orders and raids (Phase 12b): nothing known, ended, or threatened.
  14: (raw) => ({
    ...raw,
    schemaVersion: 15,
    countersigns: [],
    ordersEnded: [],
    authority: [],
    raid: null,
    raided: {},
  }),
  // Version 16 records beaten garrisons (Phase 12c): none yet.
  15: (raw) => ({ ...raw, schemaVersion: 16, beaten: [] }),
  // Version 17 adds the endgame (Phase 12d): the clock at zero, no notes, no ending.
  16: (raw) => ({ ...raw, schemaVersion: 17, clock: 0, notes: {}, ending: null }),
  // Version 18 adds the guide's and physician's daily services: neither used yet.
  17: (raw) => ({ ...raw, schemaVersion: 18, hirelingDays: { food: null, aid: null } }),
  // Version 19 trades hirelings' wages for loot shares (Sam's call): nothing owed yet.
  18: (raw) => ({
    ...raw,
    schemaVersion: 19,
    npcs: Array.isArray(raw.npcs)
      ? (raw.npcs as Raw[]).map((n) => ({ ...n, owed: 0, refund: 0 }))
      : raw.npcs,
    deadShares: [],
    hireBans: {},
  }),
  // Version 20 adds ruins (Phase 12e): none generated, no caches taken.
  19: (raw) => ({ ...raw, schemaVersion: 20, ruins: {}, caches: [] }),
  // Version 21 adds the factions (Phase 13): each starts from its content at the next faction turn.
  20: (raw) => ({ ...raw, schemaVersion: 21, factions: {} }),
  // Version 22 adds corpses for the Necromancer (Phase 14b): none lying anywhere.
  21: (raw) => ({ ...raw, schemaVersion: 22, corpses: null }),
  // Version 23 adds the Healer's Revive the Fallen (Phase 14d): no one fallen, no one reviving.
  22: (raw) => {
    // A malformed list is left for the schema to reject.
    const awake = (list: unknown) =>
      Array.isArray(list) ? (list as Raw[]).map((m) => ({ ...m, reviving: false })) : list;
    return {
      ...raw,
      schemaVersion: 23,
      fallen: null,
      members: awake(raw.members),
      benched: awake(raw.benched),
    };
  },
  // Version 24 counts limited art uses between rests (Phase 15): none used yet.
  23: (raw) => {
    const fresh = (list: unknown) =>
      Array.isArray(list) ? (list as Raw[]).map((m) => ({ ...m, artUses: {} })) : list;
    return { ...raw, schemaVersion: 24, members: fresh(raw.members), benched: fresh(raw.benched) };
  },
  // Version 25 adds the town and encounter skills: no prayers, no show, no monsters named yet.
  24: (raw) => {
    const unprayed = (list: unknown) =>
      Array.isArray(list) ? (list as Raw[]).map((m) => ({ ...m, prayedDay: null })) : list;
    return {
      ...raw,
      schemaVersion: 25,
      members: unprayed(raw.members),
      benched: unprayed(raw.benched),
      performedDay: null,
      bestiary: [],
    };
  },
  // Version 26 adds The Burrower Below: no walls dug yet.
  25: (raw) => {
    const d = raw.dungeon as Raw | null | undefined;
    return { ...raw, schemaVersion: 26, dungeon: d && { ...d, dug: {} } };
  },
  // Version 27 adds tavern rumors: no ways down heard of yet.
  26: (raw) => ({ ...raw, schemaVersion: 27, rumors: [] }),
  // Version 28 adds spells cast outside fights: the corpses are dated for Query the Skull, as
  // fallen today and not yet questioned; no disguise, palanquin, arcane sight, or pact is in force.
  27: (raw) => {
    const c = raw.corpses as Raw | null | undefined;
    const d = raw.dungeon as Raw | null | undefined;
    return {
      ...raw,
      schemaVersion: 28,
      corpses: c && { ...c, day: raw.day, queried: false },
      dungeon: d && { ...d, sight: null, sensed: {} },
      disguise: null,
      palanquin: null,
      pacts: null,
    };
  },
  // Version 29 adds the Invoker's spell points: none spent yet.
  28: (raw) => {
    const fresh = (list: unknown) =>
      Array.isArray(list) ? (list as Raw[]).map((m) => ({ ...m, pointsSpent: 0 })) : list;
    return { ...raw, schemaVersion: 29, members: fresh(raw.members), benched: fresh(raw.benched) };
  },
  // Version 30 adds the Skinshifter's alternate forms: none worn yet.
  29: (raw) => {
    const plain = (list: unknown) =>
      Array.isArray(list) ? (list as Raw[]).map((m) => ({ ...m, form: null })) : list;
    return { ...raw, schemaVersion: 30, members: plain(raw.members), benched: plain(raw.benched) };
  },
  // Version 31 adds the Beastmaster's companion sent away and Feral Toughness's hit points.
  30: (raw) => {
    const plain = (list: unknown) =>
      Array.isArray(list)
        ? (list as Raw[]).map((m) => ({ ...m, companion: null, toughness: 0 }))
        : list;
    return { ...raw, schemaVersion: 31, members: plain(raw.members), benched: plain(raw.benched) };
  },
  // Version 32 adds mounts: none kept yet.
  31: (raw) => ({ ...raw, schemaVersion: 32, mounts: [] }),
  // Version 33 gives Purge Ailment one try per Healer on each Frailty, and adds lingering poison
  // and disease: no one has tried yet, and no one is Poisoned or sick.
  32: (raw) => {
    const untried = (list: unknown) =>
      Array.isArray(list)
        ? (list as Raw[]).map((m) => ({ ...m, purgeTries: [], poisoned: false, disease: null }))
        : list;
    return {
      ...raw,
      schemaVersion: 33,
      members: untried(raw.members),
      benched: untried(raw.benched),
    };
  },
  // Version 34 adds custom overland maps: older worlds are on the campaign's regions.
  33: (raw) => ({ ...raw, schemaVersion: 34, map: null }),
  // Version 35 keeps the party's dungeon maps between visits: none kept yet.
  34: (raw) => ({ ...raw, schemaVersion: 35, charted: {} }),
  // Version 36 adds realms: older worlds are on the campaign or a custom map.
  35: (raw) => ({ ...raw, schemaVersion: 36, realm: null }),
  // Version 37 ships the Sealed Vale as a realm: a world begun on its map plays as the realm.
  36: (raw) =>
    (raw.map as Raw | null)?.id === 'sealed-vale'
      ? { ...raw, schemaVersion: 37, map: null, realm: 'sealed-vale' }
      : { ...raw, schemaVersion: 37 },
  // Version 38 adds trade-route maps: none bought yet.
  37: (raw) => ({ ...raw, schemaVersion: 38, routes: {} }),
  // Version 39 adds the Wastes' warlords: none fallen yet.
  38: (raw) => ({ ...raw, schemaVersion: 39, warlords: [] }),
  // Version 40 adds alchemists: none called on yet, and nothing brewing to order.
  39: (raw) => ({ ...raw, schemaVersion: 40, alchemists: {}, brewOrders: [] }),
  // Version 41 adds countersigns found in pieces (the Warden's): none found yet.
  40: (raw) => ({ ...raw, schemaVersion: 41, pieces: [] }),
  // Version 42 adds realm endings: none reached yet.
  41: (raw) => ({ ...raw, schemaVersion: 42, realmEnd: null }),
  // Version 43 renames the vorpal hare the death hare (Sam's call), wherever a save names it.
  42: (raw) => ({
    ...(JSON.parse(JSON.stringify(raw).replaceAll('"vorpal-hare"', '"death-hare"')) as Raw),
    schemaVersion: 43,
  }),
};
