import { allMonsters } from './monsters.ts';
import type { ContentData, FactionMagic, SrdData } from './schemas/index.ts';

const MAGIC: readonly FactionMagic[] = ['none', 'low', 'medium', 'high'];

/**
 * Factions (Phase 13) stand on map hexes, buy SRD assets from the curated list that their ratings
 * and Magic allow (vendor/wwn-srd/6.0 Factions/Faction Turn Actions.md, Create Asset), start with
 * no more assets of an attribute than its rating, name real rivals, and send patrols of known
 * monsters; the raiding faction exists.
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
  if (!ids.has(content.raidRules.faction))
    errors.push(`raidRules: unknown faction ${content.raidRules.faction}`);
  return errors;
}
