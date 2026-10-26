// Builds the sample party in tools/sim/parties/starter/ through the character creation rules, so the
// files are ordinary exported characters. Run: pnpm exec tsx tools/sim/make-starter-party.ts
import { writeFileSync } from 'node:fs';
import { loadContent } from '../../src/data/content.ts';
import { loadSrd } from '../../src/data/load.ts';
import { emptyChoices, finishCharacter, type Choices } from '../../src/game/character/creation.ts';
import { exportCharacter } from '../../src/game/character/io.ts';
import { createRng } from '../../src/rules/rng.ts';
import { WORLD_LISTENERS } from '../../src/game/world/listeners.ts';

const data = { srd: loadSrd(), content: loadContent(), listeners: WORLD_LISTENERS };
const array = { str: 14, dex: 12, con: 11, int: 10, wis: 9, cha: 7 };
const pick = (a: number, b: number) => ({
  mode: 'pick' as const,
  picks: [{ index: a }, { index: b }],
});

const party: [string, Partial<Choices>][] = [
  [
    'snag',
    {
      people: 'goblin',
      array,
      background: { id: 'raider', choice: pick(1, 2) },
      classId: 'full-warrior',
      foci: [null, null, { id: 'alert' }, { id: 'armsmaster' }, { id: 'lucky' }],
      freeSkill: 'notice',
      gear: { mode: 'package', packageId: 'shield-wall' },
      name: 'Snag',
    },
  ],
  [
    'grukk',
    {
      people: 'orc',
      array,
      background: { id: 'pit-fighter', choice: pick(2, 5) },
      classId: 'full-warrior',
      foci: [
        { id: 'war-bred', skill: 'stab' },
        null,
        { id: 'die-hard' },
        { id: 'shocking-assault', skill: 'punch' },
        { id: 'armsmaster' },
      ],
      freeSkill: 'heal',
      gear: { mode: 'package', packageId: 'heavy-hitter' },
      name: 'Grukk',
    },
  ],
  [
    'lirael',
    {
      people: 'elf',
      array: { str: 10, dex: 14, con: 12, int: 11, wis: 9, cha: 7 },
      background: { id: 'warden', choice: pick(1, 4) },
      classId: 'full-expert',
      foci: [
        null,
        { id: 'deadeye' },
        { id: 'cultured' },
        { id: 'gifted-chirurgeon' },
        { id: 'well-met' },
      ],
      freeSkill: 'notice',
      gear: { mode: 'package', packageId: 'archer' },
      name: 'Lirael',
    },
  ],
  [
    'fizzwick',
    {
      people: 'gnome',
      array: { str: 7, dex: 12, con: 11, int: 14, wis: 10, cha: 9 },
      background: { id: 'hedge-scholar', choice: pick(2, 4) },
      classId: 'full-high-mage',
      foci: [null, { id: 'artisan' }, { id: 'polymath', skill: 'heal' }, { id: 'die-hard' }],
      magic: {
        arts: ['empowered-sorcery', 'inexorable-effect'],
        known: [
          'the-coruscating-coffin',
          'the-wind-of-the-final-repose',
          'damnation-of-the-sense',
          'wardpact-invocation',
        ],
        prepared: [
          'the-coruscating-coffin',
          'the-wind-of-the-final-repose',
          'damnation-of-the-sense',
        ],
      },
      freeSkill: 'notice',
      gear: { mode: 'package', packageId: 'apprentice' },
      name: 'Fizzwick',
    },
  ],
];

for (const [file, choices] of party) {
  const r = finishCharacter({ ...emptyChoices(), ...choices }, data, createRng(`starter-${file}`));
  if (!r.ok) throw new Error(`${file}: ${r.errors.join('; ')}`);
  writeFileSync(`tools/sim/parties/starter/${file}.json`, exportCharacter(r.character));
}
console.log(`Wrote ${party.length} characters to tools/sim/parties/starter/.`);
