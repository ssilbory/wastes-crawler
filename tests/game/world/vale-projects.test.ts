import { describe, expect, it } from 'vitest';
import { emit } from '../../../src/game/world/bus.ts';
import { institutionId } from '../../../src/game/world/institution-projects.ts';
import {
  cannotFound,
  cannotHire,
  foundInstitution,
  settleCaptive,
} from '../../../src/game/world/institutions.ts';
import { progressOf } from '../../../src/game/world/major-projects.ts';
import { newWorld } from '../../../src/game/world/new-world.ts';
import { addNpc } from '../../../src/game/world/npcs.ts';
import { askHelp, cannotAsk } from '../../../src/game/world/project-help.ts';
import { helpFaction } from '../../../src/game/world/region.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import { enterTown } from '../../../src/game/world/town.ts';
import type { World } from '../../../src/game/world/types.ts';
import type { GameData } from '../../../src/game/character/context.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, starter } from './helpers.ts';

// Building in the Sealed Vale (docs/rules-adaptation.md, The Sealed Vale's projects; Sam's calls;
// vendor/wwn-srd/7.0 Major Projects/7.5.0 for institutions, 7.1.0 for Renown).

const WARDEN = 'harrowmere/hm-tower-6/3,2';
const STREETS_HOARD = 'harrowmere/hm-streets/8,2';

/** A Sealed Vale world standing in Lastward, with crowns to spend. */
function lastward(d: GameData = data): World {
  const party = [{ character: starter('snag'), row: 0, column: 0, defaultAction: 'auto' as const }];
  const w = newWorld(d, createRng('vale-projects'), party, undefined, null, 'sealed-vale');
  w.purse = 1000;
  return w;
}

/** Brings a freed Harrowmere captive along and walks into Lastward with them. */
function bringHome(w: World, captive: string, name: string): void {
  if (!addNpc(w, data, 'captive', captive, 'peaceful-human', name, false))
    throw new Error('no room');
  enterTown(w, data, 'lastward');
}

describe('the Sealed Vale’s projects (Sam’s calls)', () => {
  it('founds any institution Lastward lacks; a town, it has its workshop', () => {
    const w = lastward();
    expect(cannotFound(w, data, 'workshop')).toBe('Lastward has a workshop already.');
    expect(cannotFound(w, data, 'arena')).toBeNull();
    expect(foundInstitution(w, data, 'arena')).toEqual({ ok: true });
    // No Faithful in the vale: a crypt is unopposed.
    foundInstitution(w, data, 'crypt');
    expect(cannotFound(w, data, 'temple')).toBe(
      'Lastward already has a place that raises the dead.',
    );
  });

  it('has no one to ask for help', () => {
    const w = lastward();
    foundInstitution(w, data, 'arena');
    const id = institutionId('arena', 'lastward');
    expect(helpFaction(w, data)).toBeNull();
    expect(cannotAsk(w, data, id)).toBe('No one here can help.');
    expect(askHelp(w, data, id)).toEqual({ ok: false, reason: 'No one here can help.' });
  });

  it('hires no journeyman: specialists are found held in Harrowmere', () => {
    const w = lastward();
    foundInstitution(w, data, 'arena');
    expect(cannotHire(w, data, institutionId('arena', 'lastward'))).toBe(
      'No journeyman can reach The Sealed Vale: free an arena master held captive.',
    );
  });
});

describe('Renown in the Sealed Vale (campaign rates; Sam’s call)', () => {
  it('pays 1 for a level’s guarded hoard', () => {
    const w = lastward();
    emit(w, data, { kind: 'fight-won', quest: null, garrison: STREETS_HOARD });
    expect(w.renown).toBe(1);
  });

  it('pays 2 for the Warden’s hoard once his order ends, fought for', () => {
    const w = lastward();
    emit(w, data, { kind: 'fight-won', quest: null, garrison: WARDEN });
    expect(w.renown).toBe(0);
    emit(w, data, { kind: 'order-ended', order: 'warden-seal' });
    expect(w.renown).toBe(2);
    expect(w.log.at(-1)).toContain('The keeper of the hoard is beaten: 2 Renown');
  });

  it('pays 2 when the Warden is stood down with his countersign, and nothing for other orders', () => {
    const w = lastward();
    emit(w, data, { kind: 'order-ended', order: 'hold-the-throat' });
    expect(w.renown).toBe(0);
    emit(w, data, { kind: 'order-ended', order: 'warden-seal' });
    expect(w.renown).toBe(2);
  });

  it('pays a hoard’s 1 for a hoard an order keeps with no overlord', () => {
    const plain: GameData = {
      ...data,
      content: {
        ...data.content,
        dungeons: data.content.dungeons.map((d) => ({
          ...d,
          levels: d.levels.map((l) => ({
            ...l,
            specials: l.specials.map((s) =>
              s.kind === 'cache' && s.overlord ? { ...s, overlord: undefined } : s,
            ),
          })),
        })),
      },
    };
    const w = lastward(plain);
    emit(w, plain, { kind: 'order-ended', order: 'warden-seal' });
    expect(w.renown).toBe(1);
  });
});

describe('specialists freed in Harrowmere (Sam’s call: found before the project counts)', () => {
  it('wait in Lastward for their institution, taking no reward', () => {
    const w = lastward();
    const purse = w.purse;
    const xp = w.members[0]?.character.xp;
    bringHome(w, 'vale-herbalist', 'Old Maud');
    expect(w.npcs).toEqual([]);
    expect(w.purse).toBe(purse);
    expect(w.members[0]?.character.xp).toBe(xp);
    expect(w.waiting).toEqual([{ captive: 'vale-herbalist', name: 'Old Maud', town: 'lastward' }]);
    expect(w.log.at(-1)).toContain("will run an alchemist's shop once the party founds it");
    foundInstitution(w, data, 'alchemist');
    expect(progressOf(w, institutionId('alchemist', 'lastward')).specialist).toBe('Old Maud');
    expect(w.waiting).toEqual([]);
    expect(w.log.at(-1)).toContain('Old Maud, who waited in Lastward, will run it.');
  });

  it('settle at once in an institution already under way', () => {
    const w = lastward();
    foundInstitution(w, data, 'arena');
    bringHome(w, 'vale-pit-master', 'Brann');
    expect(progressOf(w, institutionId('arena', 'lastward')).specialist).toBe('Brann');
    expect(w.waiting).toEqual([]);
  });

  it('keep waiting for an institution that can’t be founded beside another raiser', () => {
    const w = lastward();
    bringHome(w, 'vale-sexton', 'Tobb');
    foundInstitution(w, data, 'mortuary');
    expect(progressOf(w, institutionId('mortuary', 'lastward')).specialist).toBeNull();
    expect(w.waiting.map((x) => x.captive)).toEqual(['vale-sexton']);
  });

  it('can still be asked to settle by hand while in the party in Lastward', () => {
    const w = lastward();
    foundInstitution(w, data, 'temple');
    const n = addNpc(w, data, 'captive', 'vale-blood-priest', 'peaceful-human', 'Sera', false);
    const id = institutionId('temple', 'lastward');
    expect(settleCaptive(w, data, n?.id as string, id)).toEqual({ ok: true });
    expect(progressOf(w, id).specialist).toBe('Sera');
  });

  it('keep their wait through a save, and older saves start with none waiting', () => {
    const w = lastward();
    bringHome(w, 'vale-grey-priest', 'Father Ost');
    const back = parseWorld(serializeWorld(w), data);
    if (!back.ok) throw new Error(back.errors.join('; '));
    expect(back.world.waiting).toEqual(w.waiting);
    const up = WORLD_MIGRATIONS[56] as (raw: Record<string, unknown>) => Record<string, unknown>;
    expect(up({ schemaVersion: 56 })).toEqual({ schemaVersion: 57, waiting: [] });
  });
});

describe('Harrowmere’s held specialists (content)', () => {
  it('holds one for each institution Lastward can found, all bound for Lastward', () => {
    const held = (data.content.dungeons.find((d) => d.id === 'harrowmere')?.levels ?? []).flatMap(
      (l) => l.captives.map((c) => `${l.id}:${c.captive}`),
    );
    expect(held).toEqual([
      'hm-streets:vale-pit-master',
      'hm-sewer-1:vale-herbalist',
      'hm-sewer-2:vale-sexton',
      'hm-sewer-3:vale-grey-priest',
      'hm-tower-2:vale-blood-priest',
    ]);
    for (const c of data.content.captives.filter((x) => x.waits))
      expect(c.destination).toBe('lastward');
  });
});
