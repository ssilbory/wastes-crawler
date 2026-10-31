// What the party's High Mages can cast outside fights from the High Magic panel, and the spells
// already in force, as data for the panel. Pure.
import { ARCANE_FORM } from '../game/dungeon/arcane-sight.ts';
import { arcaneSeer } from '../game/dungeon/light.ts';
import { gateTargets, LITHIC, PALLID_GATE } from '../game/dungeon/stonework.ts';
import type { GameData } from '../game/character/context.ts';
import { disguised, palanquinUp, PALANQUIN, VISAGE } from '../game/world/guises.ts';
import { spellReady } from '../game/world/casting.ts';
import { castersOf } from '../game/world/waygates.ts';
import type { World } from '../game/world/types.ts';
import { cellKey, type Cell } from '../rules/grid.ts';
import { levelOf } from '../game/dungeon/levels.ts';

export interface GateChoice {
  key: string;
  at: Cell;
  label: string;
}

export interface SorceryCaster {
  id: string;
  name: string;
  visage: boolean;
  palanquin: boolean;
  sight: boolean;
  dissolve: boolean;
  gates: GateChoice[];
}

export interface SorceryView {
  /** Spells in force, as sentences. */
  status: string[];
  casters: SorceryCaster[];
}

const SPELLS = [VISAGE, PALANQUIN, ARCANE_FORM, LITHIC, PALLID_GATE];

function gates(w: World, data: GameData): GateChoice[] {
  const s = w.dungeon;
  if (!s) return [];
  const { level } = levelOf(data, s.dungeon, s.level);
  return gateTargets(w, data).map((at) => {
    const link = level.links.find((l) => cellKey(l.at) === cellKey(at));
    const what = !link
      ? 'the safe square'
      : 'surface' in link.to
        ? 'the way out'
        : `the stairs to ${levelOf(data, s.dungeon, link.to.level).level.name}`;
    return { key: cellKey(at), at, label: `${what} (${cellKey(at)})` };
  });
}

/** The High Magic panel's contents, or null when there is nothing to show. */
export function sorceryView(w: World, data: GameData): SorceryView | null {
  const status = [
    ...(disguised(w) ? ['The party wears the seeming of the bound until dawn.'] : []),
    ...(palanquinUp(w) ? ["A jade palanquin carries the party's packs."] : []),
    ...(arcaneSeer(w) ? ['Arcane sight lights the dark.'] : []),
  ];
  const below = w.dungeon !== null;
  const open = gates(w, data);
  const casters = w.encounter
    ? []
    : SPELLS.flatMap((spell) => castersOf(w, spell))
        .filter((m, i, all) => all.indexOf(m) === i)
        .map((m) => {
          const has = (spell: string) => spellReady(m, spell);
          return {
            id: m.id,
            name: m.character.name,
            visage: has(VISAGE),
            palanquin: has(PALANQUIN) && !below && !palanquinUp(w),
            sight: has(ARCANE_FORM) && below,
            dissolve: has(LITHIC) && below,
            gates: has(PALLID_GATE) ? open : [],
          };
        })
        .filter((c) => c.visage || c.palanquin || c.sight || c.dissolve || c.gates.length > 0);
  return status.length > 0 || casters.length > 0 ? { status, casters } : null;
}
