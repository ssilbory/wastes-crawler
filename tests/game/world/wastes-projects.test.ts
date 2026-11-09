import { describe, expect, it } from 'vitest';
import { retaken } from '../../../src/game/factions/capture.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { institutionId } from '../../../src/game/world/institution-projects.ts';
import {
  cannotFound,
  cannotHire,
  foundInstitution,
  hireJourneyman,
} from '../../../src/game/world/institutions.ts';
import {
  difficultyNow,
  progressOf,
  projectOf,
  spendRenown,
} from '../../../src/game/world/major-projects.ts';
import { askHelp, cannotAsk } from '../../../src/game/world/project-help.ts';
import { hasProjects, helpFaction } from '../../../src/game/world/region.ts';
import { newWorld } from '../../../src/game/world/new-world.ts';
import type { World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, starter } from './helpers.ts';

// Building in the Wastes (docs/rules-adaptation.md, The Wastes: Projects; Sam's calls;
// vendor/wwn-srd/7.0 Major Projects/).

/** A Wastes world standing in a Dust Fringe village, with crowns to spend. */
function wastes(col = 4, row = 6): World {
  const party = [{ character: starter('snag'), row: 0, column: 0, defaultAction: 'auto' as const }];
  const w = newWorld(data, createRng('wastes-projects'), party, undefined, null, 'wastes');
  w.position = { col, row };
  w.purse = 1000;
  return w;
}
const dustwell = () => wastes(4, 6);
const cisternRest = () => wastes(16, 11);

describe('projects in the Wastes (Sam’s calls)', () => {
  it('are allowed in the Wastes and the campaign, not the Sealed Vale or a custom map', () => {
    expect(hasProjects({ map: null, realm: null }, data)).toBe(true);
    expect(hasProjects({ map: null, realm: 'wastes' }, data)).toBe(true);
    expect(hasProjects({ map: null, realm: 'sealed-vale' }, data)).toBe(false);
    expect(hasProjects({ map: null, realm: 'atlantis' }, data)).toBe(false);
  });

  it('pay no Renown for a retaken village where nothing can be built', () => {
    const party = [
      { character: starter('snag'), row: 0, column: 0, defaultAction: 'auto' as const },
    ];
    const w = newWorld(data, createRng('vale'), party, undefined, null, 'sealed-vale');
    retaken(w, data, 'cistern-rest');
    expect(w.renown).toBe(0);
  });

  it('ask the Well-Keepers for help, and the campaign the Free Settlements', () => {
    expect(helpFaction({ realm: 'wastes' }, data)).toBe('well-keepers');
    expect(helpFaction({ realm: null }, data)).toBe(data.content.projects.help.faction);
    const w = dustwell();
    expect(cannotAsk(w, data, 'wall-cistern-rest')).toBeNull();
    expect(askHelp(w, data, 'wall-cistern-rest')).toEqual({ ok: true });
    expect(progressOf(w, 'wall-cistern-rest').help).toEqual([
      { faction: 'well-keepers', points: 0 },
    ]);
    expect(cannotAsk(w, data, 'wall-glasswater')).toBe(
      'The Well-Keepers help only with projects on their own map.',
    );
  });

  it('price a wall by its warlord’s faction, which falls away once the faction is broken', () => {
    const w = dustwell();
    const wall = projectOf(data, 'wall-dustwell');
    expect(difficultyNow(w, data, wall)).toBe(8);
    const riders = w.factions['scrap-riders'];
    if (riders) riders.hp = 0;
    expect(difficultyNow(w, data, wall)).toBe(2);
  });

  it('take the party’s Renown in any settlement on the project’s map', () => {
    const w = cisternRest();
    w.renown = 3;
    expect(spendRenown(w, data, 'well-cistern-rest', 3)).toEqual({ ok: true });
    expect(progressOf(w, 'well-cistern-rest').renown).toBe(3);
    expect(spendRenown(w, data, 'wall-glasswater', 1)).toMatchObject({ ok: false });
  });
});

describe('institutions in the Wastes (Sam’s calls)', () => {
  it('are founded in a Wastes village, and the campaign’s Faithful oppose no crypt there', () => {
    const w = dustwell();
    expect(cannotFound(w, data, 'workshop')).toBeNull();
    expect(cannotFound(w, data, 'crypt')).toBeNull();
    expect(foundInstitution(w, data, 'crypt')).toEqual({ ok: true });
    const crypt = projectOf(data, institutionId('crypt', 'dustwell'));
    expect(crypt.difficulty.opposition).toEqual([]);
    // Plausible × village, with no one against it.
    expect(difficultyNow(w, data, crypt)).toBe(2);
  });

  it('send for a journeyman from any other village while none has the service', () => {
    const w = dustwell();
    foundInstitution(w, data, 'workshop');
    const id = institutionId('workshop', 'dustwell');
    expect(cannotHire(w, data, id)).toBe('Hire a journeyman smith in another settlement.');
    w.position = { col: 16, row: 11 };
    expect(cannotHire(w, data, id)).toBeNull();
    expect(hireJourneyman(w, data, id)).toEqual({ ok: true });
    // The projects' listener runs in the Wastes: the journeyman settles on reaching Dustwell.
    w.position = { col: 4, row: 6 };
    emit(w, data, { kind: 'town-entered', town: 'dustwell' });
    expect(progressOf(w, id).specialist).not.toBeNull();
  });

  it('hire where the service stands once a Wastes village has one open', () => {
    const w = cisternRest();
    const open = institutionId('workshop', 'cistern-rest');
    w.majorProjects[open] = { ...progressOf(w, open), done: 0, specialist: 'Hesk' };
    w.position = { col: 4, row: 6 };
    foundInstitution(w, data, 'workshop');
    const id = institutionId('workshop', 'dustwell');
    // Tinker's Oasis has none: the smith comes from Cistern Rest's workshop.
    w.position = { col: 27, row: 14 };
    expect(cannotHire(w, data, id)).toBe('Hire a journeyman smith in a town that has a workshop.');
    w.position = { col: 16, row: 11 };
    expect(cannotHire(w, data, id)).toBeNull();
  });
});
