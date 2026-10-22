// Scrolls, wands, and staves in a fight (docs/rules-adaptation.md, Potions, scrolls, and magic
// devices: Scrolls and Devices; vendor/wwn-srd/4.0 Magic and Spellcasting/4.9.0 Magic Items and
// Enchanted Treasures.md, 4.9.1 and 4.9.4). Anyone grasping a Readied scroll or wand can spend a
// Main Action to release its spell; a staff answers only to a caster. The spell goes off at the
// maker's caster level and costs the user no slots or Effort; a scroll is used up, and a wand or
// staff spends a charge and crumbles with its last. A user whose Magic skill is more than one below
// the spell's level rolls Int/Magic or Cha/Magic against 8 plus the level: missing by 1 or 2 the
// spell fizzles, and by more it strikes a random one of its targets.
import type { CombatMagic } from '../../data/schemas/index.ts';
import { skillCheck } from '../../rules/checks.ts';
import { findItem, lineLabel, type InventoryEntry } from '../character/items.ts';
import { heldSpells } from '../character/spell-items.ts';
import { putLine, takeLine } from '../character/stacks.ts';
import type { Choice, Command } from './commands.ts';
import { say } from './log.ts';
import { magicCommand } from './magic-commands.ts';
import { spellLevel } from './spell-level.ts';
import { castMagic, combatMagic, magicName } from './spells.ts';
import type { Action, Battle, CasterState, Combatant } from './types.ts';

type Invoke = Extract<Action, { kind: 'invoke' }>;

/** A Readied scroll, wand, or staff the actor can use now, with the spells it holds. */
export function heldMagicAt(
  b: Battle,
  actor: Combatant,
  index: number,
): { line: InventoryEntry; spells: CombatMagic[]; scroll: boolean } | null {
  const line = actor.character?.inventory[index];
  if (!line || line.location !== 'readied') return null;
  const item = findItem(b.data, line.id);
  const device = item?.kind === 'device' ? item.device.device.kind : null;
  if (item?.kind !== 'scroll' && device !== 'wand' && device !== 'staff') return null;
  // A staff answers only to a caster (Sam's call).
  if (device === 'staff' && !actor.caster) return null;
  // Held spells are game spells, so the combat magic that matches them is spells, never arts.
  const spells = heldSpells(line).flatMap((id) => combatMagic(b, id) ?? []);
  return spells.length > 0 ? { line, spells, scroll: item?.kind === 'scroll' } : null;
}

/** The item's own casting: its spell at the maker's level, the user's Magic and wits. */
function heldCaster(actor: Combatant, line: InventoryEntry, spell: string): CasterState {
  return {
    level: line.casterLevel as number,
    effortMax: 0,
    effortUsed: 0,
    effortDay: 0,
    spellsLeft: 1,
    pointsLeft: 0,
    prepared: [spell],
    known: [spell],
    arts: [],
    magicSkill: actor.skills.magic ?? 0,
    castModifier: Math.max(actor.modifiers.int, actor.modifiers.cha),
    canCast: true,
    armorFree: [],
    uses: {},
    castLock: 0,
    usedThisScene: new Set(),
  };
}

/** Runs `fn` with the item standing in for the user's own magic, then gives it back. */
function withHeld<T>(actor: Combatant, line: InventoryEntry, spell: string, fn: () => T): T {
  const own = actor.caster;
  actor.caster = heldCaster(actor, line, spell);
  try {
    return fn();
  } finally {
    actor.caster = own;
  }
}

/** Every way the item at `item` can be used now, as invoke actions. */
function heldChoices(b: Battle, actor: Combatant, item: number): Choice[] {
  const h = heldMagicAt(b, actor, item);
  if (!h) return [];
  const many = h.spells.length > 1;
  return h.spells.flatMap((m) =>
    withHeld(actor, h.line, m.id, () => magicCommand(b, actor, m)).flatMap((cmd) =>
      cmd.choices.map((ch): Choice => {
        // magicCommand only builds casts, and never strain casts with the item's slot to pay.
        const a = ch.action as Extract<Action, { kind: 'cast' }>;
        const where = {
          ...(a.target !== undefined ? { target: a.target } : {}),
          ...(a.row !== undefined ? { row: a.row } : {}),
        };
        const label = many ? `${magicName(b, m.id)}: ${ch.label}` : ch.label;
        return { ...ch, label, action: { kind: 'invoke', item, spell: m.id, ...where } };
      }),
    ),
  );
}

/** The scrolls-and-devices command: one choice per readied item, spell, and target. */
export function heldMagicCommand(b: Battle, actor: Combatant): Command | null {
  const choices = (actor.character?.inventory ?? []).flatMap((e, item) =>
    heldChoices(b, actor, item).map((ch) => ({
      ...ch,
      label: `${lineLabel(b.data, e)}: ${ch.label}`,
    })),
  );
  return choices.length > 0
    ? { key: 'invoke', group: 'magic', label: 'Scrolls and devices', choices }
    : null;
}

const same = (a: Invoke, b: Action) =>
  b.kind === 'invoke' &&
  a.item === b.item &&
  a.spell === b.spell &&
  a.target === b.target &&
  a.row === b.row;

/** A scroll is used up; a wand or staff spends a charge and crumbles with its last. */
function spend(actor: Combatant, item: number, scroll: boolean): void {
  const c = actor.character as NonNullable<Combatant['character']>;
  const { taken, rest } = takeLine(c.inventory, item, 1);
  const left = (taken.charges ?? 0) - 1;
  const inventory = scroll || left <= 0 ? rest : putLine(rest, { ...taken, charges: left });
  actor.character = { ...c, inventory };
}

/** Uses the item: nothing happens unless the action is one of its choices. */
export function invokeHeld(b: Battle, actor: Combatant, action: Invoke): void {
  const choices = heldChoices(b, actor, action.item);
  if (!choices.some((ch) => same(action, ch.action))) return;
  const { line, scroll } = heldMagicAt(b, actor, action.item) as NonNullable<
    ReturnType<typeof heldMagicAt>
  >;
  spend(actor, action.item, scroll);
  say(b, `${actor.name} ${scroll ? 'reads' : 'raises'} ${lineLabel(b.data, line)}.`);
  if (!scroll && (line.charges as number) <= 1) say(b, 'Its last charge spent, it crumbles.');
  const rules = b.data.content.scrolls.read;
  const level = spellLevel(b, action.spell);
  const magicSkill = actor.skills[rules.skill];
  let aim: Invoke = action;
  if ((magicSkill ?? -1) < level - 1) {
    const difficulty = rules.difficulty + level;
    const check = skillCheck(b.rng, {
      skill: magicSkill ?? null,
      attributeModifier: Math.max(...rules.attributes.map((a) => actor.modifiers[a])),
      difficulty,
    });
    if (!check.success && difficulty - check.score <= rules.fizzle) {
      say(b, 'The spell fizzles.');
      return;
    }
    if (!check.success) {
      const own = choices.filter((ch) => (ch.action as Invoke).spell === action.spell);
      aim = (own[b.rng.int(0, own.length - 1)] as Choice).action as Invoke;
      say(b, `The spell twists loose of ${actor.name}'s grasp.`);
    }
  }
  withHeld(actor, line, action.spell, () => castMagic(b, actor, action.spell, aim.target, aim.row));
}
