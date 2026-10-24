import backgrounds from '../../data/content/backgrounds.json';
import focusRules from '../../data/content/focus-rules.json';
import peoples from '../../data/content/peoples.json';
import racialFoci from '../../data/content/racial-foci.json';
import equipmentRules from '../../data/content/equipment-rules.json';
import shields from '../../data/content/shields.json';
import startingPackages from '../../data/content/starting-packages.json';
import traditions from '../../data/content/traditions.json';
import classOptions from '../../data/content/class-options.json';
import combatMagic from '../../data/content/combat-magic.json';
import monsterCombat from '../../data/content/monster-combat.json';
import encounterTables from '../../data/content/encounter-tables.json';
import mishaps from '../../data/content/mishaps.json';
import overlandRules from '../../data/content/overland-rules.json';
import regions from '../../data/content/regions.json';
import realms from '../../data/content/realms.json';
import terrains from '../../data/content/terrains.json';
import townRules from '../../data/content/town-rules.json';
import skillRules from '../../data/content/skill-rules.json';
import spellRules from '../../data/content/spell-rules.json';
import magicEffects from '../../data/content/magic-effects.json';
import npcRules from '../../data/content/npc-rules.json';
import mountRules from '../../data/content/mount-rules.json';
import captives from '../../data/content/captives.json';
import coachRoutes from '../../data/content/coach-routes.json';
import coachRules from '../../data/content/coach-rules.json';
import arenaCards from '../../data/content/arena-cards.json';
import missionGivers from '../../data/content/mission-givers.json';
import quests from '../../data/content/quests.json';
import monsters from '../../data/content/monsters.json';
import dungeons from '../../data/content/dungeons.json';
import mapGen from '../../data/content/map-gen.json';
import craftingRules from '../../data/content/crafting-rules.json';
import components from '../../data/content/components.json';
import mods from '../../data/content/mods.json';
import craftsmen from '../../data/content/craftsmen.json';
import alchemy from '../../data/content/alchemy.json';
import scrolls from '../../data/content/scrolls.json';
import devices from '../../data/content/devices.json';
import forging from '../../data/content/forging.json';
import settingsDefaults from '../../data/content/settings-defaults.json';
import soundCues from '../../data/content/sound-cues.json';
import starterParty from '../../data/content/starter-party.json';
import testParty from '../../data/content/test-party.json';
import settingMonsters from '../../data/content/setting-monsters.json';
import standingOrders from '../../data/content/standing-orders.json';
import authorities from '../../data/content/authorities.json';
import raidRules from '../../data/content/raid-rules.json';
import campaign from '../../data/content/campaign.json';
import ruins from '../../data/content/ruins.json';
import groves from '../../data/content/groves.json';
import warlords from '../../data/content/warlords.json';
import hiddenSites from '../../data/content/hidden-sites.json';
import factions from '../../data/content/factions.json';
import ailments from '../../data/content/ailments.json';
import { withSettingMonsters } from './monsters.ts';
import { parseShipped } from './shipped.ts';
import { combatReferenceErrors } from './combat-check.ts';
import { equipmentReferenceErrors } from './equipment-check.ts';
import { factionReferenceErrors } from './faction-check.ts';
import { focusReferenceErrors } from './focus-content.ts';
import { magicReferenceErrors } from './magic-check.ts';
import { magicEffectErrors } from './magic-effects-check.ts';
import { overlandReferenceErrors } from './overland-check.ts';
import { settingReferenceErrors } from './setting-check.ts';
import { townReferenceErrors } from './town-check.ts';
import { npcReferenceErrors } from './npc-check.ts';
import { mountReferenceErrors } from './mount-check.ts';
import { travelReferenceErrors } from './travel-check.ts';
import { questReferenceErrors } from './quest-check.ts';
import { dungeonReferenceErrors } from './dungeon-check.ts';
import { craftingReferenceErrors } from './crafting-check.ts';
import { alchemyReferenceErrors } from './alchemy-check.ts';
import { deviceReferenceErrors } from './device-check.ts';
import { ContentSchemas, type ContentData, type Dungeon, type SrdData } from './schemas/index.ts';
import { gameSkills, skillRuleErrors } from './skills.ts';
import { spellRuleErrors } from './spells.ts';
import { groveReferenceErrors } from './grove-check.ts';
import { ailmentReferenceErrors } from './ailment-check.ts';
import { warlordReferenceErrors } from './warlord-check.ts';

/** Every shipped content file, by its key in ContentData, before parsing. */
export const SHIPPED_CONTENT: Record<keyof ContentData, unknown> = {
  peoples,
  backgrounds,
  racialFoci,
  focusRules,
  shields,
  startingPackages,
  equipmentRules,
  traditions,
  classOptions,
  monsterCombat,
  combatMagic,
  terrains,
  regions,
  realms,
  encounterTables,
  mishaps,
  overlandRules,
  townRules,
  skillRules,
  spellRules,
  magicEffects,
  npcRules,
  mountRules,
  captives,
  coachRoutes,
  coachRules,
  arenaCards,
  missionGivers,
  quests,
  monsters,
  dungeons,
  mapGen,
  craftingRules,
  components,
  mods,
  craftsmen,
  alchemy,
  scrolls,
  devices,
  forging,
  settingsDefaults,
  soundCues,
  starterParty,
  testParty,
  settingMonsters,
  standingOrders,
  authorities,
  raidRules,
  campaign,
  ruins,
  groves,
  warlords,
  hiddenSites,
  factions,
  ailments,
};

/** Parses every data/content file with its schema (see parseShipped); throws on the first invalid one. */
export function loadContent(): ContentData {
  const out = {} as Record<keyof ContentData, unknown>;
  for (const name of Object.keys(ContentSchemas) as (keyof ContentData)[]) {
    out[name] = parseShipped(ContentSchemas[name], SHIPPED_CONTENT[name]);
  }
  return withSettingMonsters(out as ContentData);
}

/**
 * The part of contentReferenceErrors that reads dungeons. Everything else it checks is the same
 * whichever dungeons are in, so swapping a dungeon can only change these: comparing them is what
 * comparing the whole check would give, at a fraction of its cost (src/game/editor/playable.ts).
 * With `changed`, only that dungeon's own levels are checked, the slow part: the others' levels
 * come out as they did before it was swapped in. Keep this list in step with the checks that read
 * content.dungeons.
 */
export function dungeonContentErrors(
  srd: SrdData,
  content: ContentData,
  changed?: Dungeon,
): string[] {
  const lists: [string, { id: string }[]][] = [
    ['dungeons', content.dungeons],
    ...content.dungeons.map((d): [string, { id: string }[]] => [
      `dungeons/${d.id} levels`,
      d.levels,
    ]),
  ];
  return [
    ...lists.flatMap(([name, list]) => duplicateIds(name, list)),
    ...npcReferenceErrors(srd, content),
    ...questReferenceErrors(srd, content),
    ...dungeonReferenceErrors(content, changed && [changed]),
    ...settingReferenceErrors(srd, content),
    ...ailmentReferenceErrors(srd, content),
    ...warlordReferenceErrors(content),
  ];
}

const duplicateIds = (name: string, list: { id: string }[]): string[] => {
  const ids = list.map((r) => r.id);
  return [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))].map(
    (id) => `${name}: duplicate id ${id}`,
  );
};

/** Authored content may only reference SRD records that exist. */
export function contentReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const skills = new Set(gameSkills(srd, content).map((s) => s.id));
  const errors: string[] = [];
  const check = (where: string, skill: string) => {
    if (!skills.has(skill)) errors.push(`${where}: unknown skill ${skill}`);
  };
  for (const b of content.backgrounds) {
    check(`backgrounds/${b.id} free skill`, b.freeSkill);
    b.growth.forEach(
      (e, i) => e.kind === 'skill' && check(`backgrounds/${b.id} growth ${i + 1}`, e.skill),
    );
    b.learning.forEach(
      (e, i) => e.kind === 'skill' && check(`backgrounds/${b.id} learning ${i + 1}`, e.skill),
    );
  }
  const peoples = new Set(content.peoples.map((p) => p.id));
  for (const b of content.backgrounds) {
    for (const p of b.peoples ?? []) {
      if (!peoples.has(p)) errors.push(`backgrounds/${b.id}: unknown people ${p}`);
    }
  }
  for (const p of content.peoples) {
    if (!content.backgrounds.some((b) => !b.peoples || b.peoples.includes(p.id))) {
      errors.push(`peoples/${p.id}: no background is open to it`);
    }
  }
  const idLists: [string, { id: string }[]][] = [
    ['peoples', content.peoples],
    ['backgrounds', content.backgrounds],
    ['racialFoci', content.racialFoci],
    ['focusRules', content.focusRules],
    ['shields', content.shields],
    ['startingPackages', content.startingPackages],
    ['traditions', content.traditions],
    ['classOptions', content.classOptions],
    ['monsterCombat', content.monsterCombat],
    ['combatMagic', content.combatMagic],
    ['terrains', content.terrains],
    ['regions', content.regions],
    ['realms', content.realms],
    ['encounterTables', content.encounterTables],
    ['mishaps', content.mishaps],
    ['hirelings', content.npcRules.hirelings],
    ['mounts', content.mountRules.mounts],
    ['captives', content.captives],
    ['coachRoutes', content.coachRoutes],
    ['missionGivers', content.missionGivers],
    ['quests', content.quests],
    ['dungeons', content.dungeons],
    ['components', content.components],
    ['mods', content.mods],
    ['craftsmen', content.craftsmen],
    ['alchemy/potions', content.alchemy.potions],
    ['alchemy/alchemists', content.alchemy.alchemists],
    ['devices', content.devices.devices],
    ['forging/abilities', content.forging.abilities],
    ['forging/flaws', content.forging.flaws],
    ['settingMonsters', content.settingMonsters],
    ['standingOrders', content.standingOrders],
    ['authorities', content.authorities],
    ['groves', content.groves],
    ...content.dungeons.map((d): [string, { id: string }[]] => [
      `dungeons/${d.id} levels`,
      d.levels,
    ]),
    ...content.arenaCards.map((a): [string, { id: string }[]] => [`arenaCards/${a.town}`, a.bouts]),
    ...content.peoples.map((p): [string, { id: string }[]] => [
      `peoples/${p.id} lineages`,
      p.lineages ?? [],
    ]),
  ];
  for (const [name, list] of idLists) errors.push(...duplicateIds(name, list));
  return [
    ...errors,
    ...skillRuleErrors(srd, content),
    ...spellRuleErrors(srd, content),
    ...focusReferenceErrors(srd, content),
    ...equipmentReferenceErrors(srd, content),
    ...magicReferenceErrors(srd, content),
    ...magicEffectErrors(srd, content),
    ...combatReferenceErrors(srd, content),
    ...factionReferenceErrors(srd, content),
    ...overlandReferenceErrors(srd, content),
    ...townReferenceErrors(content),
    ...npcReferenceErrors(srd, content),
    ...mountReferenceErrors(srd, content),
    ...travelReferenceErrors(srd, content),
    ...questReferenceErrors(srd, content),
    ...dungeonReferenceErrors(content),
    ...craftingReferenceErrors(srd, content),
    ...alchemyReferenceErrors(srd, content),
    ...deviceReferenceErrors(srd, content),
    ...settingReferenceErrors(srd, content),
    ...groveReferenceErrors(srd, content),
    ...ailmentReferenceErrors(srd, content),
    ...warlordReferenceErrors(content),
  ];
}
