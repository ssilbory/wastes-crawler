import { describe, expect, it } from 'vitest';
import { bindCompanion, sendAway } from '../../src/game/world/companions.ts';
import { regionMap } from '../../src/game/world/region.ts';
import type { World } from '../../src/game/world/types.ts';
import { companionsView } from '../../src/render/companions-view.ts';
import { beastmaster } from '../game/beastmaster.ts';
import { data, member, world } from '../game/world/helpers.ts';

/** Snag as a Ranger with Swift Healing, out by a herd of beasts. */
function wilds(): World {
  const w = world();
  const m = member(w, 'Snag');
  m.character = { ...beastmaster(['swift-healing']), id: m.character.id };
  const map = regionMap(data, w.region);
  for (let row = 0; row < map.height; row++)
    for (let col = 0; col < map.width; col++) {
      const table = data.content.encounterTables.find((t) => t.id === map.tableAt({ col, row }));
      if (
        !map.siteAt({ col, row }) &&
        table?.entries.some((e) => e.groups.some((g) => g.monster === 'wild-aurochs'))
      ) {
        w.position = { col, row };
        return w;
      }
    }
  throw new Error('no herd beasts');
}

describe('the companions panel view (1.5.4)', () => {
  it('lists only Beastmasters, with the beasts they could bind', () => {
    const w = wilds();
    const views = companionsView(w, data);
    expect(views.map((v) => v.name)).toEqual(['Snag']);
    expect(views[0]).toMatchObject({ companion: null, bindBlocked: null, canHeal: false });
    expect(views[0]?.beasts).toContainEqual({
      id: 'wild-aurochs',
      name: 'Wild Aurochs',
      hitDice: 2,
    });
  });

  it('shows where the companion is, and whether it can be tended', () => {
    const w = wilds();
    const id = member(w, 'Snag').id;
    bindCompanion(w, data, id, 'wild-aurochs', 'Bramble');
    w.encounter = null;
    const here = companionsView(w, data)[0];
    expect(here?.companion).toMatchObject({
      name: 'Bramble',
      kind: 'Wild Aurochs',
      where: 'party',
    });
    expect(here?.bindBlocked).toBe('Snag already has a companion; release it first.');
    const n = w.npcs[0];
    if (n) n.hp = 1;
    expect(companionsView(w, data)[0]?.canHeal).toBe(n !== undefined && n.maxHp > 1);
    sendAway(w, id);
    expect(companionsView(w, data)[0]?.companion?.where).toBe('away');
    const m = member(w, 'Snag');
    if (m.companion) m.companion.hp = 0;
    expect(companionsView(w, data)[0]?.companion?.where).toBe('dawn');
  });
});
