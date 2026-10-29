// Ammo after a fight (docs/rules-adaptation.md, Resource dice and Ammo; Sam's calls): each kind of
// ammo a member shot is rolled once, a used quiver first; a 1 or 2 steps that quiver's die down, and
// stepping below d4 uses it up (src/rules/resource-die.ts).
import type { GameData } from '../character/context.ts';
import { ammoName } from '../character/ammo.ts';
import { putLine, takeLine } from '../character/stacks.ts';
import type { Combatant } from '../combat/types.ts';
import { useResource } from '../../rules/resource-die.ts';
import { note } from './members.ts';
import type { Member, World } from './types.ts';

export function ammoBack(w: World, data: GameData, m: Member, c: Combatant): void {
  for (const ammo of c.shot) {
    const inv = m.character.inventory;
    const used = inv.findIndex((e) => e.id === ammo && e.die !== undefined);
    const index = used >= 0 ? used : inv.findIndex((e) => e.id === ammo);
    if (index < 0) continue;
    const before = inv[index]?.die ?? 12;
    const { die } = useResource(w.rng, before);
    if (die === before) continue;
    const { taken, rest } = takeLine(inv, index, 1);
    const who = `${m.character.name}'s ${ammoName(data, ammo)}`;
    if (die === 0) {
      m.character = { ...m.character, inventory: rest };
      note(w, `${who} run out.`);
    } else {
      // A step down never leaves a full d12.
      const left = die as 4 | 6 | 8 | 10;
      m.character = { ...m.character, inventory: putLine(rest, { ...taken, die: left }) };
      note(w, `${who} run low: d${die} left.`);
    }
  }
}
