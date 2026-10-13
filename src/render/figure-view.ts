// Which figure stands in a fight slot (docs/presentation-plan.md, V3). A monster is drawn as the
// figure its combat entry names; a character is put together from its people's look, its armor,
// the weapon it fights with first, and its shield. Presentation only: nothing here is a rule. The
// figures themselves are SVG in src/ui/arena/Figures.tsx.
import type { Held, MonsterFigure, PeopleLook } from '../data/schemas/index.ts';
import type { GameData } from '../game/character/context.ts';
import type { Combatant } from '../game/combat/types.ts';

export type FigureView =
  | {
      kind: 'monster';
      shape: MonsterFigure;
      /** Bigger than a man: drawn to fill its slot. */
      large: boolean;
    }
  | {
      kind: 'person';
      body: PeopleLook['body'];
      head: PeopleLook['head'];
      /** Medium or heavy armor, a caster's robe, or a traveller's cloak. */
      garb: 'armor' | 'robe' | 'cloak';
      held: Held;
      shield: boolean;
    };

/** Armor at this AC or better reads as armor rather than clothes (medium and heavy, SRD 3.4.1). */
export const ARMORED_AC = 14;

const PLAIN: PeopleLook = { body: 'standard', head: 'plain' };

/** A monster's figure from its combat entry, or a best guess from its tags when it has none. */
function monsterFigure(data: GameData, c: Combatant, id: string | null): FigureView {
  const entry = id ? data.content.monsterCombat.find((m) => m.id === id) : undefined;
  const shape = entry?.figure ?? (c.tags.has('humanoid') ? 'soldier' : 'beast');
  return { kind: 'monster', shape, large: c.tags.has('large') };
}

export function figureOf(data: GameData, c: Combatant): FigureView {
  if (c.kind === 'monster') return monsterFigure(data, c, c.monster ?? c.summoned?.monster ?? null);
  const ch = c.character;
  // A Skinshifter in a beast's form (1.5.15).
  const form = c.form === null ? undefined : ch?.forms?.[c.form];
  if (form && !form.humanoid) return { kind: 'monster', shape: 'beast', large: false };
  const look = data.content.peoples.find((p) => p.id === ch?.people)?.look ?? PLAIN;
  const armor = c.acInput?.armorAc ?? null;
  const garb = armor !== null && armor >= ARMORED_AC ? 'armor' : c.caster ? 'robe' : 'cloak';
  const weapon = c.attacks[0]?.id;
  const held = (weapon && data.content.equipmentRules.held[weapon]) || 'fist';
  return { kind: 'person', ...look, garb, held, shield: c.shield };
}
