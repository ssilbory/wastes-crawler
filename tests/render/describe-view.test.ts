import { describe, expect, it } from 'vitest';
import { artHint, focusHint, spellHint } from '../../src/render/describe-view.ts';
import { data } from '../game/combat/helpers.ts';

describe('hover descriptions', () => {
  it('give a spell its level, tradition, and text', () => {
    expect(spellHint(data, 'the-wind-of-the-final-repose')).toMatch(
      /^Level 1 High Magic\. The mage designates a visible point/,
    );
    expect(spellHint(data, 'rouse-the-sapling')).toMatch(/^Level 2 Elementalist\. /);
    expect(spellHint(data, 'nope')).toBe('');
  });

  it('give an art its text', () => {
    const art = data.srd.arts[0] as { id: string; text: string };
    expect(artHint(data, art.id)).toBe(art.text);
    expect(artHint(data, 'nope')).toBe('');
  });

  it('give a reworked art the game text in place of the SRD text', () => {
    const text = data.content.traditions.find((t) => t.id === 'healer')?.artText['purge-ailment'];
    expect(text).toMatch(/Frailty/);
    expect(artHint(data, 'purge-ailment')).toBe(text);
  });

  it('give a focus its description and its levels, up to the one held', () => {
    const all = focusHint(data, 'alert');
    expect(all.split('\n')).toHaveLength(3);
    expect(all).toMatch(/\nLevel 1: .*\nLevel 2: /);
    expect(focusHint(data, 'alert', 1).split('\n')).toHaveLength(2);
    expect(focusHint(data, 'nope')).toBe('');
  });
});
