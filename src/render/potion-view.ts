// Potions the party carries and who each can go to now, as data for the panel and the encounter
// (docs/rules-adaptation.md, Potions). Pure.
import type { GameData } from '../game/character/context.ts';
import { alive, awake } from '../game/world/members.ts';
import { cannotDrink, carried } from '../game/world/potions.ts';
import type { World } from '../game/world/types.ts';

export interface PotionLine {
  holder: { id: string; name: string };
  potion: { id: string; name: string; text: string };
  count: number;
  /** Members it can go to now; empty when there is no one. */
  targets: { id: string; name: string }[];
}

/** Every conscious holder's potions, with the members each can go to now. */
export function potionView(w: World, data: GameData): PotionLine[] {
  const members = alive(w);
  return members.filter(awake).flatMap((h) =>
    carried(data, h).map(({ potion, count }) => ({
      holder: { id: h.id, name: h.character.name },
      potion: { id: potion.id, name: potion.name, text: potion.text },
      count,
      targets: (potion.effect.kind === 'vanish' ? [h] : members)
        .filter((m) => cannotDrink(w, data, potion, m) === null)
        .map((m) => ({ id: m.id, name: m.character.name })),
    })),
  );
}

/** Lines that can go to someone now: in an encounter, only a Shadow Draught can. */
export const usable = (lines: PotionLine[]) => lines.filter((l) => l.targets.length > 0);
