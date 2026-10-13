import { describe, expect, it } from 'vitest';
import { resolveAttack } from '../../src/game/combat/attack.ts';
import { flash, floats, MAX_FLOATS, turnOrder } from '../../src/render/fight-fx.ts';
import type { Attack } from '../../src/game/combat/types.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';
import { standardBattle, who } from '../game/combat/helpers.ts';

const hpOf = (b: ReturnType<typeof standardBattle>) =>
  new Map(b.combatants.map((c) => [c.id, c.hp]));

describe('turn order (docs/presentation-plan.md, V3)', () => {
  it('lists the turns left this round, skipping anyone who can’t act', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia']]);
    b.queue = ['pc-0', 'foe-0-0', 'pc-1', 'foe-0-1', 'nobody'];
    who(b, 'foe-0-1').status = 'dead';
    expect(turnOrder(b, 'pc-0')).toEqual([
      { id: 'pc-0', label: 'Snag', side: 'party', now: true },
      { id: 'foe-0-0', label: 'Thug or Militia [1-1]', side: 'enemy', now: false },
      { id: 'pc-1', label: 'Grukk', side: 'party', now: false },
    ]);
    expect(turnOrder(b, null).some((t) => t.now)).toBe(false);
  });
});

describe('floating numbers', () => {
  it('floats each blow over its target', () => {
    const b = standardBattle([['thug-or-militia']]);
    const [snag, thug] = [who(b, 'Snag'), who(b, 'foe-0-0')];
    thug.hp = 20;
    const from = b.events?.length ?? 0;
    const hp = hpOf(b);
    b.rng = scriptedRng([15, 4, 2, 1]);
    resolveAttack(b, snag, snag.attacks[0] as Attack, thug);
    resolveAttack(b, snag, snag.attacks[0] as Attack, thug);
    resolveAttack(b, snag, snag.attacks[1] as Attack, thug);
    const out = floats(b, from, hp);
    expect(out.get(thug.id)).toEqual([
      { text: '-7', kind: 'hit' },
      { text: '-5 Shock', kind: 'shock' },
      { text: 'miss', kind: 'miss' },
    ]);
    expect(out.has(snag.id)).toBe(false);
    // A shield turns the thug's Shock aside.
    snag.ac = 12;
    b.rng = scriptedRng([1]);
    resolveAttack(b, thug, thug.attacks[0] as Attack, snag);
    expect(floats(b, from, hp).get(snag.id)).toEqual([{ text: 'turned', kind: 'turned' }]);
  });

  it('floats a change in HP that no blow explains, harm or healing', () => {
    const b = standardBattle([['thug-or-militia']]);
    const hp = hpOf(b);
    who(b, 'foe-0-0').hp -= 3;
    who(b, 'Snag').hp += 2;
    const out = floats(b, 0, hp);
    expect(out.get('foe-0-0')).toEqual([{ text: '-3', kind: 'harm' }]);
    expect(out.get('pc-0')).toEqual([{ text: '+2', kind: 'heal' }]);
    // Someone who joined mid-batch has no HP to compare with.
    expect(floats(b, 0, new Map()).size).toBe(0);
  });

  it('keeps only the latest few per slot, and none without events', () => {
    const b = standardBattle([['thug-or-militia']]);
    b.events = Array.from({ length: 6 }, (_, i) => ({
      kind: 'hit' as const,
      actor: 'pc-0',
      target: 'foe-0-0',
      amount: i + 1,
    }));
    const list = floats(b, 0, hpOf(b)).get('foe-0-0');
    expect(list).toHaveLength(MAX_FLOATS);
    expect(list?.at(-1)?.text).toBe('-6');
    b.events = null;
    expect(floats(b, 0, hpOf(b)).size).toBe(0);
  });

  it('flashes struck over healed over missed', () => {
    expect(flash(undefined)).toBeNull();
    expect(flash([])).toBeNull();
    expect(flash([{ text: 'miss', kind: 'miss' }])).toBe('missed');
    expect(flash([{ text: 'turned', kind: 'turned' }])).toBe('missed');
    expect(
      flash([
        { text: '+2', kind: 'heal' },
        { text: 'miss', kind: 'miss' },
      ]),
    ).toBe('healed');
    for (const kind of ['hit', 'shock', 'harm'] as const)
      expect(
        flash([
          { text: '+2', kind: 'heal' },
          { text: '-1', kind },
        ]),
      ).toBe('struck');
  });
});
