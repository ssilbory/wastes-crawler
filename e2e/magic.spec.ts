import { expect, test, type Page } from '@playwright/test';
import { openStep } from './wizard.ts';

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
  await page.goto('/#/builder');
  await select('People', opts.people);
  const array: [string, string][] = [
    ['Strength', '7'],
    ['Dexterity', '12'],
    ['Constitution', '11'],
    ['Intelligence', '14'],
    ['Wisdom', '10'],
    ['Charisma', '9'],
  ];
  await openStep(page, 'Attributes');
  for (const [attr, v] of array) await select(attr, v);
  await openStep(page, 'Background');
  await select('Background', opts.bg);
  await select('Learning pick 1', opts.picks[0]);
  await select('Learning pick 2', opts.picks[1]);
  await openStep(page, 'Class');
  await select('Class', opts.className);
  await openStep(page, 'Foci');
  for (const [label, option] of opts.foci) await select(label, option);
  await openStep(page, 'Magic');
  const magic = page.locator('section.step', { hasText: '6. Magic' });
  for (const art of opts.arts) await magic.getByLabel(art, { exact: true }).check();
  for (const spell of opts.spells) await magic.getByLabel(spell, { exact: true }).check();
  for (const spell of opts.prepare) await magic.getByLabel(`Prepare ${spell}`).check();
  await openStep(page, 'Free skill');
  await select('Free skill', 'Know');
  await openStep(page, 'Gear');
  await page.getByRole('radio', { name: 'Starting package' }).check();
  await select('Package', 'Apprentice');
  await openStep(page, 'Name and goal');
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
  // Spells left out of the game aren't offered (docs/rules-adaptation.md, High Magic in combat).
  await expect(page.getByText('Cognitive Supersession of the Inferior Orders')).toHaveCount(0);
  await expect(sheet).toContainText('Magic-0');
});

test('a Death Knight, a partial Necromancer warrior, has Effort one lower, 1', async ({ page }) => {
  const sheet = await caster(page, {
    people: 'Orc',
    bg: 'Raider',
    picks: ['Sneak', 'Exert'],
    className: 'Death Knight (Necromancer/Warrior)',
    foci: [
      ['Bonus skill for War-bred', 'Stab'],
      ['Racial focus', 'Die Hard'],
      ['Combat focus', 'Impervious Defense'],
      ['Any focus', 'Lucky'],
    ],
    arts: ['Bonetalker'],
    spells: ['Command the Dead', 'Damnation of the Sense'],
    prepare: ['Command the Dead', 'Damnation of the Sense'],
  });
  // Orc: Int 14 (+1), Cha 9 - 2 = 7: 1 + 0 + 1 - 1 = 1.
  await expect(sheet).toContainText('Effort 1.');
});

test('a Warlock has spell points and preparations of 1 + Int, and no arts (1.5.11)', async ({
  page,
}) => {
  const sheet = await caster(page, {
    people: 'Orc',
    bg: 'Raider',
    picks: ['Sneak', 'Exert'],
    className: 'Warlock (Invoker/Warrior)',
    foci: [
      ['Bonus skill for War-bred', 'Stab'],
      ['Racial focus', 'Die Hard'],
      ['Combat focus', 'Impervious Defense'],
      ['Any focus', 'Lucky'],
    ],
    arts: [],
    spells: ['The Coruscating Coffin', 'Wardpact Invocation'],
    prepare: ['The Coruscating Coffin', 'Wardpact Invocation'],
  });
  // Orc: Int 14 (+1): 1 + 1 points and 1 + 1 prepared.
  await expect(sheet).toContainText('Has 2 spell points a day, prepares 2, up to level 1.');
  await expect(sheet).not.toContainText('Effort');
  await expect(sheet).not.toContainText('Arts:');
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
  await page.goto('/#/builder');
  await openStep(page, 'Class');
  await page
    .getByRole('combobox', { name: 'Class', exact: true })
    .selectOption({ label: 'Priest of Death (Necromancer/Healer)' });
  await openStep(page, 'Magic');
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
  await page.goto('/#/builder');
  const magic = page.locator('section.step', { hasText: '6. Magic' });
  const select = async (option: string) => {
    await openStep(page, 'Class');
    await page
      .getByRole('combobox', { name: 'Class', exact: true })
      .selectOption({ label: option });
    await openStep(page, 'Magic');
  };
  await select('High Mage');
  await expect(magic.getByLabel('Counter Magic', { exact: true })).toHaveCount(1);
  await expect(magic.getByLabel('Ward Allies', { exact: true })).toHaveCount(0);
  await expect(magic.getByLabel('Arcane Lexicon', { exact: true })).toHaveCount(0);
  await select('Elementalist');
  await expect(magic).toContainText('plus Elemental Resilience');
  await expect(magic).not.toContainText('Elemental Sparks');
  await expect(magic.getByLabel('Thermal Shield', { exact: true })).toHaveCount(0);
});
