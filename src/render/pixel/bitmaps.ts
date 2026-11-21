// The pixel overland's sprites (docs/presentation-plan.md, V8): a glyph for each terrain and an
// icon for each kind of place, drawn by hand as rows of letters, each letter a step of a material's
// ramp ('.' is clear). Light falls from the upper left, as on the vector chart.
import { MAT, type Mat } from './palette.ts';

/** Each letter's material and brightness. */
export const INK: Record<string, [Mat, number]> = {
  k: [MAT.void, 0],
  '1': [MAT.leaf, 0.3],
  '2': [MAT.leaf, 0.55],
  '3': [MAT.leaf, 0.82],
  '4': [MAT.pine, 0.3],
  '5': [MAT.pine, 0.55],
  '6': [MAT.pine, 0.82],
  t: [MAT.wood, 0.3],
  T: [MAT.wood, 0.6],
  s: [MAT.stone, 0.32],
  S: [MAT.stone, 0.56],
  L: [MAT.stone, 0.82],
  w: [MAT.snow, 0.72],
  W: [MAT.snow, 1],
  y: [MAT.sand, 0.5],
  Y: [MAT.sand, 0.85],
  r: [MAT.rust, 0.35],
  R: [MAT.rust, 0.62],
  Q: [MAT.rust, 0.86],
  b: [MAT.water, 0.42],
  B: [MAT.water, 0.8],
  g: [MAT.grass, 0.38],
  G: [MAT.grass, 0.8],
  m: [MAT.moss, 0.4],
  M: [MAT.moss, 0.72],
  f: [MAT.blood, 0.42],
  F: [MAT.blood, 0.78],
  o: [MAT.gold, 0.55],
  O: [MAT.gold, 0.92],
  c: [MAT.cloth, 0.5],
  C: [MAT.cloth, 0.86],
  d: [MAT.dirt, 0.34],
  D: [MAT.dirt, 0.62],
};

export interface Bitmap {
  rows: string[];
  /** Ringed in black, as an icon or a tree is; tufts and ripples are not. */
  outline: boolean;
}

const art = (outline: boolean, ...rows: string[]): Bitmap => ({ rows, outline });

/** A glyph for each terrain that has one, set about its hex by hex-art.ts. */
export const GLYPHS: Record<string, Bitmap> = {
  plains: art(false, 'G.G', 'gGg'),
  forest: art(true, '.332.', '33221', '32211', '.211.', '..t..'),
  'deep-forest': art(true, '..6..', '.665.', '.655.', '66554', '.554.', '65544', '..t..'),
  hills: art(true, '..MMm..', '.MMMmm.', 'MMMmmmm'),
  mountains: art(true, '....L....', '...LLs...', '..LSSss..', '.LSSSsss.', 'LSSSSssss'),
  peaks: art(true, '....W....', '...WWw...', '..WWSws..', '..LSSss..', '.LSSSsss.', 'LSSSSssss'),
  swamp: art(false, 'G..G.', 'G.GG.', 'mGmGm', '.bBb.'),
  badlands: art(true, '.QQQQ..', '.RRRRr.', 'RRRRrrr'),
  desert: art(true, '.G.', 'GG.', '.GG', '.G.'),
  dunes: art(false, '..YYy..', '.YYyyy.', 'YYyyyyy'),
  'salt-flats': art(false, 's...s', '.s.s.', '..s..'),
  oasis: art(true, '.33.33.', '3..t..3', '...t...', '...t...', '.bbBbb.', 'bbBBBbb', '.bbbbb.'),
  lake: art(false, '.BB..', 'B..BB'),
  river: art(false, 'G.G.', 'GmGm'),
  ford: art(true, 'S.S.S'),
};

/** The icons for places, the party's banner, a bridge, and the compass. */
export const ICONS = {
  town: art(
    true,
    '...RRR...',
    '..RRRrr..',
    '.RRRRrrr.',
    'RRRRRrrrr',
    '.CCCCccc.',
    '.CCtCccc.',
    '.CCtCccc.',
  ),
  dungeon: art(true, '..SSS..', '.SLSSs.', 'SLkkkss', 'SSkkkss', 'SSkkkss'),
  grove: art(true, '.3332..', '3332221', '3O22O21', '.22211.', '..1t1..', '...t...', '..ttt..'),
  lair: art(true, '..ddd..', '.dDDdd.', 'dDkkkdd', 'dDkkkdd', 'CC.C.CC'),
  camp: art(true, '...t...', '..RRr..', '.RRkrr.', 'RRRkrrr', 'RRkkkrr'),
  exit: art(true, 'OOOOO.', 'OOOOOO', 'OOOOO.', '..t...', '..t...', '..t...', '.ttt..'),
  party: art(true, 'tFFF..', 'tFFFF.', 'tFFf..', 'tf....', 't.....', 't.....', 't.....', 'tt....'),
  bridgeAcross: art(true, 'TTTTT', 'ttttt', 'TTTTT'),
  bridgeAlong: art(true, 'TtT', 'TtT', 'TtT', 'TtT', 'TtT'),
  compass: art(
    true,
    '....F....',
    '...FFf...',
    '...FFf...',
    '....S....',
    'CSSSOSSSc',
    '....S....',
    '...cSs...',
    '...ccs...',
    '....c....',
  ),
} satisfies Record<string, Bitmap>;

export const widthOf = (b: Bitmap): number => (b.rows[0] as string).length;
export const heightOf = (b: Bitmap): number => b.rows.length;
