import { devices, expect, test, type Page } from '@playwright/test';
import { importAndOpen } from './wizard.ts';

// Phones, installing, and offline play: the About page, the full-screen toggle, the web app
// manifest and service worker, and the world screens at phone width.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';
// A phone's screen and touch, without the device's browser choice (a describe can't set that).
const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = devices['Pixel 7'];
const pixel = { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch };

/** No screen is wider than the phone: nothing scrolls sideways. */
async function fitsWidth(page: Page) {
  const over = await page.evaluate(() =>
    [...document.querySelectorAll('#app *')]
      // Drawing inside an SVG is clipped to it; the SVG itself is checked.
      .filter((el) => !el.parentElement?.closest('svg'))
      .filter((el) => !el.closest('.map-wrap'))
      // The bar's readouts scroll sideways in their own row; the row itself is checked.
      .filter((el) => !el.parentElement?.closest('.bar-status'))
      .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
      .map((el) => `${el.tagName}.${el.getAttribute('class') ?? ''}`),
  );
  expect(over).toEqual([]);
}

test.describe('on a phone', () => {
  test.use(pixel);

  test('opens About from the menu, with install steps and credits', async ({ page }) => {
    await page.goto('/#/builder/new');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('link', { name: 'About' }).click();
    await expect(page.getByRole('heading', { name: 'About', level: 1 })).toBeVisible();
    await expect(page.getByRole('region', { name: 'Play anywhere' })).toContainText(
      'Add to Home Screen',
    );
    await expect(page.getByRole('region', { name: 'Why this game' })).toContainText(
      "The Bard's Tale",
    );
    await expect(page.getByRole('region', { name: 'If you like this game' })).toContainText(
      'Forbidden Lands',
    );
    await expect(page.getByRole('region', { name: 'Credits' })).toContainText(
      'Worlds Without Number',
    );
    await expect(page.getByRole('region', { name: 'Software' })).toContainText('OFL-1.1');
    await fitsWidth(page);
  });

  test('opens Help from the menu, with the keys as set', async ({ page }) => {
    await page.goto('/#/builder/new');
    await page.getByRole('button', { name: 'Menu' }).click();
    await page.getByRole('link', { name: 'Help' }).click();
    await expect(page.getByRole('heading', { name: 'Help', level: 1 })).toBeVisible();
    await expect(page.getByText('It is designed that way')).toBeVisible();
    await page.getByText('Controls', { exact: true }).click();
    await expect(page.getByRole('row', { name: 'Forward W or ↑' })).toBeVisible();
    await page.getByText('Gameplay', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Strain (stress)' })).toBeVisible();
    await fitsWidth(page);
  });

  test('taps ⓘ to read a spell, with its in-game line', async ({ page }) => {
    await importAndOpen(page, 'tools/sim/parties/starter/fizzwick.json', 'Fizzwick');
    const sheet = page.getByTestId('character-sheet');
    await sheet.getByRole('button', { name: 'About The Coruscating Coffin' }).tap();
    const dialog = page.getByRole('dialog', { name: 'The Coruscating Coffin' });
    await expect(dialog).toContainText('In game: 1d8 per caster level to one enemy');
    // It takes focus, and Escape hands it back to the ⓘ that opened it.
    await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(sheet.getByRole('button', { name: 'About The Coruscating Coffin' })).toBeFocused();
    await sheet.getByRole('button', { name: 'About The Coruscating Coffin' }).tap();
    await dialog.getByRole('button', { name: 'Close' }).tap();
    await expect(dialog).toHaveCount(0);
  });

  test('plays the map, a town, and a dungeon in one column', async ({ page }) => {
    await page.goto('/#/arena');
    await page.getByLabel('Import character files').setInputFiles(starters);
    await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(2);
    await page.goto('/#/world');
    await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
    await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
    await page
      .getByRole('combobox', { name: 'Front row, slot 2' })
      .selectOption({ label: 'Grukk' });
    await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('mobile-e2e');
    await page.getByRole('button', { name: 'Start a new world' }).click();
    await page.getByRole('button', { name: 'Begin the journey' }).click();

    // The map spans the screen, with the quarter's plans under it.
    const map = page.locator('.map-wrap');
    const box = await map.boundingBox();
    expect(box?.width).toBeGreaterThan(300);
    await fitsWidth(page);

    // The readouts take one row, and Export and Abandon wait behind More, so the map starts high.
    const status = await page.locator('.bar-status').boundingBox();
    expect(status?.height).toBeLessThan(60);
    expect(box?.y).toBeLessThan(240);
    await expect(page.getByRole('button', { name: 'Export save' })).toBeHidden();
    await page.getByRole('button', { name: 'More' }).tap();
    await expect(page.getByRole('button', { name: 'Export save' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Abandon world' })).toBeVisible();
    await page.getByRole('button', { name: 'More' }).tap();
    await expect(page.getByRole('button', { name: 'Abandon world' })).toBeHidden();

    // Every control on the screen is big enough to tap.
    const small = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>('#app button, #app select')]
        .filter((el) => el.getClientRects().length > 0)
        .filter((el) => el.getBoundingClientRect().height < 44)
        .map((el) => el.textContent || el.getAttribute('aria-label')),
    );
    expect(small).toEqual([]);

    await page.getByRole('button', { name: 'Visit Rubblegate' }).click();
    await expect(page.getByRole('button', { name: 'Back to the map' })).toBeVisible();
    await fitsWidth(page);
    await page.getByRole('button', { name: 'Back to the map' }).click();

    await page.evaluate((key) => {
      const save = JSON.parse(localStorage.getItem(key) as string);
      save.position = { col: 5, row: 10 };
      save.visited.push('4,9', '5,10');
      localStorage.setItem(key, JSON.stringify(save));
    }, WORLD_KEY);
    await page.reload();
    await page.getByRole('button', { name: 'Continue journey' }).click();
    await page.getByRole('button', { name: 'Enter The Old Barrow' }).click();

    // The view fills the width and the movement pad is big enough to tap.
    const view = await page.getByRole('img', { name: 'Dungeon view' }).boundingBox();
    expect(view?.width).toBeGreaterThan(350);
    const forward = page.getByRole('button', { name: 'Forward' });
    expect((await forward.boundingBox())?.height).toBeGreaterThanOrEqual(44);
    await forward.tap();
    await expect(page.locator('.world-bar')).toContainText('step 2 of 12');
    await fitsWidth(page);
  });
});

test('keeps hover text, not ⓘ buttons, with a mouse', async ({ page }) => {
  await importAndOpen(page, 'tools/sim/parties/starter/fizzwick.json', 'Fizzwick');
  const sheet = page.getByTestId('character-sheet');
  await expect(sheet.getByText('The Coruscating Coffin')).toHaveAttribute('title', /In game:/);
  await expect(sheet.getByRole('button', { name: /^About / })).toHaveCount(0);
});

test('toggles full screen from the menu', async ({ page }) => {
  await page.goto('/#/builder/new');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Full screen' }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(true);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Leave full screen' }).click();
  await expect.poll(() => page.evaluate(() => !!document.fullscreenElement)).toBe(false);
});

test('links a web app manifest with installable icons', async ({ page, request }) => {
  await page.goto('/#/builder/new');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  const manifest = await (await request.get(href as string)).json();
  expect(manifest).toMatchObject({
    name: 'Wastes Crawler',
    display: 'fullscreen',
    start_url: './',
  });
  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const icon of manifest.icons) expect((await request.get(icon.src)).ok()).toBe(true);
});

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' });

  test('keeps playing with no connection after one visit', async ({ page, context }) => {
    await page.goto('/#/builder/new');
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
    });
    // The first load isn't controlled by the worker; a reload is.
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Next: Attributes ▸' })).toBeVisible();
    await page.goto('/#/about');
    await expect(page.getByRole('heading', { name: 'About', level: 1 })).toBeVisible();
  });
});
