// High Magic in combat (Phase 18a): what each spell does when cast, from its text in
// vendor/wwn-srd/4.0 Magic and Spellcasting/4.4.0 High Magic Spells by Level.md. Areas of 20 to 40
// feet strike one row; the Prismatic Hemicycle and Phobic Storm reach every foe
// (docs/rules-adaptation.md, High Magic in combat). Lasting conditions play out in conditions.ts.
import type { CombatEffect, Dice } from '../../data/schemas/index.ts';
import { moraleHolds } from '../../rules/combat.ts';
import { servantPlace } from '../../rules/formation.ts';
import { roll, rollDie } from '../../rules/dice.ts';
import type { SaveType } from '../../rules/saves.ts';
import { harm, save, say } from './damage.ts';
import { monsterCombatant } from './monster-combatant.ts';
import { dispel } from './conditions.ts';
import { flying, inLine, isUp } from './targeting.ts';
import type { Battle, CasterState, Combatant } from './types.ts';

/** A foe's save against the caster's magic, with the caster's arts that sharpen it. */
export type Resists = (target: Combatant, type: SaveType, modifier?: number) => boolean;

/** Rounds that last the whole scene. */
const SCENE = 100;

/** The caster's foes standing in one row. */
const rowOf = (b: Battle, actor: Combatant, row: number | undefined) =>
  b.combatants.filter((c) => c.side !== actor.side && c.row === row && isUp(c));
const foesOf = (b: Battle, actor: Combatant) =>
  b.combatants.filter((c) => c.side !== actor.side && isUp(c));
/** `perLevel` dice for every `per` caster levels, at least one set. */
const scaled = (d: Dice, level: number, per = 1): Dice => ({
  ...d,
  count: d.count * Math.max(1, Math.floor(level / per)),
});

type Effect<K extends CombatEffect['kind']> = Extract<CombatEffect, { kind: K }>;

function burst(
  b: Battle,
  actor: Combatant,
  e: Effect<'burst'>,
  row: number | undefined,
  level: number,
  resists: Resists,
): void {
  const victims = rowOf(b, actor, row).filter(
    (t) =>
      (!e.requiresTag || t.tags.has(e.requiresTag)) && !(e.livingOnly && t.tags.has('unliving')),
  );
  const total = roll(b.rng, scaled(e.perLevel, level, e.levelsPerDie)).total;
  for (const t of victims) {
    if (t.kind === 'monster' && t.hitDice <= e.slayHitDice) {
      say(b, `${t.name} is destroyed.`);
      harm(b, t, t.hp);
      continue;
    }
    const saved = resists(t, e.save);
    harm(b, t, saved ? Math.floor(total / 2) : total);
    if (!saved && e.rootOnFail && isUp(t)) {
      t.rootedRounds = Math.max(t.rootedRounds, roll(b.rng, e.rootOnFail).total);
      say(b, `${t.name} is numbed by the cold.`);
    }
  }
  if (e.backlash && !save(b, actor, e.backlash).success) {
    say(b, `The ruin lashes back at ${actor.name}.`);
    harm(b, actor, Math.ceil(total / 4));
  }
}

function fear(b: Battle, actor: Combatant, e: Effect<'fear'>, level: number): void {
  for (const t of foesOf(b, actor).filter((x) => x.status === 'active' && x.morale < 12)) {
    if (!moraleHolds(b.rng, t.morale - e.penalty)) {
      t.status = 'fled';
      say(b, `${t.name} flees in terror.`);
    } else if (t.hp <= level) {
      t.hp = 1;
      t.status = 'fled';
      say(b, `${t.name} breaks in despair and flees.`);
    } else harm(b, t, level);
  }
}

function skyward(
  b: Battle,
  actor: Combatant,
  e: Effect<'skyward'>,
  target: Combatant,
  level: number,
): void {
  if (target.side === actor.side) {
    const allies = inLine(b.combatants.filter((x) => x.side === actor.side && isUp(x)));
    for (const x of allies.slice(0, level + 1)) x.flyingRounds = SCENE;
    say(b, `${actor.name}'s side walks up into the air.`);
    return;
  }
  const penalty = actor.skills[e.penaltySkill] ?? 0;
  const flyers = foesOf(b, actor).filter(flying);
  const first = flyers.filter((x) => x === target);
  for (const x of [...first, ...flyers.filter((y) => y !== target)].slice(0, level)) {
    if (save(b, x, e.save, -penalty).success) continue;
    x.tags.delete('flying');
    x.flyingRounds = 0;
    say(b, `${x.name} is dragged down to the earth.`);
  }
}

function summon(b: Battle, actor: Combatant, e: Effect<'summon'>): void {
  const mine = (c: Combatant) => c.summoned?.by === actor.id && c.summoned.monster === e.monster;
  if (e.one && b.combatants.some((c) => mine(c) && isUp(c))) {
    say(b, `${actor.name} already has a servant of that kind.`);
    return;
  }
  const side = b.combatants.filter((c) => c.side === actor.side);
  const formation = b.layout[actor.side] === 'formation';
  const place = formation
    ? servantPlace(side.map((c) => ({ ...c, yields: isUp(c) && !c.summoned && !c.servant })))
    : { row: 0, column: b.combatants.length, bump: null };
  if (!place) {
    say(b, `There is no room for ${actor.name}'s servant.`);
    return;
  }
  const s = monsterCombatant(b.data, e.monster, `summon-${b.combatants.length}`, b.rng);
  const { bump } = place;
  const bumped = bump ? side[bump.index] : undefined;
  if (bump && bumped) {
    Object.assign(bumped, { row: 1, column: bump.column });
    say(b, `${bumped.name} steps back for ${s.name}.`);
  }
  Object.assign(s, {
    row: place.row,
    column: place.column,
    group: place.row,
    side: actor.side,
    ...(e.hp ? { hp: e.hp, maxHp: e.hp } : {}),
    summoned: { by: actor.id, monster: e.monster },
  });
  b.combatants.push(s);
  say(b, `${actor.name} calls up ${s.name}.`);
}

function banish(b: Battle, actor: Combatant, e: Effect<'banish'>, row: number | undefined): void {
  for (const t of rowOf(b, actor, row)) {
    t.status = 'out';
    if (t.hitDice > e.trappedHitDice && save(b, t, e.save).success) {
      t.returnsRound = b.round + 1;
      say(b, `${t.name} vanishes into the black glass maze, but finds the way back.`);
    } else say(b, `${t.name} vanishes into the black glass maze.`);
  }
}

const PRISMATIC: Record<number, (b: Battle, t: Combatant) => void> = {
  1: (b, t) => say(b, `${t.name} is bathed in the colors, unharmed.`),
  2: (b, t) => {
    say(b, `${t.name} collapses into dust.`);
    harm(b, t, t.hp);
  },
  3: (b, t) => {
    t.status = 'out';
    say(b, `${t.name} falls unconscious.`);
  },
  4: (b, t) => {
    t.berserk = true;
    say(b, `${t.name} goes violently mad.`);
  },
  5: (b, t) => {
    t.status = 'out';
    say(b, `${t.name} turns to stone.`);
  },
  6: (b, t) => {
    t.status = 'out';
    t.spellbound = true;
    say(b, `${t.name} is enthralled.`);
  },
};

/** A High Magic spell's effect; false for any other effect. */
export function highMagicEffect(
  b: Battle,
  actor: Combatant,
  e: CombatEffect,
  target: Combatant | undefined,
  row: number | undefined,
  resists: Resists,
): boolean {
  const level = (actor.caster as CasterState).level;
  switch (e.kind) {
    case 'burst':
      burst(b, actor, e, row, level, resists);
      return true;
    case 'step':
      if (!target) return true;
      if (!resists(target, e.save)) {
        target.status = 'out';
        say(b, `${target.name} vanishes, sent half a mile away.`);
      } else {
        actor.status = 'out';
        say(b, `${target.name} resists, and ${actor.name} is sent away instead.`);
      }
      return true;
    case 'mantle':
      if (target) target.mantle = { bonus: level, damage: e.damage, save: e.save };
      return true;
    case 'echo': {
      const until = b.round + roll(b.rng, e.rounds).total - 1;
      const allies = inLine(b.combatants.filter((x) => x.side === actor.side && isUp(x)));
      for (const x of allies.slice(0, level)) x.echo = { until, strain: e.strain };
      return true;
    }
    case 'dispel':
      if (target) dispel(b, target);
      return true;
    case 'fear':
      fear(b, actor, e, level);
      return true;
    case 'skyward':
      if (target) skyward(b, actor, e, target, level);
      return true;
    case 'torment':
      // Only a living creature can be tormented (4.4.0).
      if (target && !target.tags.has('unliving')) {
        target.torment = {
          damage: e.perLevel * level,
          lasting: target.hitDice < level,
          tried: false,
          round: 0,
        };
        say(b, `${target.name} is smitten with boils and tumors.`);
      }
      return true;
    case 'shatter': {
      const total = roll(b.rng, e.damage).total;
      say(b, `${actor.name} shatters the glass chimes.`);
      for (const x of b.combatants.filter((c) => c !== actor && isUp(c))) harm(b, x, total);
      return true;
    }
    case 'evert': {
      if (!target) return true;
      if (target.hitDice <= level && !resists(target, 'physical')) {
        say(b, `${target.name} is turned inside out.`);
        harm(b, target, target.hp);
        return true;
      }
      const total = roll(b.rng, scaled(e.perLevel, level)).total;
      harm(b, target, resists(target, e.save) ? Math.floor(total / 2) : total);
      return true;
    }
    case 'gust':
      for (const t of rowOf(b, actor, row).filter((x) => !x.tags.has('large'))) {
        if (save(b, t, e.save).success) continue;
        t.stunned = true;
        say(b, `${t.name} is bowled over by the wind.`);
        harm(b, t, roll(b.rng, e.damage).total);
      }
      return true;
    case 'summon':
      summon(b, actor, e);
      return true;
    case 'banish':
      banish(b, actor, e, row);
      return true;
    case 'prismatic':
      for (const t of foesOf(b, actor)) {
        if (resists(t, e.save)) continue;
        (PRISMATIC[rollDie(b.rng, 6)] as (b: Battle, t: Combatant) => void)(b, t);
      }
      return true;
    case 'abnegation':
      return true;
    default:
      return false;
  }
}
