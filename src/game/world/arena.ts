// Town arenas (docs/rules-adaptation.md, Town arenas in Phase 6d): a card of bouts per town, an
// entry fee through the town's spending threshold, and a prize for a win. The party fights with its
// real wounds, strain, and spells. Bouts against people are fought to yield: anyone who fell is
// pulled out with 1 HP and Frail (SRD 2.5.1's stabilized state). Bouts against monsters are to
// the death, though handlers drag out anyone still breathing. One bout a day; no XP or loot.
import type { ArenaBout } from '../../data/schemas/index.ts';
import { toTenths } from '../../rules/economy.ts';
import type { BattleResult } from '../combat/battle.ts';
import type { Battle } from '../combat/types.ts';
import type { GameData } from '../character/context.ts';
import { carryBack, lastStandBack } from './carry-back.ts';
import { ailmentsBack } from './ailments.ts';
import { partyBattle, type WorldBattle } from './fight.ts';
import { alive, note, setHp } from './members.ts';
import type { Member, World } from './types.ts';
import { priceHere, spend, townHere } from './town-prices.ts';

export function arenaCard(w: World, data: GameData): ArenaBout[] {
  const town = townHere(w, data);
  return data.content.arenaCards.find((c) => c.town === town.id)?.bouts ?? [];
}

/** Why the party can't fight a bout today, or null if it can. */
export function boutBlocked(w: World, data: GameData): string | null {
  townHere(w, data);
  if (w.encounter) return 'Settle the encounter first.';
  if (w.arenaDay === w.day) return 'The party has fought its bout for today.';
  if (!alive(w).some((m) => m.character.hp.current > 0)) return 'No one is fit to fight.';
  return null;
}

export type BoutStart =
  { ok: true; fight: WorldBattle; bout: ArenaBout } | { ok: false; reason: string };

/** Pays the fee and sets up the bout: the party's PCs only. */
export function startBout(w: World, data: GameData, boutId: string): BoutStart {
  const bout = arenaCard(w, data).find((b) => b.id === boutId);
  if (!bout) throw new Error(`no bout ${boutId} here`);
  const blocked = boutBlocked(w, data);
  if (blocked) return { ok: false, reason: blocked };
  if (!spend(w, data, bout.fee))
    return { ok: false, reason: `The fee is ${priceHere(w, data, bout.fee)} crowns.` };
  w.arenaDay = w.day;
  note(w, `The party enters the arena: ${bout.name}.`);
  return { ok: true, bout, fight: partyBattle(w, data, bout.enemies, false, null) };
}

const fell = (c: Battle['combatants'][number]) =>
  c.status === 'dead' || c.status === 'dying' || c.status === 'stable';

/** Writes the bout back to the party and pays the prize for a win. */
export function settleBout(
  w: World,
  data: GameData,
  fight: WorldBattle,
  bout: ArenaBout,
  result: BattleResult,
): void {
  fight.memberIds.forEach((id, i) => {
    const m = w.members.find((x) => x.id === id) as Member;
    const c = fight.battle.combatants[i] as Battle['combatants'][number];
    carryBack(data, m, c);
    ailmentsBack(w, data, m, c);
    lastStandBack(w, m, c);
    // Pulled out alive: everyone in a bout to yield, and the not-yet-dead in a bout to the death.
    if (fell(c) && !(bout.toTheDeath && c.status === 'dead')) {
      m.dead = false;
      setHp(m, 1);
      m.frail = true;
    }
  });
  if (result.outcome === 'party') {
    w.purse = toTenths(w.purse + bout.prize);
    note(w, `The party wins ${bout.name} and takes ${bout.prize} crowns.`);
  } else if (result.battle.escaped)
    note(w, 'The party shelters in the Invincible Citadel until the bout is called off.');
  else if (bout.toTheDeath) note(w, `The party is dragged from the arena, beaten.`);
  else note(w, 'The party yields.');
}
