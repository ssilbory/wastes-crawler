// Reading a scroll in a fight (docs/rules-adaptation.md, Potions, scrolls, and magic devices:
// Scrolls; vendor/wwn-srd/4.0 Magic and Spellcasting/4.9.0 Magic Items and Enchanted Treasures.md,
// 4.9.1). Anyone grasping a Readied scroll can spend a Main Action to release its spell, which goes
// off at the scribe's caster level and costs the reader no slots. A reader whose Magic skill is
// more than one below the spell's level rolls Int/Magic or Cha/Magic against 8 plus the level:
// missing by 1 or 2 the spell fizzles, and by more it strikes a random one of its targets.
import type { CombatMagic } from '../../data/schemas/index.ts';
import { skillCheck } from '../../rules/checks.ts';
import { findItem, lineLabel, type InventoryEntry } from '../character/items.ts';
import { takeLine } from '../character/stacks.ts';
import type { Choice, Command } from './commands.ts';
import { say } from './log.ts';
import { magicCommand } from './magic-commands.ts';
import { spellLevel } from './spell-level.ts';
import { castMagic, combatMagic } from './spells.ts';
import type { Action, Battle, CasterState, Combatant } from './types.ts';

type ScrollAction = Extract<Action, { kind: 'scroll' }>;

/** A Readied scroll line holding a spell the combat engine can cast, with that spell. */
export function scrollAt(
  b: Battle,
  actor: Combatant,
  index: number,
): { line: InventoryEntry; magic: CombatMagic } | null {
  const line = actor.character?.inventory[index];
  if (!line?.spell || line.location !== 'readied') return null;
  if (findItem(b.data, line.id)?.kind !== 'scroll') return null;
  // Scrolls hold game spells, so what combat magic matches is a spell, never an art.
  const magic = combatMagic(b, line.spell);
  return magic ? { line, magic } : null;
}

/** The scroll's own casting: its spell at the scribe's level, the reader's Magic and wits. */
function scrollCaster(actor: Combatant, line: InventoryEntry): CasterState {
  const spell = line.spell as string;
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

/** Runs `fn` with the scroll standing in for the reader's own magic, then gives it back. */
function withScroll<T>(actor: Combatant, line: InventoryEntry, fn: () => T): T {
  const own = actor.caster;
  actor.caster = scrollCaster(actor, line);
  try {
    return fn();
  } finally {
    actor.caster = own;
  }
}

/** Every way the scroll at `item` can be read now, as scroll actions. */
function scrollChoices(b: Battle, actor: Combatant, item: number): Choice[] {
  const s = scrollAt(b, actor, item);
  if (!s) return [];
  return withScroll(actor, s.line, () => magicCommand(b, actor, s.magic)).flatMap((cmd) =>
    cmd.choices.map((ch): Choice => {
      // magicCommand only builds casts, and never strain casts with the scroll's slot to pay.
      const a = ch.action as Extract<Action, { kind: 'cast' }>;
      const where = {
        ...(a.target !== undefined ? { target: a.target } : {}),
        ...(a.row !== undefined ? { row: a.row } : {}),
      };
      return { ...ch, action: { kind: 'scroll', item, ...where } };
    }),
  );
}

/** The Read a scroll command: one choice per readied scroll and target. */
export function scrollCommand(b: Battle, actor: Combatant): Command | null {
  const choices = (actor.character?.inventory ?? []).flatMap((e, item) =>
    scrollChoices(b, actor, item).map((ch) => ({
      ...ch,
      label: `${lineLabel(b.data, e)}: ${ch.label}`,
    })),
  );
  return choices.length > 0
    ? { key: 'scroll', group: 'magic', label: 'Read a scroll', choices }
    : null;
}

const same = (a: ScrollAction, b: Action) =>
  b.kind === 'scroll' && a.item === b.item && a.target === b.target && a.row === b.row;

/** Reads the scroll: nothing happens unless the action is one of its choices. */
export function readScroll(b: Battle, actor: Combatant, action: ScrollAction): void {
  const choices = scrollChoices(b, actor, action.item);
  if (!choices.some((ch) => same(action, ch.action))) return;
  const { line, magic } = scrollAt(b, actor, action.item) as NonNullable<
    ReturnType<typeof scrollAt>
  >;
  const c = actor.character as NonNullable<Combatant['character']>;
  actor.character = { ...c, inventory: takeLine(c.inventory, action.item, 1).rest };
  say(b, `${actor.name} reads ${lineLabel(b.data, line)}.`);
  const rules = b.data.content.scrolls.read;
  const level = spellLevel(b, magic.id);
  const magicSkill = actor.skills[rules.skill];
  let aim: ScrollAction = action;
  if ((magicSkill ?? -1) < level - 1) {
    const difficulty = rules.difficulty + level;
    const check = skillCheck(b.rng, {
      skill: magicSkill ?? null,
      attributeModifier: Math.max(...rules.attributes.map((a) => actor.modifiers[a])),
      difficulty,
    });
    if (!check.success && difficulty - check.score <= rules.fizzle) {
      say(b, `The scroll's spell fizzles.`);
      return;
    }
    if (!check.success) {
      const wild = choices[b.rng.int(0, choices.length - 1)] as Choice;
      aim = wild.action as ScrollAction;
      say(b, `The spell twists loose of ${actor.name}'s grasp.`);
    }
  }
  withScroll(actor, line, () => castMagic(b, actor, magic.id, aim.target, aim.row));
}
