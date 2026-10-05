// Parley (docs/rules-adaptation.md, Parley in Phase 6c), from SRD 5.2.1 and 5.2.2
// (vendor/wwn-srd/5.0 Monsters and Foes/Reaction Rolls and Parlayeing.md): one try per encounter to
// talk, intimidate, or bribe a group into a better mood. Friendlier groups back off and give up
// captives; the most helpful pay tribute or offer to sign on.
import { mercy } from './arts.ts';
import type { Reaction } from '../../rules/reaction.ts';
import { toTenths } from '../../rules/economy.ts';
import type { GameData } from '../character/context.ts';
import { fights, MOODS } from './encounters.ts';
import { alive, memberCheck, note } from './members.ts';
import { mindOf, parleyReach } from './minds.ts';
import { accrueShares, addNpc, fights as npcFights, hirelingType, monsterOf } from './npcs.ts';
import { freeCaptive } from './rescue.ts';
import type { TownResult } from './services.ts';
import { addLoot } from './shop.ts';
import { shareText } from './wording.ts';
import type { World } from './types.ts';

export type Approach = 'talk' | 'intimidate' | 'bribe';

const BANDS: readonly Reaction[] = ['aggressive', 'unfriendly', 'expected', 'friendly', 'helpful'];
const no = (reason: string): TownResult => ({ ok: false, reason });

/** Whether the party can still parley with the pending encounter. */
export function canParley(w: World, data: GameData): boolean {
  const e = w.encounter;
  if (!e || e.parleyed) return false;
  const reach = parleyReach(w, data);
  if (e.reaction === 'aggressive' && !reach.evenAggressive) return false;
  return e.enemies.flat().every((id) => reach.minds.has(mindOf(data, id)));
}

const hitDice = (data: GameData, enemies: string[][]) =>
  enemies.flat().reduce((sum, id) => sum + monsterOf(data, id).hitDice, 0);

export function bribePrice(w: World, data: GameData): number {
  const e = w.encounter;
  if (!e) throw new Error('no encounter');
  return toTenths(hitDice(data, e.enemies) * data.content.npcRules.parley.bribePerHitDie);
}

/** What friendlier moods bring: a freed captive, then tribute and a would-be recruit. */
function goodwill(w: World, data: GameData): void {
  const e = w.encounter;
  if (!e || BANDS.indexOf(e.reaction) < BANDS.indexOf('friendly')) return;
  if (e.captive) {
    freeCaptive(w, data, e.captive);
    e.captive = null;
  }
  if (e.reaction !== 'helpful') return;
  const dice = e.enemies.flat().flatMap((id) => {
    const loot = data.content.monsterCombat.find((m) => m.id === id)?.loot;
    return loot ? [loot] : [];
  });
  if (dice.length > 0) {
    addLoot(w, dice);
    accrueShares(w, data, dice);
    note(w, 'They offer tribute to be left in peace.');
  }
  const kin = data.content.npcRules.hirelings.find((h) => e.enemies.flat().includes(h.monster));
  if (kin) {
    e.offer = kin.id;
    note(w, `One of them offers to sign on as a ${kin.name}.`);
  }
}

/** The party's one parley: success moves the mood one band friendlier, failure one band worse. */
export function parley(
  w: World,
  data: GameData,
  approach: Approach,
  speakerId: string | null,
): TownResult {
  const e = w.encounter;
  if (!e || !canParley(w, data)) return no("They won't parley.");
  const rules = data.content.npcRules.parley;
  let success = true;
  if (approach === 'bribe') {
    const price = bribePrice(w, data);
    if (w.purse < price) return no(`A bribe costs ${price} crowns.`);
    w.purse = toTenths(w.purse - price);
    note(w, `The party pays ${price} crowns.`);
  } else {
    const speaker = alive(w).find((m) => m.id === speakerId && m.character.hp.current > 0);
    if (!speaker) return no('Choose someone to do the talking.');
    const difficulty = rules.difficulty + (e.hostile ? rules.hostileExtra : 0);
    const us =
      alive(w).filter((m) => m.character.hp.current > 0).length +
      w.npcs.filter((n) => n.hp > 0 && npcFights(data, n)).length;
    const outnumber = approach === 'intimidate' && us > e.enemies.flat().length ? 1 : 0;
    const talk = () => memberCheck(w, data, speaker, 'convince', ['cha'], difficulty).success;
    success =
      approach === 'talk'
        ? talk()
        : memberCheck(w, data, speaker, 'lead', ['str', 'cha'], difficulty, outnumber).success;
    // Words of Mercy: a failed plea for peace may be made again, for Effort for the day.
    const priest = approach === 'talk' && !success ? mercy(w, data) : undefined;
    if (priest) {
      note(w, `${priest.character.name} speaks words of mercy.`);
      success = talk();
    }
  }
  const band = BANDS.indexOf(e.reaction) + (success ? 1 : -1);
  e.reaction = BANDS[Math.max(0, Math.min(BANDS.length - 1, band))] as Reaction;
  e.hostile = fights(e.nature, e.reaction);
  e.parleyed = true;
  note(w, `${success ? 'The parley goes well.' : 'The parley goes badly.'} ${MOODS[e.reaction]}`);
  goodwill(w, data);
  return { ok: true };
}

/** Takes up a helpful group's offer to sign on, at the usual wage. */
export function acceptOffer(w: World, data: GameData): TownResult {
  const e = w.encounter;
  if (!e?.offer) return no('No one has offered to join.');
  const t = hirelingType(data, e.offer);
  const npc = addNpc(w, data, 'hireling', t.id, t.monster, null, t.role === 'fighter');
  if (!npc) return no('There is no room in the party.');
  e.offer = null;
  note(w, `${npc.name} signs on as a ${t.name} for ${shareText(t.share)} of the loot.`);
  return { ok: true };
}
