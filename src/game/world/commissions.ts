// Commissioned magic weapons and armor (docs/rules-adaptation.md, Crafting and modifying gear:
// Craftsmen; Sam's calls). A craftsman forges a +1 to +3 weapon or suit of armor (4.9.3) from their
// lists for a fiftieth of the SRD's
// creation cost (vendor/wwn-srd/4.0 Magic and Spellcasting/4.10.0), the components its bonus calls
// for, and the SRD's time: a month for +1. The party collects it in the craftsman's town.
import type { GameData } from '../character/context.ts';
import { pickComponents, removeComponents } from './components.ts';
import {
  giveMagic,
  kindWord,
  openCraftsman,
  partyMember,
  payCraftsman,
  wares,
} from './craftsmen.ts';
import { abilitiesFor, forgeTerms, forgedName } from './forging.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import type { World } from './types.ts';
import { daysText } from './wording.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/**
 * Commissions a +1 to +3 weapon or suit of armor, with a special ability besides for its own price,
 * components, and days (Abilities).
 */
export function commission(
  w: World,
  data: GameData,
  weapon: string,
  bonus: number,
  ability?: string,
): TownResult {
  const shop = openCraftsman(w, data);
  if ('ok' in shop) return shop;
  const { c, st } = shop;
  if (!wares(c).includes(weapon)) throw new Error(`${c.name} doesn't forge ${weapon}`);
  if (ability && !abilitiesFor(data, weapon).some((a) => a.id === ability))
    throw new Error(`${ability} doesn't fit ${weapon}`);
  const terms = forgeTerms(data, bonus, ability);
  const parts = pickComponents(w, data, terms.components);
  if (!parts)
    return no(
      `A +${bonus} ${kindWord(data, weapon)} needs ${terms.components.map((x) => `${x.count} ${x.type}`).join(', ')}.`,
    );
  if (!payCraftsman(w, data, c, st, terms.crowns))
    return no(`${c.name} asks ${terms.crowns} crowns.`);
  removeComponents(w, parts);
  w.commissions.push({
    craftsman: c.id,
    weapon,
    bonus,
    ...(ability ? { ability } : {}),
    readyDay: w.day + terms.days,
  });
  note(
    w,
    `${c.name} takes on a +${bonus} ${forgedName(data, weapon, ability)}: ready in ${daysText(terms.days)}.`,
  );
  return { ok: true };
}

/** Collects a finished commission in its craftsman's town. */
export function collect(w: World, data: GameData, index: number, memberId: string): TownResult {
  const shop = openCraftsman(w, data);
  if ('ok' in shop) return shop;
  const job = w.commissions[index];
  if (!job || job.craftsman !== shop.c.id) throw new Error(`no commission ${index} here`);
  if (w.day < job.readyDay) return no(`Not ready for ${daysText(job.readyDay - w.day)}.`);
  const m = partyMember(w, memberId);
  w.commissions = w.commissions.filter((_, i) => i !== index);
  giveMagic(data, m, job.weapon, job.bonus, job.ability);
  note(
    w,
    `${m.character.name} collects the +${job.bonus} ${forgedName(data, job.weapon, job.ability)} from ${shop.c.name}.`,
  );
  return { ok: true };
}
