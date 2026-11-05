import { describe, expect, it } from 'vitest';
import { effectText, serviceText } from '../../src/render/project-effect-text.ts';
import { data } from '../game/world/helpers.ts';

describe('project effects in words (docs/rules-adaptation.md, Major projects: Project kinds)', () => {
  it('says what each kind of effect does', () => {
    expect(effectText(data, { kind: 'raid-warning', at: 'lanternfall', days: 14 })).toBe(
      'A raid on Lanternfall is known 14 days ahead.',
    );
    expect(effectText(data, { kind: 'road', route: 'ash-road', ambushDie: 8, fareCut: 5 })).toBe(
      'The coach between Cinderhold and Gutterwick is ambushed only 1 time in 8, and costs 5 crowns less.',
    );
    expect(
      effectText(data, {
        kind: 'coach',
        towns: ['saltwick', 'thornwatch'],
        fare: 10,
        ambushDie: 6,
      }),
    ).toBe('A coach runs between Saltwick and Thornwatch, 10 crowns a passenger.');
    expect(
      effectText(data, {
        kind: 'tithe',
        region: 'dark-lands',
        faction: 'warhost',
        sellPercent: 20,
        patrolPercent: 50,
      }),
    ).toBe(
      "Villages in The Dark Lands pay 20% more for gear and loot, and Grisk's Warhost patrol 50% as often.",
    );
    expect(
      effectText(data, {
        kind: 'tithe',
        region: 'pale-reach',
        sellPercent: 20,
        patrolPercent: 100,
      }),
    ).toBe('Villages in The Pale Reach pay 20% more for gear and loot.');
    expect(effectText(data, { kind: 'forage', at: 'mirewatch', radius: 3, bonus: 1 })).toBe(
      'Foraging and hunting within 3 hexes of Mirewatch are 1 easier.',
    );
    expect(effectText(data, { kind: 'water', at: 'cinderhold', radius: 3 })).toBe(
      "Hexes within 3 of Cinderhold fill the water die and aren't dry land.",
    );
    expect(effectText(data, { kind: 'workshop-pace', at: 'cinderhold', percent: 25 })).toBe(
      'Work at the workshop in Cinderhold goes 25% faster.',
    );
    expect(effectText(data, { kind: 'grave-ward', at: 'cinderhold' })).toBe(
      "The Faithful can't empty the crypt in Cinderhold.",
    );
  });

  it('says what each institution opens', () => {
    expect(serviceText(data, 'arena')).toBe(
      "An arena with bouts, paying the party 25% of a month's entry fees as each month begins.",
    );
    expect(serviceText(data, 'alchemist')).toBe(
      'An alchemist who sells potions and brews them to order.',
    );
    expect(serviceText(data, 'crypt')).toBe(
      "A crypt that raises the party's dead at 50% of the price, Half-Dead.",
    );
    expect(serviceText(data, 'temple')).toBe(
      "A temple that raises the party's dead at 50% of the price, Grave-touched.",
    );
  });
});
