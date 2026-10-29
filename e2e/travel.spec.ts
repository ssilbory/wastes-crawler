import { expect, test, type Page } from '@playwright/test';

// Sam's ask: Travel on to a targeted hex, the list of keys behind `?`, and the full journey log.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

async function begin(page: Page) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(
    starters.length,
  );
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('travel-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
}

test('travels on toward a targeted hex until it arrives or something stops it', async ({
  page,
}) => {
  await begin(page);
  await page.evaluate((key) => {
    const save = JSON.parse(localStorage.getItem(key) as string);
    save.destination = { col: 5, row: 10 };
    localStorage.setItem(key, JSON.stringify(save));
  }, WORLD_KEY);
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
  const before = await page.locator('.world-bar .date').innerText();
  await page.keyboard.press('g');
  // Either the quarter plan says why it stopped, or an encounter waits.
  const plan = page.getByRole('region', { name: 'Quarter plan' });
  const encounter = page.getByRole('dialog', { name: 'Encounter' });
  await expect(plan.locator('.bump').or(encounter)).toBeVisible();
  await expect(page.locator('.world-bar .date')).not.toHaveText(before);
});

test('lists the keys behind ? and searches the full journal', async ({ page }) => {
  await begin(page);
  await page.keyboard.press('?');
  const keys = page.getByRole('dialog', { name: 'Keys' });
  await expect(keys).toContainText('Travel on toward the targeted hex');
  await page.keyboard.press('Escape');
  await expect(keys).toHaveCount(0);
  await page.getByRole('button', { name: 'Full log' }).click();
  const log = page.getByRole('dialog', { name: 'Journey log' });
  await expect(log.getByRole('listitem').first()).toBeVisible();
  await log.getByRole('searchbox', { name: 'Search' }).fill('no line says this');
  await expect(log.getByRole('listitem')).toHaveCount(0);
  await expect(log).toContainText('0 of');
  await log.getByRole('button', { name: 'Close' }).click();
  await expect(log).toHaveCount(0);
});

async function edit(page: Page, change: string) {
  await page.evaluate(
    ([key, body]) => {
      const save = JSON.parse(localStorage.getItem(key as string) as string);
      new Function('save', body as string)(save);
      localStorage.setItem(key as string, JSON.stringify(save));
    },
    [WORLD_KEY, change],
  );
  await page.reload();
  await page.getByRole('button', { name: 'Continue journey' }).click();
}

test('sets course for a quest, and for the nearest town', async ({ page }) => {
  await begin(page);
  await edit(page, `save.quests['bandit-camp'] = { status: 'active', step: 0, acceptedDay: 0 };`);
  await page.getByRole('button', { name: /^Set course for / }).click();
  const plan = page.getByRole('region', { name: 'Quarter plan' });
  await expect(plan.getByRole('button', { name: 'Travel on' })).toBeVisible();
  await edit(page, `save.position = { col: 4, row: 8 }; save.visited.push('4,8');`);
  await plan.getByRole('button', { name: 'Nearest town' }).click();
  await expect(plan).toContainText('Heading for Rubblegate.');
});

test('weighs an encounter before the party chooses to fight', async ({ page }) => {
  await begin(page);
  await edit(
    page,
    `save.encounter = {
       enemies: [['thug-or-militia']], nature: 'hostile', reaction: 'expected', parleyed: false,
       captive: null, quest: null, offer: null, hostile: true, spotted: true, text: 'Thugs.',
     };`,
  );
  const meeting = page.getByRole('dialog', { name: 'Encounter' });
  await expect(meeting).toContainText(/Looks \w+: the party wins \d+% of trial fights/);
});
