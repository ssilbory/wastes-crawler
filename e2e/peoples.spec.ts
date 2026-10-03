import { expect, test, type Page } from '@playwright/test';

// The Phase 3b exit criterion (docs/plan.md): build a valid character of every people. Each one is
// also exported and re-imported, so the saved file carries the people and lineage.
const CASES: {
  people: string;
  lineage?: string;
  bg: string;
  picks: [string, string];
  dex: number;
  size: string;
  /** Racial picks and bonus skill choices, as [select label, option]. */
  foci: [string, string][];
}[] = [
  {
    people: 'Goblin',
    bg: 'Scavenger',
    picks: ['Sneak', 'Trade'],
    dex: 14,
    size: 'small',
    foci: [['Racial focus', 'Alert']],
  },
  {
    people: 'Orc',
    bg: 'Pit-fighter',
    picks: ['Exert', 'Notice'],
    dex: 12,
    size: 'standard',
    foci: [
      ['Bonus skill for War-bred', 'Stab'],
      ['Racial focus', 'Authority'],
    ],
  },
  {
    people: 'Elf',
    bg: 'Warden',
    picks: ['Sneak', 'Heal'],
    dex: 14,
    size: 'standard',
    foci: [
      ['Racial focus 1', 'Cultured'],
      ['Racial focus 2', 'Specialist'],
      ['Bonus skill for Racial focus 2', 'Survive'],
    ],
  },
  {
    people: 'Centaur',
    lineage: 'Lion',
    bg: 'Outrider',
    picks: ['Shoot', 'Exert'],
    dex: 12,
    size: 'large',
    foci: [
      ['Bonus skill for Pounce', 'Stab'],
      ['Racial focus', 'Armsmaster'],
    ],
  },
  {
    people: 'Beastman',
    bg: 'Tunneler',
    picks: ['Exert', 'Craft'],
    dex: 12,
    size: 'standard',
    foci: [['Racial focus', 'Die Hard']],
  },
  {
    people: 'Gnome',
    bg: 'Hedge-scholar',
    picks: ['Magic', 'Heal'],
    dex: 12,
    size: 'small',
    foci: [
      ['Racial focus 1', 'Artisan'],
      ['Racial focus 2', 'Polymath'],
      ['Bonus skill for Racial focus 2', 'Trade'],
    ],
  },
];

async function build(page: Page, c: (typeof CASES)[number]) {
  const select = (label: string, option: string) =>
    page.getByRole('combobox', { name: label, exact: true }).selectOption({ label: option });
  await select('People', c.people);
  if (c.lineage) await select('Lineage', c.lineage);
  const array = { Strength: 14, Dexterity: 12, Constitution: 11, Intelligence: 10, Wisdom: 9 };
  for (const [attr, v] of Object.entries(array)) await select(attr, String(v));
  await select('Charisma', '7');
  await select('Background', c.bg);
  await select('Learning pick 1', c.picks[0]);
  await select('Learning pick 2', c.picks[1]);
  await select('Class', 'Full Expert');
  for (const [label, option] of c.foci) await select(label, option);
  await select('Non-combat focus', 'Lucky');
  await select('Any focus', 'Well Met');
  await select('Free skill', 'Lead');
  await page.getByRole('radio', { name: 'Starting package' }).check();
  await select('Package', 'Wanderer');
  await page.getByRole('textbox', { name: 'Name', exact: true }).fill(`${c.people} tester`);
  await page.getByRole('button', { name: 'Create character' }).click();
}

for (const c of CASES) {
  const label = c.lineage ? `${c.people} (${c.lineage})` : c.people;
  test(`builds and re-imports: ${label}`, async ({ page }, testInfo) => {
    await page.goto('/');
    await build(page, c);
    const sheet = page.getByTestId('character-sheet');
    await expect(sheet).toContainText(`${label} Full Expert, level 1. Background: ${c.bg}.`);
    await expect(sheet).toContainText(`Dexterity${c.dex}`);
    await expect(sheet).toContainText(`Size${c.size}`);
    const before = await sheet.innerText();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export JSON' }).click();
    const file = testInfo.outputPath(`${c.people}.json`);
    await (await download).saveAs(file);
    await page.reload();
    await page.getByLabel('Import character file').setInputFiles(file);
    await expect(sheet).toBeVisible();
    expect(await sheet.innerText()).toBe(before);
  });
}

test('offers only backgrounds open to the chosen people, and clears one that no longer fits', async ({
  page,
}) => {
  await page.goto('/');
  const select = (label: string, option: string) =>
    page.getByRole('combobox', { name: label, exact: true }).selectOption({ label: option });
  const background = page.getByRole('combobox', { name: 'Background', exact: true });
  await select('People', 'Goblin');
  await select('Background', 'Tunneler');
  await expect(background.locator('option', { hasText: 'Outrider' })).toHaveCount(0);
  await select('People', 'Centaur');
  await expect(background).toHaveValue('');
  await expect(background.locator('option', { hasText: 'Tunneler' })).toHaveCount(0);
  await expect(background.locator('option', { hasText: 'Outrider' })).toHaveCount(1);
});
