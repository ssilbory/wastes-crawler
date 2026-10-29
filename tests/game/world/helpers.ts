import type { PendingEncounter } from '../../../src/data/schemas/index.ts';
import type { GameData } from '../../../src/game/character/context.ts';
import { newWorld } from '../../../src/game/world/new-world.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, starter } from '../combat/helpers.ts';

export { data, starter };

/** The four starters in Rubblegate: Snag and Grukk in front, Lirael and Fizzwick behind. */
export function world(faces?: number[], d: GameData = data): World {
  const party = (['snag', 'grukk', 'lirael', 'fizzwick'] as const).map((n, i) => ({
    character: starter(n),
    row: i < 2 ? 0 : 1,
    column: i % 2,
    defaultAction: 'auto' as const,
  }));
  const w = newWorld(d, createRng('world'), party);
  if (faces) w.rng = scriptedRng(faces);
  return w;
}

export function member(w: World, name: string): Member {
  const m = w.members.find((x) => x.character.name === name);
  if (!m) throw new Error(`no member ${name}`);
  return m;
}

/** Content whose shops stock every item and never sell out (shop-stock.ts). */
export const fullShop: GameData = {
  ...data,
  content: {
    ...data.content,
    townRules: {
      ...data.content.townRules,
      shop: {
        ...data.content.townRules.shop,
        stocked: { village: 1, town: 1, city: 1 },
        sellOutPercent: { village: 0, town: 0, city: 0 },
      },
    },
  },
};

/** Content with a single mishap of the given effect, for both tables. */
export function withMishap(effect: GameData['content']['mishaps'][number]['effect']): GameData {
  const mishaps = (['travel', 'camp'] as const).map((table) => ({
    id: `only-${table}`,
    table,
    weight: 1,
    text: `A ${table} mishap.`,
    effect,
  }));
  return { ...data, content: { ...data.content, mishaps } };
}

/** A pending encounter that means to fight, unspotted and not yet parleyed. */
export function encounter(
  enemies: string[][],
  over: Partial<PendingEncounter> = {},
): PendingEncounter {
  return {
    enemies,
    nature: 'hostile',
    reaction: 'expected',
    parleyed: false,
    captive: null,
    offer: null,
    quest: null,
    hostile: true,
    spotted: false,
    text: '',
    ...over,
  };
}
