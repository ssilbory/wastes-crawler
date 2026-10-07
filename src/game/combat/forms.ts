// A Skinshifter's forms in a fight (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.15
// The Skinshifter.md; docs/rules-adaptation.md, The Skinshifter). Change Form is a Main Action for
// Effort for the day; going back to one's own shape is On Turn, and so is one change a round with
// Pliant Flesh, which also heals. Serpent's Kiss adds venom to a Savage Talons hit.
import type { Character } from '../../data/schemas/index.ts';
import { roll } from '../../rules/dice.ts';
import { pliantHeal, shiftedHp } from '../../rules/forms.ts';
import { shiftCharacter } from '../character/shift.ts';
import { pcCombatant } from './combatants.ts';
import { say } from './log.ts';
import type { Action, Attack, Battle, CasterState, Combatant } from './types.ts';

const PLIANT = 'pliant-flesh';
const pliantKey = (b: Battle) => `${PLIANT}:${b.round}`;
const formsOf = (actor: Combatant) => actor.character?.forms ?? [];
const wornForm = (actor: Combatant) =>
  actor.form === null ? undefined : formsOf(actor)[actor.form];

/** Whether the actor can take `form` now; null is their own shape. */
export function canShift(actor: Combatant, form: number | null): boolean {
  const c = actor.caster;
  if (!c?.arts.includes('change-form')) return false;
  if (form === null) return actor.form !== null;
  if (!formsOf(actor)[form] || actor.form === form) return false;
  return (c.canCast || c.armorFree.includes('change-form')) && c.effortUsed < c.effortMax;
}

/** Whether any shift this turn could leave the Main Action, so the turn asks for one first. */
export const mayShiftFree = (b: Battle, actor: Combatant): boolean =>
  canShift(actor, null) ||
  formsOf(actor).some((_, i) => freeShift(b, actor, { kind: 'shift', form: i }));

/** A shift that leaves the turn's Main Action: going back, or Pliant Flesh's once a round. */
export function freeShift(b: Battle, actor: Combatant, action: Action): boolean {
  if (action.kind !== 'shift' || !canShift(actor, action.form)) return false;
  const c = actor.caster as CasterState;
  return action.form === null || (c.arts.includes(PLIANT) && !c.usedThisScene.has(pliantKey(b)));
}

export function shift(b: Battle, actor: Combatant, form: number | null): void {
  if (!canShift(actor, form)) return;
  const c = actor.caster as CasterState;
  const before = actor.character as Character;
  const next = pcCombatant(b.data, before, actor.id, form);
  // Feral Prowess's hit points come and go with the form.
  const hp = shiftedHp(
    { max: actor.maxHp, current: actor.hp },
    actor.hitDice,
    next.modifiers.con - actor.modifiers.con,
  );
  const character = shiftCharacter(b.data, before, actor.form, form);
  Object.assign(actor, {
    form,
    character: { ...character, hp: { ...character.hp, max: hp.max } },
    maxHp: hp.max,
    hp: hp.current,
    ac: next.ac,
    acInput: next.acInput,
    attacks: next.attacks,
    saves: next.saves,
    modifiers: next.modifiers,
    healModifier: next.healModifier,
  });
  // Feral Prowess on Con and Sculptor's Beauty can move the Effort ceiling and the casting bonus.
  const fresh = next.caster as CasterState;
  Object.assign(c, { effortMax: fresh.effortMax, castModifier: fresh.castModifier });
  const shape = wornForm(actor);
  if (!shape) {
    say(b, `${actor.name} returns to their own shape.`);
    return;
  }
  c.effortUsed += 1;
  c.effortDay += 1;
  say(b, `${actor.name} takes the ${shape.name} form.`);
  if (!c.arts.includes(PLIANT)) return;
  c.usedThisScene.add(pliantKey(b));
  if (actor.hp >= actor.maxHp) return;
  const healed = Math.min(
    actor.maxHp - actor.hp,
    pliantHeal(roll(b.rng, { count: 1, sides: 6, modifier: 0 }).total, actor.hitDice),
  );
  actor.hp += healed;
  say(b, `${actor.name}'s flesh knits as it changes: ${healed} hit points.`);
}

/** Change Form's command: each other form, and back to one's own shape. */
export function shiftChoices(actor: Combatant): { label: string; action: Action }[] {
  const forms = formsOf(actor).flatMap((f, i) =>
    canShift(actor, i)
      ? [{ label: `${f.name} form`, action: { kind: 'shift', form: i } as Action }]
      : [],
  );
  const back: Action = { kind: 'shift', form: null };
  return canShift(actor, null) ? [...forms, { label: 'Own shape', action: back }] : forms;
}

/** The AI takes its first form as soon as it can. */
export function shiftAction(actor: Combatant): Action | null {
  return actor.form === null && canShift(actor, 0) ? { kind: 'shift', form: 0 } : null;
}

/**
 * Serpent's Kiss: a Savage Talons hit that stands, for Effort for the scene, does 1d8 plus Survive
 * more, except to the immune to poison.
 */
export function venom(b: Battle, actor: Combatant, attack: Attack, target: Combatant): number {
  if (attack.id !== 'savage-talons' || !wornForm(actor)?.arts.includes('serpents-kiss')) return 0;
  // Wearing a form takes Change Form, so the actor is a caster.
  const c = actor.caster as CasterState;
  if (target.poisonImmune || c.effortUsed >= c.effortMax) return 0;
  c.effortUsed += 1;
  const extra =
    roll(b.rng, { count: 1, sides: 8, modifier: 0 }).total + (actor.skills.survive ?? 0);
  say(b, `${actor.name}'s venom burns for ${extra} more.`);
  return extra;
}
