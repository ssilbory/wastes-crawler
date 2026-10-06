import { expect, test, type Page } from '@playwright/test';

// The Phase 3e exit criterion (docs/plan.md): build casters, and Effort matches the best skill
// plus best attribute rule across classes (1 + Magic + best of Int or Cha, one lower if partial).
async function caster(
  page: Page,
  opts: {
    people: string;
    bg: string;
    picks: [string, string];
    className: string;
    foci: [string, string][];
    arts: string[];
    spells: string[];
    prepare: string[];
  },
) {
  const select = (label: string, option: string) =>
    page.getByRole('combobox', { name: label, exact: true }).selectOption({ label: option });
  await page.goto('/');
  await select('People', opts.people);
  const array: [string, string][] = [
    ['Strength', '7'],
    ['Dexterity', '12'],
    ['Constitution', '11'],
    ['Intelligence', '14'],
    ['Wisdom', '10'],
    ['Charisma', '9'],
  ];
  for (const [attr, v] of array) await select(attr, v);
  await select('Background', opts.bg);
  await select('Learning pick 1', opts.picks[0]);
  await select('Learning pick 2', opts.picks[1]);
  await select('Class', opts.className);
  for (const [label, option] of opts.foci) await select(label, option);
  const magic = page.locator('section.step', { hasText: '6. Magic' });
  for (const art of opts.arts) await magic.getByLabel(art, { exact: true }).check();
  for (const spell of opts.spells) await magic.getByLabel(spell, { exact: true }).check();
  for (const spell of opts.prepare) await magic.getByLabel(`Prepare ${spell}`).check();
  await select('Free skill', 'Know');
  await page.getByRole('radio', { name: 'Starting package' }).check();
  await select('Package', 'Apprentice');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Caster');
  await page.getByRole('button', { name: 'Create character' }).click();
  return page.getByTestId('character-sheet');
}

const SPELLS = [
  'The Coruscating Coffin',
  'Ineluctable Shackles of Volition',
  'Decree of Ligneous Dissolution',
  'Wardpact Invocation',
];

test('a Gnome High Mage has Effort 1 + Magic-0 + Int 16 (+1) = 2', async ({ page }) => {
  const sheet = await caster(page, {
    people: 'Gnome',
    bg: 'Scavenger',
    picks: ['Sneak', 'Trade'],
    className: 'High Mage',
    foci: [
      ['Racial focus 1', 'Artisan'],
      ['Racial focus 2', 'Polymath'],
      ['Bonus skill for Racial focus 2', 'Heal'],
      ['Any focus', 'Armored Magic'],
    ],
    arts: ['Counter Magic', 'Sense Magic'],
    spells: SPELLS,
    prepare: SPELLS.slice(0, 3),
  });
  await expect(sheet).toContainText('Effort 2. Casts 1 a day, prepares 3, up to level 1.');
  await expect(sheet).toContainText('Arts: Counter Magic, Sense Magic.');
  await expect(sheet).toContainText('Wardpact Invocation');
  await expect(sheet).toContainText('Ineluctable Shackles of Volition (prepared)');
  // Spells not yet built aren't offered (docs/rules-adaptation.md, High Magic in combat).
  await expect(page.getByText('Phantasmal Mimesis')).toHaveCount(0);
  await expect(sheet).toContainText('Magic-0');
});

test('a Thaumaturge, a dual partial caster, has Magic-1 and Effort 1 + 1 + 1 - 1 = 2', async ({
  page,
}) => {
  const sheet = await caster(page, {
    people: 'Elf',
    bg: 'Raider',
    picks: ['Sneak', 'Exert'],
    className: 'Thaumaturge (High Mage/Elementalist)',
    foci: [
      ['Racial focus 1', 'Cultured'],
      ['Racial focus 2', 'Lucky'],
      ['Any focus', 'Well Met'],
    ],
    arts: ['Sense Magic', 'Flamesight'],
    spells: [
      'The Coruscating Coffin',
      'Damnation of the Sense',
      'The Wind of the Final Repose',
      'Wardpact Invocation',
    ],
    prepare: ['Damnation of the Sense'],
  });
  // Elf: Int 14, Cha 9 + 1 = 10, so Int (+1) is best; two Magic bonus picks make Magic-1.
  await expect(sheet).toContainText('Effort 2.');
  await expect(sheet).toContainText('Magic-1');
  await expect(sheet).toContainText('Arts: Elemental Resilience, Sense Magic, Flamesight.');
});

test('a Stormblade, a partial Elementalist warrior, has Effort one lower, 1', async ({ page }) => {
  const sheet = await caster(page, {
    people: 'Orc',
    bg: 'Raider',
    picks: ['Sneak', 'Exert'],
    className: 'Stormblade (Elementalist/Warrior)',
    foci: [
      ['Bonus skill for War-bred', 'Stab'],
      ['Racial focus', 'Die Hard'],
      ['Combat focus', 'Impervious Defense'],
      ['Any focus', 'Lucky'],
    ],
    arts: ['Earthsight'],
    // The Elementalist's own spells wait to be built; High Magic serves meanwhile.
    spells: ['Damnation of the Sense', 'The Wind of the Final Repose'],
    prepare: ['Damnation of the Sense', 'The Wind of the Final Repose'],
  });
  // Orc: Int 14 (+1), Cha 9 - 2 = 7: 1 + 0 + 1 - 1 = 1.
  await expect(sheet).toContainText('Effort 1.');
});

test('a Gnome Necromancer picks a necromancer art and spells from both lists (Phase 14b)', async ({
  page,
}) => {
  const spells = [
    'Command the Dead',
    'Smite the Dead',
    'Damnation of the Sense',
    'The Coruscating Coffin',
  ];
  const sheet = await caster(page, {
    people: 'Gnome',
    bg: 'Scavenger',
    picks: ['Sneak', 'Trade'],
    className: 'Necromancer',
    foci: [
      ['Racial focus 1', 'Artisan'],
      ['Racial focus 2', 'Polymath'],
      ['Bonus skill for Racial focus 2', 'Heal'],
      ['Any focus', 'Armored Magic'],
    ],
    arts: ['Bonetalker'],
    spells,
    prepare: spells.slice(0, 3),
  });
  await expect(sheet).toContainText('Effort 2. Casts 1 a day, prepares 3, up to level 1.');
  await expect(sheet).toContainText('Arts: Bonetalker.');
  await expect(sheet).toContainText('Command the Dead (prepared)');
});

test('a Blood Knight works miracles in armor, with no spells (Phase 14c)', async ({ page }) => {
  const sheet = await caster(page, {
    people: 'Gnome',
    bg: 'Scavenger',
    picks: ['Sneak', 'Trade'],
    className: 'Blood Knight (Blood Priest/Warrior)',
    foci: [
      ['Racial focus 1', 'Artisan'],
      ['Racial focus 2', 'Polymath'],
      ['Bonus skill for Racial focus 2', 'Heal'],
      ['Combat focus', 'Armsmaster'],
      ['Any focus', 'Die Hard'],
    ],
    arts: ['Armor of God', 'Merciful Healing'],
    spells: [],
    prepare: [],
  });
  // Pray-0 plus Wisdom 10 (+0), at least 1.
  await expect(sheet).toContainText('Effort 1. Miracles only.');
  await expect(sheet).toContainText('Arts: Armor of God, Merciful Healing.');
});

test('a Priest of Death heals and binds the dead, but learns no raising (Phase 14d)', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByRole('combobox', { name: 'Class', exact: true })
    .selectOption({ label: 'Priest of Death (Necromancer/Healer)' });
  const magic = page.locator('section.step', { hasText: '6. Magic' });
  await expect(magic).toContainText('Healer arts: pick 1, plus Healing Touch');
  // Revive the Fallen waits for 8th level; Limb Restoration is left out of the game.
  await expect(magic.getByLabel('Revive the Fallen', { exact: true })).toHaveCount(0);
  await expect(magic.getByLabel('Limb Restoration', { exact: true })).toHaveCount(0);
  const sheet = await caster(page, {
    people: 'Gnome',
    bg: 'Scavenger',
    picks: ['Sneak', 'Trade'],
    className: 'Priest of Death (Necromancer/Healer)',
    foci: [
      ['Racial focus 1', 'Artisan'],
      ['Racial focus 2', 'Polymath'],
      ['Bonus skill for Racial focus 2', 'Heal'],
      ['Any focus', 'Die Hard'],
    ],
    arts: ['Bonetalker', 'Vital Furnace'],
    spells: ['Command the Dead', 'Smite the Dead'],
    prepare: ['Command the Dead', 'Smite the Dead'],
  });
  await expect(sheet).toContainText('Arts: Healing Touch, Bonetalker, Vital Furnace.');
  await expect(sheet).toContainText('Command the Dead (prepared)');
  await expect(sheet).toContainText('Heal-1');
});

test('a Blood Saint works miracles and heals (Phase 14d)', async ({ page }) => {
  const sheet = await caster(page, {
    people: 'Gnome',
    bg: 'Scavenger',
    picks: ['Sneak', 'Trade'],
    className: 'Blood Saint (Blood Priest/Healer)',
    foci: [
      ['Racial focus 1', 'Artisan'],
      ['Racial focus 2', 'Polymath'],
      ['Bonus skill for Racial focus 2', 'Trade'],
      ['Any focus', 'Die Hard'],
    ],
    arts: ['Armor of God', 'Merciful Healing', 'Swift Healer'],
    spells: [],
    prepare: [],
  });
  await expect(sheet).toContainText('Miracles only.');
  await expect(sheet).toContainText(
    'Arts: Healing Touch, Armor of God, Merciful Healing, Swift Healer.',
  );
  await expect(sheet).toContainText('Pray-0');
  await expect(sheet).toContainText('Heal-0');
});

test('arts the game leaves out are never offered (Phase 15)', async ({ page }) => {
  await page.goto('/');
  const magic = page.locator('section.step', { hasText: '6. Magic' });
  const select = (option: string) =>
    page.getByRole('combobox', { name: 'Class', exact: true }).selectOption({ label: option });
  await select('High Mage');
  await expect(magic.getByLabel('Counter Magic', { exact: true })).toHaveCount(1);
  await expect(magic.getByLabel('Ward Allies', { exact: true })).toHaveCount(0);
  await expect(magic.getByLabel('Arcane Lexicon', { exact: true })).toHaveCount(0);
  await select('Elementalist');
  await expect(magic).toContainText('plus Elemental Resilience');
  await expect(magic).not.toContainText('Elemental Sparks');
  await expect(magic.getByLabel('Thermal Shield', { exact: true })).toHaveCount(0);
});
