import { expect, test, type Page } from '@playwright/test';
import { openStep } from './wizard.ts';

// Going back a step or two in the builder, tweaking a choice, and carrying on. Each case either
// checks that a stale choice is gone, or that the tweaked build's sheet matches a fresh build made
// in one pass with the same final choices.

const STANDARD = [
  ['Strength', '14'],
  ['Dexterity', '12'],
  ['Constitution', '11'],
  ['Intelligence', '10'],
  ['Wisdom', '9'],
  ['Charisma', '7'],
] as const;

/** An option by its label, or by position when the label isn't known to the test. */
type Option = string | { index: number };

const choose = (page: Page, label: string, option: Option) => {
  const select = page.getByRole('combobox', { name: label, exact: true });
  return typeof option === 'string'
    ? select.selectOption({ label: option })
    : select.selectOption({ index: option.index });
};

/** The sheet's text with the rolled HP left out. */
async function sheetText(page: Page) {
  const sheet = page.getByTestId('character-sheet');
  await expect(sheet).toBeVisible();
  return (await sheet.innerText()).replace(/HP\s+\d+\/\d+/g, 'HP');
}

async function create(page: Page) {
  await page.getByRole('button', { name: 'Create character' }).click();
  return sheetText(page);
}

const stepError = (page: Page, step: string) =>
  page.locator('section.step', { hasText: step }).locator('p.error');

interface Build {
  people?: string;
  array?: readonly (readonly [string, string])[];
  learning2?: Option;
  racial?: Option;
}

/** Fills every step of a Warrior, in the order a player would. Defaults to a Goblin Raider. */
async function fill(page: Page, build: Build = {}) {
  const { people = 'Goblin', array = STANDARD, learning2 = 'Exert', racial = 'Alert' } = build;
  await page.goto('/#/builder');
  await choose(page, 'People', people);
  await openStep(page, 'Attributes');
  for (const [attr, value] of array) await choose(page, attr, value);
  await openStep(page, 'Background');
  await choose(page, 'Background', 'Raider');
  await choose(page, 'Learning pick 1', 'Sneak');
  await choose(page, 'Learning pick 2', learning2);
  await openStep(page, 'Class');
  await choose(page, 'Class', 'Warrior');
  await openStep(page, 'Foci');
  await foci(page, { racial, orc: people === 'Orc' });
  await openStep(page, 'Free skill');
  await choose(page, 'Free skill', 'Notice');
  await openStep(page, 'Gear');
  await page.getByRole('radio', { name: 'Starting package' }).check();
  await choose(page, 'Package', 'Shield Wall');
  await openStep(page, 'Name and goal');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill('Snag');
  await page.getByRole('textbox', { name: 'Goal', exact: true }).fill('Outlive the war-band');
}

/** The Warrior's foci: an Orc's War-bred takes Stab, and Armsmaster then needs a replacement. */
async function foci(page: Page, o: { racial: Option; orc: boolean }) {
  if (o.orc) {
    await choose(page, 'Bonus skill for War-bred', 'Stab');
    await choose(page, 'Combat focus', 'Armsmaster');
    await choose(page, 'Replacement skill for Combat focus', 'Notice');
  } else {
    await choose(page, 'Combat focus', 'Armsmaster');
  }
  await choose(page, 'Racial focus', o.racial);
  await choose(page, 'Any focus', 'Lucky');
}

/** A build made in one pass, and the sheet it creates, to compare a tweaked build against. */
async function freshSheet(browser: import('@playwright/test').Browser, build: Build) {
  const page = await browser.newPage();
  await fill(page, build);
  const sheet = await create(page);
  await page.close();
  return sheet;
}

test('a fresh roll after switching methods does not reopen the stats dialog', async ({ page }) => {
  await page.goto('/#/builder');
  await choose(page, 'People', 'Goblin');
  await openStep(page, 'Attributes');
  await page.getByRole('radio', { name: 'Roll 3d6 in order' }).check();
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Reroll' }).click();
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await page.getByRole('radio', { name: 'Standard array' }).check();
  await page.getByRole('radio', { name: 'Roll 3d6 in order' }).check();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
  await expect(page.locator('section.step', { hasText: '2. Attributes' })).toContainText(
    'Rerolls: 0 of 3',
  );
});

test('an unfinished standard array is still there after visiting other steps', async ({ page }) => {
  await page.goto('/#/builder');
  await choose(page, 'People', 'Goblin');
  await openStep(page, 'Attributes');
  await choose(page, 'Strength', '14');
  await openStep(page, 'Background');
  await openStep(page, 'Attributes');
  await expect(page.getByRole('combobox', { name: 'Strength', exact: true })).toHaveValue('14');
});

test('dropping a background skill clears a focus replacement that depended on it', async ({
  page,
}) => {
  await page.goto('/#/builder');
  await choose(page, 'People', 'Orc');
  await openStep(page, 'Attributes');
  for (const [attr, value] of STANDARD) await choose(page, attr, value);
  await openStep(page, 'Background');
  await choose(page, 'Background', 'Raider');
  await choose(page, 'Learning pick 1', 'Sneak');
  await choose(page, 'Learning pick 2', 'Exert');
  await openStep(page, 'Class');
  await choose(page, 'Class', 'Warrior');
  await openStep(page, 'Foci');
  // Raider's free Stab plus War-bred's Stab leaves Armsmaster's Stab already level-1.
  await choose(page, 'Bonus skill for War-bred', 'Stab');
  await choose(page, 'Combat focus', 'Armsmaster');
  await choose(page, 'Replacement skill for Combat focus', 'Notice');
  await choose(page, 'Racial focus', { index: 1 });
  await choose(page, 'Any focus', 'Lucky');
  await expect(stepError(page, '5. Foci')).toHaveCount(0);

  // Scavenger gives no Stab, so Armsmaster takes Stab outright and the replacement is moot.
  await openStep(page, 'Background');
  await choose(page, 'Background', 'Scavenger');
  await choose(page, 'Learning pick 1', 'Notice');
  await choose(page, 'Learning pick 2', 'Trade');
  await openStep(page, 'Foci');
  await expect(stepError(page, '5. Foci')).toHaveCount(0);
  await expect(
    page.getByRole('combobox', { name: 'Replacement skill for Combat focus' }),
  ).toHaveCount(0);
});

test('changing the people late matches a fresh build of that people', async ({ browser }) => {
  const page = await browser.newPage();
  await fill(page);
  await openStep(page, 'People');
  await choose(page, 'People', 'Orc');
  // The people change clears the foci and gear, which the Orc build sets again.
  await openStep(page, 'Foci');
  await foci(page, { racial: { index: 1 }, orc: true });
  await openStep(page, 'Gear');
  await page.getByRole('radio', { name: 'Starting package' }).check();
  await choose(page, 'Package', 'Shield Wall');
  await openStep(page, 'Name and goal');
  const fromTweak = await create(page);
  await page.close();
  expect(fromTweak).toBe(await freshSheet(browser, { people: 'Orc', racial: { index: 1 } }));
});

test('changing a racial focus late matches a fresh build with it', async ({ browser }) => {
  const page = await browser.newPage();
  await fill(page);
  await openStep(page, 'Foci');
  await choose(page, 'Racial focus', { index: 2 });
  await openStep(page, 'Name and goal');
  const fromTweak = await create(page);
  await page.close();
  expect(fromTweak).toBe(await freshSheet(browser, { racial: { index: 2 } }));
});

test('changing a background pick late matches a fresh build with that pick', async ({
  browser,
}) => {
  const page = await browser.newPage();
  await fill(page);
  await openStep(page, 'Background');
  await choose(page, 'Learning pick 2', 'Survive');
  await openStep(page, 'Foci');
  await foci(page, { racial: 'Alert', orc: false });
  await openStep(page, 'Name and goal');
  const fromTweak = await create(page);
  await page.close();
  expect(fromTweak).toBe(await freshSheet(browser, { learning2: 'Survive' }));
});

test('switching to a people the background is not open to drops that background', async ({
  page,
}) => {
  await page.goto('/#/builder');
  await choose(page, 'People', 'Orc');
  await openStep(page, 'Background');
  await choose(page, 'Background', 'Pit-fighter');
  await openStep(page, 'People');
  await choose(page, 'People', 'Goblin');
  await openStep(page, 'Background');
  await expect(page.getByRole('combobox', { name: 'Background', exact: true })).toHaveValue('');
});

test('switching class and back late in the wizard matches a fresh build', async ({ browser }) => {
  const page = await browser.newPage();
  await fill(page);
  await openStep(page, 'Class');
  await choose(page, 'Class', 'Expert');
  await choose(page, 'Class', 'Warrior');
  await openStep(page, 'Foci');
  // Changing class clears the foci, so the Warrior's picks come back in again.
  await expect(page.getByRole('combobox', { name: 'Racial focus', exact: true })).toHaveValue('');
  await foci(page, { racial: 'Alert', orc: false });
  await openStep(page, 'Name and goal');
  const fromTweak = await create(page);
  await page.close();
  expect(fromTweak).toBe(await freshSheet(browser, {}));
});

test('changing an attribute late in the wizard matches a build made with that array', async ({
  browser,
}) => {
  const swapped = [
    ['Strength', '12'],
    ['Dexterity', '14'],
    ['Constitution', '11'],
    ['Intelligence', '10'],
    ['Wisdom', '9'],
    ['Charisma', '7'],
  ] as const;

  const page = await browser.newPage();
  await fill(page);
  await openStep(page, 'Attributes');
  // Dexterity gives up its 12 first, since each score can appear once in the array.
  await choose(page, 'Dexterity', '–');
  await choose(page, 'Strength', '12');
  await choose(page, 'Dexterity', '14');
  await openStep(page, 'Name and goal');
  const fromTweak = await create(page);
  await page.close();
  expect(fromTweak).toBe(await freshSheet(browser, { array: swapped }));
});
