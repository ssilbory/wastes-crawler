import { describe, expect, it } from 'vitest';
import {
  designable,
  designScore,
  factionHelp,
  greatestOpposition,
  loweredDifficulty,
  projectDifficulty,
  renownPrice,
  workingCheck,
  workingDays,
  workingDifficulty,
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

describe('magical Workings (vendor/wwn-srd/4.0 Magic and Spellcasting/4.8.0)', () => {
  it('multiplies a Working’s points by its area', () => {
    expect(workingDifficulty(3, 'room')).toBe(3);
    expect(workingDifficulty(6, 'village')).toBe(96);
    // The SRD's example: 16 points over a whole tower.
    expect(workingDifficulty(16, 'building')).toBe(64);
    expect(workingDifficulty(2, 'city')).toBe(128);
    expect(workingDifficulty(1, 'region')).toBe(256);
  });

  it('scores a designer by level and Magic, never below nothing', () => {
    // The SRD's 6th-level High Mage with Magic-3.
    expect(designScore(6, 3)).toBe(36);
    expect(designScore(6, 0)).toBe(0);
    expect(designScore(6, -1)).toBe(0);
  });

  it('designs alone at the full difficulty, with help from half, never below half', () => {
    expect(designable(96, 0, 96)).toBe(true);
    expect(designable(48, 48, 96)).toBe(true);
    expect(designable(48, 47, 96)).toBe(false);
    expect(designable(47, 60, 96)).toBe(false);
  });

  it('takes a month and a week a 5 points, halved at double the cost', () => {
    expect(workingDays(12, 30, false)).toBe(30 + 21);
    expect(workingDays(10, 30, false)).toBe(30 + 14);
    expect(workingDays(96, 30, false)).toBe(30 + 140);
    expect(workingDays(12, 30, true)).toBe(26);
  });

  it('checks at 8 plus the degree', () => {
    expect(workingCheck('trivial')).toBe(8);
    expect(workingCheck('minor')).toBe(9);
    expect(workingCheck('supreme')).toBe(12);
  });
});
