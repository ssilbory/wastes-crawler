import { describe, expect, it } from 'vitest';
import { startEncounter } from '../../../src/game/world/encounters.ts';
import { addNpc } from '../../../src/game/world/npcs.ts';
import type { World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng, scriptedThen } from '../../helpers/scripted-rng.ts';
import { beastmaster } from '../beastmaster.ts';
import { data, member, world } from './helpers.ts';

const rolled = { rows: [['thug-or-militia']], nature: 'wary' as const, captive: null };

/** Snag as a Beastmaster with Eyes of the Beast, and Bramble the aurochs at his side. */
function withEyes(): World {
  const w = world();
  const snag = member(w, 'Snag');
  snag.character = { ...beastmaster(['eyes-of-the-beast']), id: snag.character.id };
  w.rng = scriptedRng([4, 4]);
  const n = addNpc(w, data, 'companion', 'wild-aurochs', 'wild-aurochs', 'Bramble', true);
  if (!n) throw new Error('no room for Bramble');
  n.master = snag.id;
  w.position = { col: 5, row: 9 };
  return w;
}

describe('Eyes of the Beast in a meeting (1.5.4)', () => {
  it('lets the companion spot a group no one else is watching for', () => {
    const w = withEyes();
    // Reaction 3+3; the thug 1+1; Bramble 6+6.
    w.rng = scriptedThen([3, 3, 1, 1, 6, 6], createRng('eyes'));
    startEncounter(w, data, rolled, undefined, 0, '5,9');
    expect(w.encounter?.spotted).toBe(true);
    expect(w.encounter?.text).toContain('Bramble spots 1 Thug or Militia');
  });

  it('leaves the party surprised when the group outdoes the companion', () => {
    const w = withEyes();
    // Reaction 3+3; the thug 6+6; Bramble 1+1.
    w.rng = scriptedThen([3, 3, 6, 6, 1, 1], createRng('eyes'));
    startEncounter(w, data, rolled, undefined, 0, '5,9');
    expect(w.encounter?.spotted).toBe(false);
    expect(w.encounter?.text).toContain('The party meets 1 Thug or Militia');
  });

  it('gives the companion no roll when no one can spot anything', () => {
    const w = withEyes();
    // The faces that let Bramble spot them above go unused.
    w.rng = scriptedThen([3, 3, 1, 1, 6, 6], createRng('eyes'));
    startEncounter(w, data, rolled, undefined, null, '5,9');
    expect(w.encounter?.spotted).toBe(false);
  });
});
