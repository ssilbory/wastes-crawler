// The Party and formation and Formation rules house rules in docs/rules-adaptation.md: two rows of
// four slots, rear slots shielded by the slot ahead, rear cover, and the front drop.

export const ROW_SLOTS = 4;
export const FORMATION_ROWS = 2;

export type Row = 0 | 1;

export interface SlotState {
  /** An occupant that is up and fighting. */
  standing: boolean;
  /** An occupant at 0 HP or otherwise out of the fight. */
  down: boolean;
}

/** One row of slots; null is an empty slot. */
export type FormationRow = (SlotState | null)[];

/** party[row][column]: the front row, then the rear. */
export type Formation = [FormationRow, FormationRow];

/** A rear slot is shielded while the front slot directly ahead holds someone standing. */
export function shielded(f: Formation, column: number): boolean {
  return f[0][column]?.standing === true;
}

/**
 * Disadvantage steps for an attack. Attacks made from a rear slot, and attacks against a shielded
 * rear slot, each count; flying attackers ignore cover both ways.
 */
export function coverSteps(fromRear: boolean, targetCovered: boolean, flying = false): number {
  if (flying) return 0;
  return (fromRear ? -1 : 0) + (targetCovered ? -1 : 0);
}

export interface Move {
  from: [Row, number];
  to: [Row, number];
}

/**
 * End of round: each downed front-row occupant drops to an empty rear slot (preferring the one
 * behind), or else swaps with the standing rear occupant with the most HP. `hp[col]` is the rear
 * row's HP; `pick` breaks ties and is given the tied columns.
 */
export function frontDrops(
  f: Formation,
  rearHp: readonly number[],
  pick: (columns: number[]) => number,
): Move[] {
  const [front, back] = f;
  const rear = [...back];
  const moves: Move[] = [];
  for (let col = 0; col < ROW_SLOTS; col++) {
    const slot = front[col];
    if (!slot?.down) continue;
    const empties = [col, ...[0, 1, 2, 3].filter((c) => c !== col)].filter((c) => !rear[c]);
    const target = empties[0];
    if (target !== undefined) {
      moves.push({ from: [0, col], to: [1, target] });
      rear[target] = slot;
      continue;
    }
    const standing = [0, 1, 2, 3].filter((c) => rear[c]?.standing);
    if (standing.length === 0) continue;
    const best = Math.max(...standing.map((c) => rearHp[c] ?? 0));
    const tied = standing.filter((c) => (rearHp[c] ?? 0) === best);
    const promoted = tied.length === 1 ? (tied[0] as number) : pick(tied);
    moves.push({ from: [0, col], to: [1, promoted] });
    rear[promoted] = slot;
  }
  return moves;
}

/** An occupied slot as servant placement sees it. */
export interface Occupant {
  row: number;
  column: number;
  hp: number;
  /** Can step back for a servant: anyone but another fighting servant. */
  yields: boolean;
}

export interface ServantPlace {
  row: Row;
  column: number;
  /** The occupant (by index) who steps back for the servant, and the rear slot they take. */
  bump: { index: number; column: number } | null;
}

/**
 * Where a fighting servant joins the formation (docs/rules-adaptation.md, Formation rules:
 * Servants): a free front slot; else the front slot of the yielding ally with the fewest HP (the
 * leftmost on a tie), who drops to the rear slot behind them or the first free one; else a free
 * rear slot. Null with no free slot.
 */
export function servantPlace(occupants: readonly Occupant[]): ServantPlace | null {
  const free = (row: number) =>
    Array.from({ length: ROW_SLOTS }, (_, c) => c).filter(
      (c) => !occupants.some((o) => o.row === row && o.column === c),
    );
  const [front, rear] = [free(0), free(1)];
  if (front[0] !== undefined) return { row: 0, column: front[0], bump: null };
  if (rear[0] === undefined) return null;
  const yielding = occupants
    .map((o, index) => ({ ...o, index }))
    .filter((o) => o.row === 0 && o.yields)
    .sort((a, b) => a.hp - b.hp || a.column - b.column);
  const weakest = yielding[0];
  if (!weakest) return { row: 1, column: rear[0], bump: null };
  const behind = rear.includes(weakest.column) ? weakest.column : rear[0];
  return { row: 0, column: weakest.column, bump: { index: weakest.index, column: behind } };
}

/**
 * Healing Touch's reach in a fight (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.9
 * The Healer.md, "a touched ally"; Sam's call in docs/rules-adaptation.md, Healing Touch): the
 * Healer themselves, the slot directly ahead, and the slots to either side in their own row.
 */
export function inTouch(
  from: { row: number; column: number },
  to: { row: number; column: number },
): boolean {
  if (to.row === from.row) return Math.abs(to.column - from.column) <= 1;
  return to.row === from.row - 1 && to.column === from.column;
}
