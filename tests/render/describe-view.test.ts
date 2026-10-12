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

  it('end a spell with its in-game effect line', () => {
    const line = data.content.magicEffects.spells['the-wind-of-the-final-repose'];
    expect(line).toBeTruthy();
    expect(spellHint(data, 'the-wind-of-the-final-repose').endsWith(`.\nIn game: ${line}`)).toBe(
      true,
    );
  });

  it('give an art its text and its in-game effect line', () => {
    const art = data.srd.arts.find((a) => a.id === 'counter-magic') as { text: string };
    const line = data.content.magicEffects.arts['counter-magic'];
    expect(artHint(data, 'counter-magic')).toBe(`${art.text}\nIn game: ${line}`);
    expect(artHint(data, 'nope')).toBe('');
  });

  it('give an art the game leaves out its text alone', () => {
    const art = data.srd.arts.find((a) => a.id === 'arcane-lexicon') as { text: string };
    expect(artHint(data, 'arcane-lexicon')).toBe(art.text);
  });

  it('give a reworked art the game text in place of the SRD text', () => {
    const text = data.content.traditions.find((t) => t.id === 'healer')?.artText['purge-ailment'];
    const line = data.content.magicEffects.arts['purge-ailment'];
    expect(text).toMatch(/Frailty/);
    expect(artHint(data, 'purge-ailment')).toBe(`${text}\nIn game: ${line}`);
  });

  it('give a focus its description and its levels, up to the one held', () => {
    const all = focusHint(data, 'alert');
    expect(all.split('\n')).toHaveLength(3);
    expect(all).toMatch(/\nLevel 1: .*\nLevel 2: /);
    expect(focusHint(data, 'alert', 1).split('\n')).toHaveLength(2);
    expect(focusHint(data, 'nope')).toBe('');
  });
});
