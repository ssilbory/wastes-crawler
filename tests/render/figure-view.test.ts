import { describe, expect, it } from 'vitest';
import type { Character } from '../../src/data/schemas/index.ts';
import type { Attack } from '../../src/game/combat/types.ts';
import { ARMORED_AC, figureOf, monsterFigureOf } from '../../src/render/figure-view.ts';
import { sideView } from '../../src/render/arena-view.ts';
import { data, standardBattle, who } from '../game/combat/helpers.ts';

describe('figures (docs/presentation-plan.md, V3)', () => {
  it('puts a character together from its people, armor, weapon, and shield', () => {
    const b = standardBattle([['thug-or-militia']]);
    // Snag, a goblin with a spear and shield; Grukk, an orc in armor with a war axe.
    expect(figureOf(data, who(b, 'Snag'))).toEqual({
      kind: 'person',
      body: 'small',
      head: 'ears',
      garb: 'armor',
      held: 'spear',
      shield: true,
    });
    expect(figureOf(data, who(b, 'Grukk'))).toMatchObject({ head: 'tusks', held: 'axe' });
    // Fizzwick, a gnome mage with no armor, wears a robe; Lirael, an elf in light armor, a cloak.
    expect(figureOf(data, who(b, 'Fizzwick'))).toMatchObject({
      body: 'small',
      head: 'beard',
      garb: 'robe',
      held: 'staff',
    });
    expect(figureOf(data, who(b, 'Lirael'))).toMatchObject({ garb: 'cloak', held: 'bow' });
  });

  it('reads armor by its AC, and an unknown weapon or none as a bare hand', () => {
    const b = standardBattle([['thug-or-militia']]);
    const lirael = who(b, 'Lirael');
    lirael.acInput = { armorAc: ARMORED_AC, dexModifier: 0 };
    expect(figureOf(data, lirael)).toMatchObject({ garb: 'armor' });
    lirael.acInput = null;
    lirael.attacks = [{ ...(lirael.attacks[0] as Attack), id: 'tail' }];
    expect(figureOf(data, lirael)).toMatchObject({ garb: 'cloak', held: 'fist' });
    lirael.attacks = [];
    expect(figureOf(data, lirael)).toMatchObject({ held: 'fist' });
  });

  it('draws someone with no sheet, or of an unknown people, plainly', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    expect(figureOf(data, { ...snag, character: null })).toMatchObject({
      body: 'standard',
      head: 'plain',
    });
  });

  it('shows a Skinshifter in a beast’s form as a beast, and in a humanoid one as themselves', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    const forms = [
      { name: 'Wolf', humanoid: false, arts: [] },
      { name: 'Warform', humanoid: true, arts: [] },
    ];
    snag.character = { ...(snag.character as Character), forms };
    expect(figureOf(data, { ...snag, form: 0 })).toEqual({
      kind: 'monster',
      shape: 'beast',
      large: false,
    });
    expect(figureOf(data, { ...snag, form: 1 })).toMatchObject({ kind: 'person' });
  });

  it('draws a monster as its combat entry says, large ones large', () => {
    const b = standardBattle([['thug-or-militia', 'hill-giant']]);
    expect(figureOf(data, who(b, 'foe-0-0'))).toEqual({
      kind: 'monster',
      shape: 'soldier',
      large: false,
    });
    expect(figureOf(data, who(b, 'foe-0-1'))).toEqual({
      kind: 'monster',
      shape: 'giant',
      large: true,
    });
  });

  it('splits the animals by kind, and a setting monster takes its own figure over its base’s', () => {
    const shape = (id: string) => (monsterFigureOf(data, id) as { shape: string }).shape;
    // V7 (Sam's ask): the shared beast figures split by kind.
    expect(shape('dire-wolf')).toBe('beast');
    expect(shape('barrow-rat')).toBe('vermin');
    expect(shape('saber-toothed-tiger')).toBe('big-cat');
    expect(shape('crag-stalker')).toBe('big-cat');
    expect(shape('war-boar')).toBe('boar');
    expect(shape('ruinfield-grazer')).toBe('tusker');
    expect(shape('unicorn')).toBe('unicorn');
    expect(shape('giant-turtle')).toBe('shelled');
    expect(shape('cave-bear')).toBe('great-beast');
    // Its base is a boar, a warbeast, and a large predator; each looks nothing like it.
    expect(shape('sand-drake')).toBe('lizard');
    expect(shape('bone-crawler')).toBe('crawler');
    expect(shape('sand-burrower')).toBe('shelled');
    // Still drawn large if its base is.
    expect(monsterFigureOf(data, 'sand-drake')).toMatchObject({ large: true });
  });

  it('falls back to the tags for a monster with no entry, and finds a summons by its stat line', () => {
    const b = standardBattle([['thug-or-militia']]);
    const thug = who(b, 'foe-0-0');
    expect(figureOf(data, { ...thug, monster: 'nobody' })).toMatchObject({ shape: 'soldier' });
    expect(figureOf(data, { ...thug, monster: null, tags: new Set() })).toMatchObject({
      shape: 'beast',
    });
    expect(
      figureOf(data, {
        ...thug,
        monster: null,
        summoned: { by: 'pc-3', monster: 'phantasmal-eidolon' },
      }),
    ).toMatchObject({ shape: 'spirit' });
  });

  it('gives every slot on the field its figure', () => {
    const b = standardBattle([['thug-or-militia']]);
    const party = sideView(b, 'party')
      .rows.flat()
      .filter((s) => s !== null);
    expect(party.every((s) => s.figure?.kind === 'person')).toBe(true);
    expect(sideView(b, 'enemy').rows[0]?.[0]?.figure).toMatchObject({ shape: 'soldier' });
  });
});
