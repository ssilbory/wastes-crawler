import { regionMap } from '../../../src/game/world/region.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import type { Hex } from '../../../src/rules/hex.ts';
import { beastmaster } from '../beastmaster.ts';
import { data, member } from './helpers.ts';

/** A wild hex of the start region whose table holds a wild aurochs (a 2 HD herd beast). */
export function herdHex(w: World): Hex {
  const map = regionMap(data, w.region);
  for (let row = 0; row < map.height; row++)
    for (let col = 0; col < map.width; col++) {
      const h = { col, row };
      const table = data.content.encounterTables.find((t) => t.id === map.tableAt(h));
      const herd = table?.entries.some((e) => e.groups.some((g) => g.monster === 'wild-aurochs'));
      if (herd && !map.siteAt(h)) return h;
    }
  throw new Error('no hex with herd beasts');
}

/** Snag as a Ranger in the wilds, by a herd of beasts. */
export function ranger(w: World, arts: string[] = [], level = 3): Member {
  const m = member(w, 'Snag');
  m.character = { ...beastmaster(arts, level), id: m.character.id, hp: { max: 20, current: 20 } };
  w.position = herdHex(w);
  return m;
}
