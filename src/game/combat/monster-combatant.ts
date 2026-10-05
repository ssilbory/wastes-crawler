// SRD monsters as combatants (vendor/wwn-srd/5.0 Monsters and Foes/Monster and NPC Stats.md: 1d8
// hit points per hit die; Wpn damage uses the weapon in data/content/monster-combat.json), with the
// routines, volleys, breath weapons, resistances, and on-hit effects of Phase 14a.
import type { Monster, MonsterCombat, Strike, Weapon } from '../../data/schemas/index.ts';
import { rollDie } from '../../rules/dice.ts';
import type { Rng } from '../../rules/rng.ts';
import { findMonster, type GameData } from '../character/context.ts';
import { findItem } from '../character/items.ts';
import { base } from './combatants.ts';
import { monsterCaster } from './monster-caster.ts';
import type { Attack, Combatant } from './types.ts';

function monsterAttack(m: Monster, weapon: Weapon | undefined, reach: boolean): Attack {
  const damage =
    m.damage.kind === 'dice'
      ? m.damage.dice
      : (weapon?.damage ?? { count: 1, sides: 6, modifier: 0 });
  const bonus = m.damage.kind === 'weapon' ? m.damage.bonus : 0;
  let shock: Attack['shock'] = null;
  if (m.shock?.kind === 'fixed') shock = { damage: m.shock.damage, maxAc: m.shock.maxAc };
  else if (m.shock?.kind === 'weapon' && weapon?.shock) {
    shock = {
      damage: weapon.shock.damage + m.shock.bonus,
      maxAc: m.shock.ignoresAc ? null : weapon.shock.maxAc,
    };
  }
  const ranged = weapon?.range && !weapon.traits.includes('throwable');
  return {
    id: weapon?.id ?? m.id,
    name: weapon?.name ?? 'Natural attack',
    mode: ranged ? 'ranged' : 'melee',
    hit: m.attackBonus,
    damage,
    damageBonus: bonus,
    shock: ranged ? null : shock,
    reach: reach || (weapon?.traits.includes('long') ?? false),
    twoHanded: weapon?.traits.includes('two-handed') ?? false,
    blunt: false,
    onHit: null,
  };
}

/** A routine's or volley's strikes as attacks on the stat line's bonus and Shock. */
function strikes(stat: Attack, list: Strike[], mode: Attack['mode']): Attack[] {
  return list.map((s, i) => ({
    ...stat,
    id: `${stat.id}-${mode}-${i}`,
    name: s.name,
    mode,
    damage: s.damage,
    damageBonus: 0,
    shock: mode === 'melee' ? stat.shock : null,
    onHit: s.onHit ?? null,
  }));
}

/** Indices into the attacks: each strike repeated its count, starting at `from`. */
const swings = (list: Strike[], from: number) =>
  list.flatMap((s, i) => Array<number>(s.count).fill(from + i));

/** The stat line's attack, or the routine and volley built from it, and their swing orders. */
function attacksOf(combat: MonsterCombat | undefined, stat: Attack) {
  const routine = combat?.routine;
  if (!routine) return { attacks: [stat], routine: null, volley: null };
  const melee = strikes(stat, routine, 'melee');
  const volley = combat.volley ? strikes(stat, combat.volley, 'ranged') : [];
  return {
    attacks: [...melee, ...volley],
    routine: swings(routine, 0),
    volley: combat.volley ? swings(combat.volley, melee.length) : null,
  };
}

/** An SRD monster with rolled hit points: 1d8 per hit die. */
export function monsterCombatant(
  data: GameData,
  monsterId: string,
  id: string,
  rng: Rng,
): Combatant {
  const m = findMonster(data, monsterId);
  if (!m) throw new Error(`unknown monster ${monsterId}`);
  const combat = data.content.monsterCombat.find((x) => x.id === monsterId);
  const tags = new Set(combat?.tags ?? []);
  const weaponItem = combat?.weapon ? findItem(data, combat.weapon) : undefined;
  const weapon = weaponItem?.kind === 'weapon' ? weaponItem.weapon : undefined;
  let hp = 0;
  for (let i = 0; i < m.hitDice; i++) hp += rollDie(rng, 8);
  const { attacks, routine, volley } = attacksOf(
    combat,
    monsterAttack(m, weapon, tags.has('reach')),
  );
  return {
    ...base(id, m.name),
    side: 'enemy',
    kind: 'monster',
    hp,
    maxHp: hp,
    ac: m.ac,
    attacks,
    attacksPerRound: m.attacks,
    saves: { physical: m.save, evasion: m.save, mental: m.save, luck: m.save },
    hitDice: m.hitDice,
    skillBonus: m.skill,
    tags,
    sapient: combat?.mind === 'sapient',
    morale: m.morale,
    instinct: m.instinct,
    routine,
    volley,
    breath: combat?.breath ?? null,
    breathLeft: combat?.breath?.uses ?? 0,
    resist: combat?.resist ?? null,
    actsLast: tags.has('slow'),
    subdues: combat?.nonLethal === true,
    // A caster's Magic skill is its skill bonus, for Shackles and Elemental Blast.
    ...(combat?.caster && {
      caster: monsterCaster(data, m, combat.caster),
      skills: { magic: m.skill },
    }),
  };
}
