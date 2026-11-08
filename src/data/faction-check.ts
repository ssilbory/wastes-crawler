import { allMonsters } from './monsters.ts';
import type { ContentData, FactionMagic, SrdData } from './schemas/index.ts';

const MAGIC: readonly FactionMagic[] = ['none', 'low', 'medium', 'high'];

/**
 * Factions (Phase 13) stand on map hexes, buy SRD assets from the curated list that their ratings
 * and Magic allow (vendor/wwn-srd/6.0 Factions/Faction Turn Actions.md, Create Asset), start with
 * no more assets of an attribute than its rating, name real rivals, and send patrols of known
 * monsters; the sieges' ally exists, and each realm's factions keep to the realm.
 */
export function factionReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const { locations, assets, factions } = content.factions;
  const places = new Set<string>();
  for (const l of locations) {
    if (places.has(l.id)) errors.push(`factions: duplicate location ${l.id}`);
    places.add(l.id);
    const region = content.regions.find((r) => r.id === l.region);
    if (!region) errors.push(`factions/${l.id}: unknown region ${l.region}`);
    else if (region.terrain[l.row]?.[l.col] === undefined)
      errors.push(`factions/${l.id}: off the map`);
  }
  const curated = new Set<string>();
  for (const a of assets) {
    if (curated.has(a.asset)) errors.push(`factions: duplicate asset ${a.asset}`);
    curated.add(a.asset);
    if (!srd['faction-assets'].some((x) => x.id === a.asset))
      errors.push(`factions: unknown asset ${a.asset}`);
  }
  const ids = new Set(factions.map((f) => f.id));
  const monsters = new Set(allMonsters(srd, content).map((m) => m.id));
  if (ids.size !== factions.length) errors.push('factions: duplicate faction');
  for (const f of factions) {
    const where = `factions/${f.id}`;
    for (const at of [f.hq, ...f.bases.map((b) => b.at), ...f.assets.map((a) => a.at)])
      if (!places.has(at)) errors.push(`${where}: unknown location ${at}`);
    if (f.bases.some((b) => b.at === f.hq)) errors.push(`${where}: a second base at its HQ`);
    for (const id of new Set([...f.buys, ...f.assets.map((a) => a.asset)])) {
      const asset = srd['faction-assets'].find((x) => x.id === id);
      if (!asset || !curated.has(id)) errors.push(`${where}: asset ${id} is not on the list`);
      else if (asset.rating > f[asset.attribute])
        errors.push(`${where}: ${id} needs ${asset.attribute} ${asset.rating}`);
      else if (MAGIC.indexOf(asset.magic) > MAGIC.indexOf(f.magic))
        errors.push(`${where}: ${id} needs ${asset.magic} magic`);
    }
    for (const attribute of ['force', 'cunning', 'wealth'] as const) {
      const held = f.assets.filter(
        (a) => srd['faction-assets'].find((x) => x.id === a.asset)?.attribute === attribute,
      ).length;
      if (held > f[attribute]) errors.push(`${where}: more ${attribute} assets than its rating`);
    }
    for (const e of f.enemies)
      if (e === f.id || !ids.has(e)) errors.push(`${where}: bad rival ${e}`);
    if (new Set(f.raise).size !== 3) errors.push(`${where}: raise must list each attribute once`);
    for (const id of Object.keys(f.names))
      if (!curated.has(id)) errors.push(`${where}: a name for unknown asset ${id}`);
    for (const p of f.patrols) {
      if (!curated.has(p.asset)) errors.push(`${where}: a patrol for unknown asset ${p.asset}`);
      for (const id of new Set(p.enemies.flat()))
        if (!monsters.has(id)) errors.push(`${where}: patrol of unknown monster ${id}`);
    }
  }
  if (!ids.has(content.siegeRules.ally))
    errors.push(`siegeRules: unknown ally ${content.siegeRules.ally}`);
  errors.push(...realmFactionErrors(content));
  for (const id of content.siegeRules.ignoreWalls)
    if (!curated.has(id)) errors.push(`siegeRules: unknown asset ${id}`);
  return errors;
}

/**
 * A realm's factions (Sam's call: the Wastes' factions) stand on its own maps and name only each
 * other as rivals; its ally is one of them; each warlord's faction is the realm's and keeps its
 * headquarters on the warlord's map.
 */
function realmFactionErrors(content: ContentData): string[] {
  const errors: string[] = [];
  const { locations, factions } = content.factions;
  const realmOf = new Map(factions.map((f) => [f.id, f.realm ?? null]));
  const regionOf = (at: string) => locations.find((l) => l.id === at)?.region;
  for (const f of factions) {
    const where = `factions/${f.id}`;
    const realm = f.realm === undefined ? null : content.realms.find((r) => r.id === f.realm);
    if (realm === undefined) errors.push(`${where}: unknown realm ${f.realm}`);
    for (const e of f.enemies)
      if (realmOf.has(e) && realmOf.get(e) !== (f.realm ?? null))
        errors.push(`${where}: rival ${e} is in another world`);
    if (!realm) continue;
    for (const at of [f.hq, ...f.bases.map((b) => b.at), ...f.assets.map((a) => a.at)]) {
      const region = regionOf(at);
      if (region && !realm.regions.includes(region))
        errors.push(`${where}: ${at} is outside ${realm.id}`);
    }
  }
  for (const r of content.realms) {
    if (r.ally && realmOf.get(r.ally) !== r.id)
      errors.push(`realms/${r.id}: ally ${r.ally} is not one of its factions`);
    if (r.heldShut && !r.ally) errors.push(`realms/${r.id}: shuts held settlements with no ally`);
  }
  for (const l of content.warlords.warlords) {
    if (!l.faction) continue;
    const f = factions.find((x) => x.id === l.faction);
    const realm = content.realms.find((r) => r.regions.includes(l.region));
    if (!f) errors.push(`warlords/${l.id}: unknown faction ${l.faction}`);
    else if ((f.realm ?? null) !== (realm?.id ?? null) || regionOf(f.hq) !== l.region)
      errors.push(`warlords/${l.id}: faction ${f.id} is not headquartered on ${l.region}`);
  }
  return errors;
}
