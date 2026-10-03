// Builds data/content/benchmark-warrior.json, the 1st-level Warrior the XP house rule fields four of
// (docs/rules-adaptation.md, XP). Run: pnpm exec tsx tools/sim/make-benchmark-warrior.ts
import { writeFileSync } from 'node:fs';
import { loadContent } from '../../src/data/content.ts';
import { loadSrd } from '../../src/data/load.ts';
import { emptyChoices, finishCharacter } from '../../src/game/character/creation.ts';
import { exportCharacter } from '../../src/game/character/io.ts';
import { createRng } from '../../src/rules/rng.ts';

const data = { srd: loadSrd(), content: loadContent() };
const r = finishCharacter(
  {
    ...emptyChoices(),
    people: 'orc',
    array: { str: 14, dex: 12, con: 11, int: 10, wis: 9, cha: 7 },
    background: {
      id: 'pit-fighter',
      choice: { mode: 'pick', picks: [{ index: 2 }, { index: 5 }] },
    },
    classId: 'full-warrior',
    foci: [
      { id: 'war-bred', skill: 'stab' },
      null,
      { id: 'die-hard' },
      { id: 'shocking-assault', skill: 'punch' },
      { id: 'armsmaster' },
    ],
    freeSkill: 'notice',
    gear: { mode: 'package', packageId: 'shield-wall' },
    name: 'Benchmark Warrior',
  },
  data,
  createRng('benchmark-warrior'),
);
if (!r.ok) throw new Error(r.errors.join('; '));
writeFileSync('data/content/benchmark-warrior.json', exportCharacter(r.character));
console.log('Wrote data/content/benchmark-warrior.json.');
