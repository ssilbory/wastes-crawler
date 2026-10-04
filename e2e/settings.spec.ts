import { expect, test, type Page } from '@playwright/test';

// Phase 11b: settings. Remapped keys move the party underground, text size and combat speed
// apply, and settings survive a reload. Sound is synthesized and can't be heard here; turning it
// on and testing it must simply not fail.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

async function intoBarrow(page: Page) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await page.getByRole('link', { name: 'Overland' }).click();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('settings-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    save.position = { col: 5, row: 10 };
    save.visited.push('4,9', '5,10');
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();
}

test('remaps keys, sizes text, and keeps settings across a reload', async ({ page }, testInfo) => {
  await page.goto('/#/settings');
  const keys = page.getByRole('region', { name: 'Keys' });
  await keys.getByRole('button', { name: 'Forward key 1', exact: true }).click();
  await expect(keys.getByRole('button', { name: 'Forward key 1', exact: true })).toHaveText(
    'Press a key…',
  );
  await page.keyboard.press('i');
  await expect(keys.getByRole('button', { name: 'Forward key 1', exact: true })).toHaveText('I');
  await page.getByRole('combobox', { name: 'Text size' }).selectOption('large');
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');
  await page.getByRole('checkbox', { name: 'Sound on' }).check();
  await page.getByRole('button', { name: 'Test' }).click();
  await page.screenshot({ path: testInfo.outputPath('settings.png'), fullPage: true });
  await page.reload();
  await expect(keys.getByRole('button', { name: 'Forward key 1', exact: true })).toHaveText('I');
  await expect(page.locator('html')).toHaveAttribute('data-text-size', 'large');

  await intoBarrow(page);
  const bar = page.locator('.world-bar');
  await expect(bar).toContainText('Turn 1, step 1 of 12');
  await page.keyboard.press('w');
  await expect(bar).toContainText('Turn 1, step 1 of 12');
  await page.keyboard.press('i');
  await expect(bar).toContainText('Turn 1, step 2 of 12');
  // Search has a key too.
  await page.keyboard.press('f');
  await expect(bar).toContainText('Turn 2');
});

test('plays out auto-resolve a round at a time at a slower speed', async ({ page }) => {
  await page.goto('/#/settings');
  await page.getByRole('combobox', { name: 'Auto-resolve speed' }).selectOption('fast');
  await intoBarrow(page);
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    save.encounter = {
      enemies: [['predator-small-vicious']],
      nature: 'hostile',
      reaction: 'expected',
      parleyed: false,
      captive: null,
      offer: null,
      quest: null,
      hostile: true,
      spotted: false,
      text: 'Something small and vicious scuttles out of the dark.',
    };
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await page
    .getByRole('region', { name: 'Encounter' })
    .getByRole('button', { name: 'Fight' })
    .click();
  await page.getByRole('button', { name: 'Auto-resolve' }).click();
  // Not over at once: the first round is still on screen.
  await expect(page.locator('.round')).toHaveText('Round 1');
  await expect(page.getByRole('status')).toBeVisible({ timeout: 10000 });
});
