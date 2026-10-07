// High Magic that works on a dungeon's stone and space (vendor/wwn-srd/4.0 Magic and Spellcasting/
// 4.4.0 High Magic Spells by Level.md; Sam's calls, docs/rules-adaptation.md, High Magic outside
// fights). The Decree of Lithic Dissolution turns the walls ahead to dust, a cell deep per caster
// level, like a longer Burrower Below; it takes a turn, and a level's outer wall holds. Pierce the
// Pallid Gate steps the party through a rift to stairs or a safe square of the level it has seen,
// at least 20 feet off and within 100 feet (ten cells) per caster level.
import { ahead, cellKey, type Cell } from '../../rules/grid.ts';
import { characterLevel } from '../../rules/progression.ts';
import type { GameData } from '../character/context.ts';
import { emit } from '../world/bus.ts';
import { cannotCast } from '../world/casting.ts';
import { note } from '../world/members.ts';
import type { TownResult } from '../world/services.ts';
import type { Member, World } from '../world/types.ts';
import { levelOf, look, openFacing } from './explore.ts';
import { edgeKey, glimpse, knownEdges } from './secrets.ts';
import { arriveOn } from './specials.ts';
import { passTurn } from './time.ts';

export const LITHIC = 'decree-of-lithic-dissolution';
export const PALLID_GATE = 'pierce-the-pallid-gate';

/** Cells a rift reaches per caster level: 100 feet of 10-foot cells. */
export const GATE_CELLS_PER_LEVEL = 10;
/** The SRD's least distance between a rift's ends, 20 feet, in cells. */
export const GATE_MIN_CELLS = 2;

const no = (reason: string): TownResult => ({ ok: false, reason });
const state = (w: World) => w.dungeon as NonNullable<World['dungeon']>;

function caster(w: World, data: GameData, memberId: string, spell: string): Member | string {
  if (!w.dungeon) throw new Error('the party is not in a dungeon');
  if (w.encounter) return 'Settle the encounter first.';
  const m = w.members.find((x) => x.id === memberId);
  return cannotCast(data, m, spell) ?? (m as Member);
}

/** The Decree of Lithic Dissolution: every wall ahead, up to a cell per caster level, is dust. */
export function dissolve(w: World, data: GameData, memberId: string): TownResult {
  const m = caster(w, data, memberId, LITHIC);
  if (typeof m === 'string') return no(m);
  const s = state(w);
  const { map } = levelOf(data, s.dungeon, s.level);
  const edge = knownEdges(w, data);
  const first = edge(s.at, s.facing);
  if (first === 'open' || first === 'door') return no('There is no wall ahead to dissolve.');
  if (!map.inBounds(ahead(s.at, s.facing))) return no('Only solid rock lies beyond.');
  const dug = [...(s.dug[s.level] ?? [])];
  let c = s.at;
  for (let i = 0; i < characterLevel(m.character.classes); i++) {
    const next = ahead(c, s.facing);
    if (!map.inBounds(next)) break;
    const e = edge(c, s.facing);
    if (e === 'wall' || e === 'secret') dug.push(edgeKey(c, s.facing));
    c = next;
  }
  m.spellsCast += 1;
  s.dug[s.level] = dug;
  note(w, `${m.character.name} speaks the decree, and the stone ahead falls away to dust.`);
  look(w, data, s);
  passTurn(w, data);
  return { ok: true };
}

/** Why a rift can't join these cells for a caster of this level, or null if it can. */
export function gateBar(from: Cell, to: Cell, level: number): 'too near' | 'too far' | null {
  const d = Math.hypot(from.x - to.x, from.y - to.y);
  if (d < GATE_MIN_CELLS) return 'too near';
  return d > GATE_CELLS_PER_LEVEL * level ? 'too far' : null;
}

/** Seen stairs and safe squares on the party's level: where a rift can open. */
export function gateTargets(w: World, data: GameData): Cell[] {
  const s = state(w);
  const { level } = levelOf(data, s.dungeon, s.level);
  const seen = new Set(s.seen[s.level] ?? []);
  const out = new Map<string, Cell>();
  for (const c of [...level.links.map((l) => l.at), ...level.safe])
    if (seen.has(cellKey(c)) && cellKey(c) !== cellKey(s.at)) out.set(cellKey(c), c);
  return [...out.values()];
}

/** Pierce the Pallid Gate: the party steps through to a cell it has seen. */
export function pierceGate(w: World, data: GameData, memberId: string, to: Cell): TownResult {
  const m = caster(w, data, memberId, PALLID_GATE);
  if (typeof m === 'string') return no(m);
  const s = state(w);
  if (!gateTargets(w, data).some((c) => cellKey(c) === cellKey(to)))
    return no('The rift can open only on stairs or a safe square the party has seen.');
  const bar = gateBar(s.at, to, characterLevel(m.character.classes));
  if (bar === 'too near') return no('That is too near for a rift.');
  if (bar === 'too far') return no(`That is beyond ${m.character.name}'s reach.`);
  m.spellsCast += 1;
  note(w, `${m.character.name} tears open a pale rift, and the party steps through.`);
  const { map } = levelOf(data, s.dungeon, s.level);
  s.at = { ...to };
  s.facing = openFacing(map, to, s.facing);
  // Stairs and safe squares hold no traps (dungeon-check.ts), so there is nothing to spring.
  arriveOn(w, data);
  look(w, data, s);
  glimpse(w, data);
  emit(w, data, { kind: 'cell-entered' });
  return { ok: true };
}
