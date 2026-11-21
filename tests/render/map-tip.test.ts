import { describe, expect, it } from 'vitest';
import { hexTip } from '../../src/render/map-tip.ts';
import type { HexCell } from '../../src/render/hex-view.ts';

const cell = (over: Partial<HexCell> = {}): HexCell => ({
  key: '1,1',
  col: 1,
  row: 1,
  points: '',
  cx: 0,
  cy: 0,
  terrain: 'forest',
  terrainName: 'Light forest',
  label: '',
  road: false,
  visited: true,
  site: null,
  party: false,
  destination: false,
  route: false,
  quest: false,
  questName: null,
  dungeon: null,
  exit: null,
  grove: null,
  lair: null,
  camp: null,
  ...over,
});

describe('map tooltip (Sam’s asks)', () => {
  it('names the terrain only of a hex with nothing else there', () => {
    expect(hexTip(cell())).toEqual({ title: 'Light forest', lines: [] });
    expect(hexTip(cell({ party: true, destination: true }))).toEqual({
      title: 'Light forest',
      lines: ['The party is here', 'Your destination'],
    });
  });

  it('names the dungeon, not the terrain, with the quest that leads there beneath it', () => {
    expect(hexTip(cell({ dungeon: 'The Old Barrow' }))).toEqual({
      title: 'The Old Barrow',
      lines: [],
    });
    expect(
      hexTip(cell({ dungeon: 'The Old Barrow', quest: true, questName: 'The Barrow Bones' })),
    ).toEqual({ title: 'The Old Barrow', lines: ['Quest: The Barrow Bones'] });
  });

  it('names where a quest leads when nothing else stands there', () => {
    expect(hexTip(cell({ quest: true, questName: 'Hunt the Ridge Wolf' })).title).toBe(
      'Quest: Hunt the Ridge Wolf',
    );
    expect(hexTip(cell({ quest: true })).title).toBe('A quest leads here');
  });

  it('puts a town first, then the rest in order, never the terrain', () => {
    expect(
      hexTip(
        cell({
          site: 'Rubblegate',
          dungeon: 'The Old Barrow',
          exit: 'The road east',
          quest: true,
          questName: 'Rats in the Cellar',
          party: true,
        }),
      ),
    ).toEqual({
      title: 'Rubblegate',
      lines: ['The Old Barrow', 'Quest: Rats in the Cellar', 'The road east', 'The party is here'],
    });
    expect(hexTip(cell({ grove: 'A walking grove', lair: 'A den', camp: 'A camp' }))).toEqual({
      title: 'A walking grove',
      lines: ['A den', 'A camp'],
    });
  });

  it('keeps fog unexplored, unless the party has heard what waits there', () => {
    const fog = { terrain: null, terrainName: null };
    expect(hexTip(cell(fog))).toEqual({ title: 'Unexplored', lines: [] });
    expect(hexTip(cell({ ...fog, dungeon: 'A rumored crypt' })).title).toBe('A rumored crypt');
    expect(hexTip(cell({ ...fog, camp: 'A besieger’s camp' })).title).toBe('A besieger’s camp');
  });
});
