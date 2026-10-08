// The command menu: every action a combatant can legally take right now, with its targets. Combat
// actions follow vendor/wwn-srd/2.0 The Rules of the Game/2.4.3 Combat Actions.md; moving rows is
// the Formation rules' "Moving rows" in docs/rules-adaptation.md.
import { shiftChoices } from './forms.ts';
import { lineLabel } from '../character/items.ts';
import { afterMove } from './gear.ts';
import type { CombatMagic } from '../../data/schemas/index.ts';
import { ROW_SLOTS } from '../../rules/formation.ts';
import { canUse, magicName } from './spells.ts';
import { isUp, targets } from './targeting.ts';
import type { Action, Battle, Combatant } from './types.ts';
import { inSlot } from './mounted.ts';

export type CommandGroup = 'attack' | 'magic' | 'defend' | 'aid' | 'gear' | 'move' | 'wait';

export interface Choice {
  label: string;
  /** The combatant the choice targets, for highlighting it on the field. */
  targetId?: string;
  action: Action;
}

export interface Command {
  key: string;
  group: CommandGroup;
  label: string;
  /** One choice per target; a single untargeted choice for commands without one. */
  choices: Choice[];
}

/** A combatant's name, with its slot when it's a monster that may share the name. */
export function describe(c: Combatant): string {
  return c.kind === 'monster' ? `${c.name} [${c.row + 1}-${c.column + 1}]` : c.name;
}

const ROW_NAMES = ['Front', 'Rear'];

function attackCommands(b: Battle, actor: Combatant): Command[] {
  return actor.attacks.flatMap((attack, index) => {
    const choices = targets(b, actor, attack).map((t) => ({
      label: describe(t),
      targetId: t.id,
      action: { kind: 'attack' as const, attack: index, target: t.id },
    }));
    if (choices.length === 0) return [];
    const label = attack.mode === 'thrown' ? `${attack.name} (thrown)` : attack.name;
    return [{ key: `attack:${index}`, group: 'attack' as const, label, choices }];
  });
}

/** Targets for a spell or art: combatants, row numbers, or 'all' for a whole side. */
function magicTargets(b: Battle, actor: Combatant, m: CombatMagic): (Combatant | number | 'all')[] {
  const foes = b.combatants.filter((c) => c.side !== actor.side && isUp(c));
  const allies = b.combatants.filter((c) => c.side === actor.side && isUp(c));
  switch (m.target) {
    case 'enemies':
    case 'allies':
    case 'place':
      return ['all'];
    // Extirpate Arcana and Scorn the Fetters of Earth: anyone not dead or gone.
    case 'any':
      return b.combatants.filter((c) => c.status !== 'dead' && c.status !== 'fled');
    case 'wounded-ally':
      return b.combatants.filter(
        (c) =>
          c.side === actor.side &&
          (c.status === 'dying' || c.status === 'stable' || (isUp(c) && c.hp < c.maxHp)),
      );
    case 'enemy':
      return foes;
    case 'enemy-row':
      return [...new Set(foes.map((f) => f.row))].sort();
    case 'ally':
      return allies;
    case 'ally-not-self':
      return allies.filter((a) => a.id !== actor.id);
    case 'self':
      return [actor];
    case 'none':
      return [];
  }
}

function magicCommand(b: Battle, actor: Combatant, m: CombatMagic): Command[] {
  // Smite the Wicked rides on an attack instead (smiteCommands).
  if (m.effect.kind === 'smite-wicked') return [];
  const choices = magicTargets(b, actor, m).flatMap((t): Choice[] => {
    if (t === 'all')
      return canUse(b, actor, m)
        ? [
            {
              label: m.target === 'place' ? 'Cast it' : 'Everyone',
              action: { kind: 'cast', magic: m.id },
            },
          ]
        : [];
    const target = typeof t === 'number' ? undefined : t;
    const base = target
      ? { label: describe(target), targetId: target.id }
      : { label: `Row ${(t as number) + 1}` };
    const where = target ? { target: target.id } : { row: t as number };
    if (canUse(b, actor, m, false, target?.id))
      return [{ ...base, action: { kind: 'cast', magic: m.id, ...where } }];
    if (m.source === 'spell' && canUse(b, actor, m, true, target?.id))
      return [
        {
          ...base,
          label: `${base.label} (strain)`,
          action: { kind: 'cast', magic: m.id, ...where, strain: true },
        },
      ];
    return [];
  });
  if (choices.length === 0) return [];
  return [{ key: `magic:${m.id}`, group: 'magic', label: magicName(b, m.id), choices }];
}

/** Each attack again with Smite the Wicked, on the targets it hasn't been used on this scene. */
function smiteCommands(b: Battle, actor: Combatant): Command[] {
  const smite = b.data.content.combatMagic.find((m) => m.effect.kind === 'smite-wicked');
  if (!smite || !actor.caster?.arts.includes(smite.id)) return [];
  return actor.attacks.flatMap((attack, index) => {
    const choices = targets(b, actor, attack)
      .filter((t) => canUse(b, actor, smite, false, t.id))
      .map((t) => ({
        label: describe(t),
        targetId: t.id,
        action: { kind: 'attack' as const, attack: index, target: t.id, smite: true as const },
      }));
    if (choices.length === 0) return [];
    const label = `${attack.name} with ${magicName(b, smite.id)}`;
    return [{ key: `smite:${index}`, group: 'attack' as const, label, choices }];
  });
}

function moveChoices(b: Battle, actor: Combatant): Choice[] {
  if (b.layout[actor.side] !== 'formation') return [];
  const taken = (row: number, column: number) =>
    b.combatants.some(
      (c) => c.side === actor.side && inSlot(c) && c.row === row && c.column === column,
    );
  return [0, 1].flatMap((row) =>
    Array.from({ length: ROW_SLOTS }, (_, column) => column)
      .filter((column) => !taken(row, column))
      .map((column) => ({
        label: `${ROW_NAMES[row] as string} row, slot ${column + 1}`,
        action: { kind: 'move' as const, row, column },
      })),
  );
}

export function commandsFor(b: Battle, actor: Combatant): Command[] {
  // In Wind Walking's mist there is nothing to do but take form again (4.5.0).
  if (actor.misted) {
    const solid = { kind: 'end-mist' as const };
    return [
      {
        key: 'end-mist',
        group: 'defend',
        label: 'Take form again',
        choices: [{ label: 'Take form again', action: solid }],
      },
    ];
  }
  const commands = attackCommands(b, actor);
  const c = actor.caster;
  if (c) {
    commands.push(...smiteCommands(b, actor));
    for (const m of b.data.content.combatMagic) {
      // Armor blocks all but the arts that work in it (Phase 14d).
      const has =
        m.source === 'art'
          ? c.arts.includes(m.id) && (c.canCast || c.armorFree.includes(m.id))
          : c.canCast && c.known.includes(m.id);
      if (has) commands.push(...magicCommand(b, actor, m));
    }
  }
  const shapes = shiftChoices(actor);
  if (shapes.length > 0)
    commands.push({ key: 'shift', group: 'magic', label: 'Change form', choices: shapes });
  const one = (key: string, group: Command['group'], label: string, action: Action): Command => ({
    key,
    group,
    label,
    choices: [{ label, action }],
  });
  commands.push(one('total-defense', 'defend', 'Total Defense', { kind: 'total-defense' }));
  const dying = b.combatants.filter(
    (d) =>
      d.side === actor.side && d.status === 'dying' && !d.amber && !b.stabilizedThisRound.has(d.id),
  );
  if (dying.length > 0) {
    commands.push({
      key: 'stabilize',
      group: 'aid',
      label: 'Stabilize',
      choices: dying.map((d) => ({
        label: d.name,
        targetId: d.id,
        action: { kind: 'stabilize', target: d.id },
      })),
    });
  }
  // Ready or Stow an Item (SRD 2.4.0), a Main Action, for a PC's gear in hand or in the pack.
  // Only moves that will be made are offered, so a refusal never wastes the action.
  const gear = (actor.character?.inventory ?? []).flatMap((e, item): Choice[] => {
    const location = e.location === 'readied' ? ('stowed' as const) : ('readied' as const);
    if (!afterMove(b, actor, item, location)) return [];
    const label = `${location === 'readied' ? 'Ready' : 'Stow'} ${lineLabel(b.data, e)}`;
    return [{ label, action: { kind: 'gear', item, location } }];
  });
  if (gear.length > 0)
    commands.push({ key: 'gear', group: 'gear', label: 'Ready or stow', choices: gear });
  const moves = moveChoices(b, actor);
  if (moves.length > 0)
    commands.push({ key: 'move', group: 'move', label: 'Change slot', choices: moves });
  commands.push(one('wait', 'wait', 'Wait', { kind: 'wait' }));
  return commands;
}

/** Whether an action is one of the actor's current choices. */
export function isLegal(b: Battle, actor: Combatant, action: Action): boolean {
  const wanted = JSON.stringify(action);
  return commandsFor(b, actor).some((c) =>
    c.choices.some((ch) => JSON.stringify(ch.action) === wanted),
  );
}
