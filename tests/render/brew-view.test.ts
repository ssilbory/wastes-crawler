import { describe, expect, it } from 'vitest';
import { brewText } from '../../src/render/brew-view.ts';
import { data } from '../game/combat/helpers.ts';

describe('brewText', () => {
  it("gives a potion's own text", () => {
    expect(brewText(data, 'healing-draught')).toContain('2d6 hit points and 1 System Strain');
  });

  it("gives the recipe's text for gear that is not a potion", () => {
    expect(brewText(data, 'antidote')).toContain('neutralizes a lingering poison');
  });

  it('describes every recipe', () => {
    for (const r of data.content.alchemy.recipes) expect(brewText(data, r.item)).not.toBe('');
  });

  it('is empty for gear with nothing written for it', () => {
    const alchemy = data.content.alchemy;
    const bare = {
      ...data,
      content: {
        ...data.content,
        alchemy: {
          ...alchemy,
          recipes: alchemy.recipes.map((r) => ({ ...r, text: undefined })),
        },
      },
    };
    expect(brewText(bare, 'antidote')).toBe('');
    expect(brewText(bare, 'healing-draught')).not.toBe('');
  });

  it('is empty for an item that cannot be brewed', () => {
    expect(brewText(data, 'no-such-item')).toBe('');
  });
});
