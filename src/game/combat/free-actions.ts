// On Turn and Instant magic taken before the main action (vendor/wwn-srd/4.0 Magic and Spellcasting/
// 4.1.0 Spells and Arts.md, On Turn actions), whoever commands the turn: Pavis of
// Elements, Armor of God when it beats the armor worn, God Wills It in a hard fight (Phase 14c),
// Swift Healer (Phase 14d), and from Phase 15 the sight arts in a dark fight, Steps of Air for an
// ally who can't reach a foe, Sanctified Ward when hurt, Swift Casting, and the arts in arts.ts;
// and the Beastmaster's Savage Senses and Beast Ward (1.5.4).
import { enemiesOf, magicAction } from './ai.ts';
import { acWith } from './damage.ts';
import { turnArts } from './arts.ts';
import { artReady, spendDay } from './reactions.ts';
import { canUse, castMagic, combatMagic } from './spells.ts';
import { canAct, flying, targets } from './targeting.ts';
import type { Battle, CasterState, Combatant } from './types.ts';

const SIGHT = [
  'the-light-of-faith',
  'sense-magic',
  'earthsight',
  'flamesight',
  'gravesight',
  'healers-eye',
  // Savage Senses (1.5.4).
  'savage-senses',
];

export function freeActions(b: Battle, actor: Combatant): void {
  const c = actor.caster;
  if (!c) return;
  const cast = (id: string, target?: string) => {
    const m = combatMagic(b, id);
    if (!m || !canUse(b, actor, m, false, target)) return false;
    return castMagic(b, actor, id, target, undefined);
  };
  // Sight arts in a dark fight; Light of Faith first, as it lights the whole party.
  if (b.dark && !actor.seesInDark) SIGHT.some((id) => cast(id, actor.id));
  if (actor.acBonus === 0) cast('pavis-of-elements', actor.id);
  // Beast Ward while unprovoked beasts stand among the foes (1.5.4).
  if (!actor.beastWard && enemiesOf(b, actor).some((f) => f.beast && !f.provoked))
    cast('beast-ward', actor.id);
  const armor = combatMagic(b, 'armor-of-god');
  if (
    armor?.effect.kind === 'ac-floor' &&
    acWith(actor, armor.effect.base + Math.floor(c.level / 2)) > actor.ac
  )
    if (actor.acFloor < armor.effect.base) cast(armor.id, actor.id);
  const hitDice = enemiesOf(b, actor).reduce((sum, f) => sum + f.hitDice, 0);
  const allies = b.combatants.filter((x) => x.side === actor.side && canAct(x));
  if (hitDice >= allies.length) cast('god-wills-it');
  if (!actor.sanctified && actor.hp * 2 <= actor.maxHp) cast('sanctified-ward', actor.id);
  swiftHealer(b, actor, c);
  // Steps of Air for an ally whose melee blows reach no one.
  const grounded = allies.find((x) => {
    const melee = x.attacks.filter((a) => a.mode === 'melee');
    return !flying(x) && melee.length > 0 && melee.every((a) => targets(b, x, a).length === 0);
  });
  if (grounded) cast('steps-of-air', grounded.id);
  turnArts(b, actor);
  swiftCasting(b, actor, c);
}

/** Swift Healer: Healing Touch On Turn for the dying or an ally at half their hit points or
 * less, the caster's level in times per rest. */
function swiftHealer(b: Battle, actor: Combatant, c: CasterState): void {
  const touch = combatMagic(b, 'healing-touch');
  if (!touch || !c.arts.includes('swift-healer') || (c.uses['swift-healer'] ?? 0) >= c.level)
    return;
  const hurt = b.combatants.find(
    (x) =>
      x.side === actor.side &&
      (x.status === 'dying' || (canAct(x) && x.hp * 2 <= x.maxHp)) &&
      canUse(b, actor, touch, false, x.id),
  );
  if (!hurt) return;
  c.uses['swift-healer'] = (c.uses['swift-healer'] ?? 0) + 1;
  castMagic(b, actor, touch.id, hurt.id, undefined);
}

/**
 * Swift Casting (1.5.10): once a scene, Effort for the day casts the spell the caster would cast
 * as an On Turn action; no other spell that round.
 */
function swiftCasting(b: Battle, actor: Combatant, c: CasterState): void {
  if (!canAct(actor) || c.usedThisScene.has('swift-casting') || !artReady(actor, 'swift-casting'))
    return;
  const action = magicAction(b, actor);
  if (action?.kind !== 'cast' || combatMagic(b, action.magic)?.source !== 'spell') return;
  spendDay(c);
  c.usedThisScene.add('swift-casting');
  castMagic(b, actor, action.magic, action.target, action.row, action.strain);
  c.castLock = b.round;
}
