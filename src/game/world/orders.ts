// Standing orders (docs/setting.md, The binding and standing orders; docs/rules-adaptation.md,
// Standing orders in Phase 12b). Bound garrisons hold fixed posts and bound patrols walk the
// encounter tables, still carrying out orders twenty years old. Sam's call: an order ends without a
// fight through its countersign, a token of command authority, or finishing the quest that fulfils
// it; a bluff (Convince, vendor/wwn-srd/1.0 Character Creation/1.2.0 Skills.md) only gets this one
// group to stand aside, and failing it means a fight.
import type { Authority, StandingOrder } from '../../data/schemas/index.ts';
import { hexKey } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { emit, type WorldEvent } from './bus.ts';
import { meetGroup } from './encounters.ts';
import { passInDisguise } from './guises.ts';
import { awake, memberCheck, note } from './members.ts';
import { hirelingType } from './npcs.ts';
import type { TownResult } from './services.ts';
import { speechCheck } from './speech.ts';
import type { World } from './types.ts';
import { levelOf } from '../dungeon/levels.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

export function orderOf(data: GameData, id: string): StandingOrder {
  const o = data.content.standingOrders.find((x) => x.id === id);
  if (!o) throw new Error(`unknown standing order ${id}`);
  return o;
}

export const orderEnded = (w: World, id: string) => w.ordersEnded.includes(id);

/** The pending encounter's standing order, while it still holds. */
export function pendingOrder(w: World, data: GameData): StandingOrder | null {
  const id = w.encounter?.order;
  return id && !orderEnded(w, id) ? orderOf(data, id) : null;
}

/** A token the party carries that countermands this order, if any. */
export function authorityFor(w: World, data: GameData, order: string): Authority | undefined {
  return data.content.authorities.find(
    (a) => w.authority.includes(a.id) && (a.commands === 'all' || a.commands.includes(order)),
  );
}

export function learnCountersign(w: World, data: GameData, order: string): void {
  if (w.countersigns.includes(order)) return;
  w.countersigns.push(order);
  const o = orderOf(data, order);
  note(w, `The party learns the countersign for ${o.name}: "${o.countersign}".`);
}

export function gainAuthority(w: World, data: GameData, id: string): void {
  if (w.authority.includes(id)) return;
  w.authority.push(id);
  const a = data.content.authorities.find((x) => x.id === id) as Authority;
  note(w, `The party now carries ${a.name}.`);
}

/**
 * Ends an order for good: its garrison and patrols stand down, and one may offer to sign on. The
 * orders given on its authority end with it, and a hoard its guards kept is given up.
 */
export function endOrder(w: World, data: GameData, id: string): void {
  if (orderEnded(w, id)) return;
  w.ordersEnded.push(id);
  const o = orderOf(data, id);
  note(w, `The order to ${o.name.toLowerCase()} is ended. The bound stand down.`);
  for (const next of o.ends ?? []) endOrder(w, data, next);
  emit(w, data, { kind: 'order-ended', order: id });
  const e = w.encounter;
  if (e?.order !== id) return;
  e.hostile = false;
  e.nature = 'wary';
  e.spotted = true;
  if (o.recruit) {
    e.offer = o.recruit;
    note(w, `One of them offers to sign on as a ${hirelingType(data, o.recruit).name}.`);
  }
}

/** Gives the countersign the bound ask for. */
export function giveCountersign(w: World, data: GameData): TownResult {
  const o = pendingOrder(w, data);
  if (!o) return no('No one here is asking for a countersign.');
  if (!w.countersigns.includes(o.id)) return no("The party doesn't know the countersign.");
  note(w, `"${o.countersign}." The bound lower their weapons.`);
  endOrder(w, data, o.id);
  return { ok: true };
}

/** Shows a token of command authority. */
export function presentAuthority(w: World, data: GameData): TownResult {
  const o = pendingOrder(w, data);
  if (!o) return no('No one here answers to authority.');
  const token = authorityFor(w, data, o.id);
  if (!token) return no('The party carries nothing they would obey.');
  note(w, `The party shows ${token.name}. The bound salute.`);
  endOrder(w, data, o.id);
  return { ok: true };
}

/** One try to talk past them, as the party's one parley: success lets this group pass. */
export function bluff(w: World, data: GameData, speakerId: string): TownResult {
  const o = pendingOrder(w, data);
  const e = w.encounter;
  if (!o || !e) return no('No one here to bluff.');
  if (e.parleyed) return no('They have heard enough.');
  const speaker = w.members.find((m) => m.id === speakerId && awake(m));
  if (!speaker) return no('Choose someone to do the talking.');
  e.parleyed = true;
  const { skill, attrs } = speechCheck(data, e.enemies, 'bluff');
  if (memberCheck(w, data, speaker, skill, attrs, o.bluff).success) {
    e.hostile = false;
    e.spotted = true;
    note(w, `${speaker.character.name} talks their way past. The bound let the party through.`);
  } else {
    e.hostile = true;
    e.spotted = false;
    note(w, `${speaker.character.name} stumbles over the lie. The bound attack.`);
  }
  return { ok: true };
}

/** Orders fulfilled by a quest just turned in. */
export function fulfilOrders(w: World, data: GameData, quest: string): void {
  for (const o of data.content.standingOrders) if (o.complete === quest) endOrder(w, data, o.id);
}

/** A garrison post the party stands on, its order in force and the post not yet beaten. */
function postHere(w: World, data: GameData): { key: string; post: Post; where?: string } | null {
  const live = (key: string, p: Post) =>
    !orderEnded(w, p.order) && !w.beaten.includes(key) ? { key, post: p } : null;
  const s = w.dungeon;
  if (s) {
    const { level } = levelOf(data, s.dungeon, s.level);
    const p = level.garrisons.find((x) => x.at.x === s.at.x && x.at.y === s.at.y);
    const found = p && live(`${s.dungeon}/${s.level}/${s.at.x},${s.at.y}`, p);
    return found ? { ...found, where: `${level.name} ${s.at.x},${s.at.y}` } : null;
  }
  const region = data.content.regions.find((r) => r.id === w.region);
  const g = region?.garrisons.find((x) => hexKey(x) === hexKey(w.position));
  return g ? live(`${w.region}/${hexKey(g)}`, { order: g.order, enemies: g.enemies }) : null;
}

type Post = { order: string; enemies: string[][]; text?: string };

/** A garrison holding the party's hex or cell bars the way, challenging before it attacks. */
function springGarrison(w: World, data: GameData): void {
  const found = w.encounter ? null : postHere(w, data);
  if (!found) return;
  const { key, post, where } = found;
  const o = orderOf(data, post.order);
  const text = `${post.text ?? o.text} They demand the countersign.`;
  const e = meetGroup(w, data, post.enemies, 'hostile', null, null, text, where);
  e.order = o.id;
  e.garrison = key;
  // The bound challenge first: the party can still turn back.
  e.spotted = true;
  passInDisguise(w, e);
}

/** The standing orders' bus listener: posts spring where the party arrives; a won fight clears one. */
export function ordersListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind === 'hex-entered' || e.kind === 'cell-entered') springGarrison(w, data);
  else if (e.kind === 'fight-won' && e.garrison) w.beaten.push(e.garrison);
}
