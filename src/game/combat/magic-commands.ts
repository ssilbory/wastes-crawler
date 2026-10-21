// Spell and art commands (vendor/wwn-srd/2.0 The Rules of the Game/2.4.0 Combat.md): who or what
// a piece of combat magic can be aimed at, and the choices that cast it. Scrolls reuse these.
import type { CombatMagic } from '../../data/schemas/index.ts';
import type { Choice, Command } from './commands.ts';
import { canUse, magicName } from './spells.ts';
import { isUp } from './targeting.ts';
import type { Battle, Combatant } from './types.ts';

/** A combatant's name, with its slot when it's a monster that may share the name. */
export function describe(c: Combatant): string {
  return c.kind === 'monster' ? `${c.name} [${c.row + 1}-${c.column + 1}]` : c.name;
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

export function magicCommand(b: Battle, actor: Combatant, m: CombatMagic): Command[] {
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
