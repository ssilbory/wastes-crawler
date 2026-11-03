import { describe, expect, it } from 'vitest';
import {
  factionHelp,
  greatestOpposition,
  loweredDifficulty,
  projectDifficulty,
  renownPrice,
} from '../../src/rules/projects.ts';

// SRD 7.5.0's table at 1/50 (data/content/projects.json).
const BANDS = [
  { points: 4, crowns: 10 },
  { points: 4, crowns: 40 },
  { points: 8, crowns: 80 },
];

describe('major projects (vendor/wwn-srd/7.0 Major Projects/)', () => {
  it('multiplies probability, scope, and the greatest opposition (SRD 7.4.0)', () => {
    // The SRD's own example: improbable, kingdom, the king against it, the people too.
    expect(
      projectDifficulty({
        probability: 'improbable',
        scope: 'kingdom',
        opposition: 'king',
        popular: true,
      }),
    ).toBe(1024);
    expect(
      projectDifficulty({
        probability: 'plausible',
        scope: 'village',
        opposition: null,
        popular: false,
      }),
    ).toBe(2);
    expect(
      projectDifficulty({
        probability: 'impossible',
        scope: 'city',
        opposition: 'local',
        popular: false,
      }),
    ).toBe(64);
    expect(
      projectDifficulty({
        probability: 'improbable',
        scope: 'region',
        opposition: 'major',
        popular: false,
      }),
    ).toBe(128);
  });

  it('counts only the greatest opposition, or none', () => {
    expect(greatestOpposition(['minor', 'major', 'local'])).toBe('major');
    expect(greatestOpposition(['king', 'minor'])).toBe('king');
    expect(greatestOpposition(['minor', 'minor'])).toBe('minor');
    expect(greatestOpposition([])).toBeNull();
  });

  it('takes adventures’ shares off, rounded up, then help, never below 1 (SRD 7.5.0, 7.9.0)', () => {
    expect(loweredDifficulty(16, 0, 0)).toBe(16);
    expect(loweredDifficulty(16, 25, 0)).toBe(12);
    // A third of 32 leaves 21.33, rounded up.
    expect(loweredDifficulty(32, 33, 0)).toBe(22);
    expect(loweredDifficulty(16, 25, 6)).toBe(6);
    expect(loweredDifficulty(8, 50, 12)).toBe(1);
    // Shares past the whole goal still leave 1.
    expect(loweredDifficulty(8, 150, 0)).toBe(1);
  });

  it('prices bought Renown band by band, and refuses past the table (SRD 7.5.0)', () => {
    expect(renownPrice(BANDS, 0, 1)).toBe(10);
    expect(renownPrice(BANDS, 0, 4)).toBe(40);
    // The SRD's example at 1/50: 14 points cost 40 + 160 + 480.
    expect(renownPrice(BANDS, 0, 14)).toBe(680);
    // Points already bought move the price into the next band.
    expect(renownPrice(BANDS, 3, 2)).toBe(50);
    expect(renownPrice(BANDS, 8, 1)).toBe(80);
    expect(renownPrice(BANDS, 0, 0)).toBe(0);
    expect(renownPrice(BANDS, 0, 16)).toBe(840);
    expect(renownPrice(BANDS, 15, 2)).toBeNull();
    expect(renownPrice(BANDS, 16, 1)).toBeNull();
  });

  it('halves a faction’s help, rounded up, doubled when it suits (SRD 7.9.0, Sam’s call)', () => {
    const free = { force: 4, cunning: 2, wealth: 5 };
    expect(factionHelp(free, false)).toBe(6);
    expect(factionHelp(free, true)).toBe(12);
    expect(factionHelp({ force: 1, cunning: 1, wealth: 2 }, false)).toBe(2);
  });
});
