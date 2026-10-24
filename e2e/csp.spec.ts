import { expect, test, type Page } from '@playwright/test';

// The built page carries a strict Content Security Policy (tools/csp.ts). A blocked style, image,
// or eval doesn't fail any other test, so this one opens every page and a fight and fails on any
// policy violation.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

/** Records every policy violation the page reports, from before its first script runs. */
async function watch(page: Page) {
  await page.addInitScript(() => {
    const seen: string[] = [];
    (globalThis as unknown as { violations: string[] }).violations = seen;
    document.addEventListener('securitypolicyviolation', (e) =>
      seen.push(`${e.violatedDirective} ${e.blockedURI} ${e.sourceFile}:${e.lineNumber}`),
    );
  });
}

const violations = (page: Page) =>
  page.evaluate(() => (globalThis as unknown as { violations: string[] }).violations);

test('ships the policy and breaks none of it on any page', async ({ page }) => {
  await watch(page);
  await page.goto('/');
  await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveAttribute(
    'content',
    /script-src 'self'/,
  );
  for (const route of [
    'builder',
    'arena',
    'world',
    'editor',
    'maps',
    'settings',
    'help',
    'about',
  ]) {
    await page.goto(`/#/${route}`);
    await expect(page.locator('main, .arena, .world, .editor').first()).toBeVisible();
    expect(await violations(page)).toEqual([]);
  }
});

test('fights on the overland map, its difficulty worker and all, within the policy', async ({
  page,
}) => {
  await watch(page);
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
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
      text: 'Something small and vicious scuttles out of the brush.',
    };
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  const encounter = page.getByRole('region', { name: 'Encounter' });
  await encounter.getByRole('button', { name: /^(Fight|Attack them)$/ }).click();
  await page.getByRole('button', { name: 'Auto-resolve' }).click();
  // The way back waits on the difficulty worker's verdict.
  await page.getByRole('button', { name: /^Back to the (map|dungeon)$/ }).click();
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
  expect(await violations(page)).toEqual([]);
});
