// Foci that add a skill's level to damage, such as Armsmaster and Deadeye. They don't stack: on a
// thrown weapon both fit, and only the better counts (vendor/wwn-srd/1.0 Character Creation/1.6.0
// Foci.md, Armsmaster and Deadeye).
import type { AttackMode, FocusEffect } from '../../data/schemas/index.ts';

type AddsSkill = Extract<FocusEffect, { kind: 'damage-adds-skill' }>;

/** What the best fitting focus adds to an attack's damage, and to its Shock if it says so. */
export function bestSkillDamage(
  effects: readonly FocusEffect[],
  mode: AttackMode,
  unarmed: boolean,
  skills: Record<string, number>,
): { damage: number; shock: number } {
  const worth = (e: AddsSkill) => skills[e.skill] ?? 0;
  const best = effects
    .filter(
      (e): e is AddsSkill =>
        e.kind === 'damage-adds-skill' && e.modes.includes(mode) && !(e.excludesUnarmed && unarmed),
    )
    .reduce<AddsSkill | undefined>(
      (top, e) => (top && worth(top) >= worth(e) ? top : e),
      undefined,
    );
  if (!best) return { damage: 0, shock: 0 };
  return { damage: worth(best), shock: best.shock ? worth(best) : 0 };
}
