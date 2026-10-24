import { expect, test } from '@playwright/test';

// Worlds on custom maps (Sam's calls): create a new world on the Overland start screen, or pick a
// map saved in the map editor, and play on it without the campaign's story.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);

async function party(page: import('@playwright/test').Page) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
}

test('creates a new world on the start screen and plays on it', async ({ page }) => {
  await party(page);
  const world = page.getByRole('group', { name: 'World' });
  await world.getByRole('textbox', { name: 'New world' }).fill('Ash Hollows');
  await world.getByRole('button', { name: 'Create a new world' }).click();
  await expect(world.getByRole('status')).toContainText('Made Ash Hollows');
  await expect(world.getByRole('combobox', { name: 'Play on' })).toHaveValue('ash-hollows');
  await page.getByRole('button', { name: /Start a new world/ }).click();
  // No campaign introduction: straight onto the new map.
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin the journey' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/Slot 1: .* · Ash Hollows · /)).toBeVisible();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
});

test('loads a world saved in the map editor', async ({ page }) => {
  await page.goto('/#/maps');
  const made = page.getByRole('region', { name: 'New map' });
  await made.getByRole('textbox', { name: 'Name' }).fill('Grey Fen');
  await made.getByRole('button', { name: 'Create blank map' }).click();
  await page.getByRole('button', { name: 'Save map*' }).click();
  await party(page);
  const world = page.getByRole('group', { name: 'World' });
  await world.getByRole('combobox', { name: 'Play on' }).selectOption({ label: 'Grey Fen' });
  await expect(world).toContainText('1 towns, no campaign story');
  await page.getByRole('button', { name: /Start a new world/ }).click();
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Slot 1: .* · Grey Fen · /)).toBeVisible();
});

test('plays the Sealed Vale, a world shipped beside the campaign', async ({ page }) => {
  await party(page);
  const world = page.getByRole('group', { name: 'World' });
  await world.getByRole('combobox', { name: 'Play on' }).selectOption({ label: 'The Sealed Vale' });
  await expect(world).toContainText('ringed by impassable peaks');
  await page.getByRole('button', { name: /Start a new world/ }).click();
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin the journey' })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText(/Slot 1: .* · The Sealed Vale · /)).toBeVisible();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
});

test('ends the Sealed Vale at the pass, then keeps adventuring or goes to the title', async ({
  page,
}) => {
  await party(page);
  const world = page.getByRole('group', { name: 'World' });
  await world.getByRole('combobox', { name: 'Play on' }).selectOption({ label: 'The Sealed Vale' });
  await page.getByRole('button', { name: /Start a new world/ }).click();
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
  // As if the party had just cleared the pass's last post.
  const reach = () =>
    page.evaluate(() => {
      const key = 'wastes-crawler.world';
      const save = JSON.parse(localStorage.getItem(key) as string);
      save.realmEnd = 'reached';
      localStorage.setItem(key, JSON.stringify(save));
    });
  await reach();
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  const end = page.getByRole('region', { name: "Journey's end" });
  await expect(end).toContainText('The Sealed Vale is behind you.');
  await end.getByRole('button', { name: 'Keep adventuring' }).click();
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
  // Shown once: continuing the save goes straight back to the map.
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
  await expect(end).toHaveCount(0);
  await reach();
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  await end.getByRole('button', { name: 'Return to the title screen' }).click();
  await expect(page.getByRole('heading', { name: 'Wastes Crawler', level: 1 })).toBeVisible();
});

test('plays the Wastes, a shipped realm of five maps', async ({ page }) => {
  await party(page);
  const world = page.getByRole('group', { name: 'World' });
  await world.getByRole('combobox', { name: 'Play on' }).selectOption({ label: 'The Wastes' });
  await expect(world).toContainText('Five desert maps under a dead sun');
  await page.getByRole('button', { name: /Start a new world/ }).click();
  await expect(page.getByRole('group', { name: 'Overland map' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Begin the journey' })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Warlords' })).toContainText(
    "The Scrap King, The Dust Fringe: holds The Scrap King's Pumpworks",
  );
  await page.reload();
  await expect(page.getByText(/Slot 1: .* · The Wastes · Dustwell · /)).toBeVisible();
});
