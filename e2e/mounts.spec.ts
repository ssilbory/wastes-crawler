import { expect, test, type Page } from '@playwright/test';

// Mounts (docs/rules-adaptation.md, Mounts): bought at the stable, ridden, and loaded in the shop;
// the rules behind them are covered by unit tests.
const starters = ['snag', 'grukk', 'fizzwick'].map((n) => `tools/sim/parties/starter/${n}.json`);

async function startInRubblegate(page: Page) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(3);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page
    .getByRole('combobox', { name: 'Rear row, slot 1' })
    .selectOption({ label: 'Fizzwick' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('mounts-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await page.getByRole('button', { name: 'Visit Rubblegate' }).click();
  await expect(page.getByRole('heading', { name: 'Rubblegate' })).toBeVisible();
}

test('buys a riding goat, puts Snag on it, and loads it', async ({ page }, testInfo) => {
  await startInRubblegate(page);
  await page.getByRole('tab', { name: 'Stable' }).click();
  const sale = page.getByRole('region', { name: 'Mounts for sale' });
  await sale
    .getByRole('listitem')
    .filter({ hasText: 'Riding Goat' })
    .getByRole('button', { name: /^Buy/ })
    .click();
  const mounts = page.getByRole('region', { name: 'Mounts', exact: true });
  await expect(mounts).toContainText('Riding Goat');
  // A goat carries only small riders: Grukk isn't offered.
  const rider = mounts.getByRole('combobox', { name: "Riding Goat's rider" });
  await expect(rider.locator('option')).toHaveText(['No rider', 'Snag', 'Fizzwick']);
  await rider.selectOption({ label: 'Snag' });
  await expect(mounts).toContainText('load 0/3');
  await page.screenshot({ path: testInfo.outputPath('mounts-stable.png'), fullPage: true });

  await page.getByRole('tab', { name: 'Shop', exact: true }).click();
  const pack = page.getByRole('region', { name: "Snag's pack" });
  const line = pack.getByRole('listitem').first();
  const item = (await line.locator('span').first().innerText()).split(' (')[0] as string;
  await line
    .getByRole('combobox', { name: /^Give .* to$/ })
    .selectOption({ label: 'Riding Goat (mount)' });
  await expect(page.getByRole('region', { name: "Riding Goat's load" })).toContainText(item);

  await page.getByRole('button', { name: 'Back to the map' }).click();
  await expect(page.getByRole('region', { name: 'Mounts', exact: true })).toContainText(
    'Riding Goat',
  );
});
