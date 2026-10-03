import { expect, test, type Page } from '@playwright/test';

// Raising quests: with a PC dead, the temple priest offers a quest whose only reward is raising
// them, and the temple's own price is halved. The offer and cooldown rules are unit tested.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

async function start(page: Page) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await page.getByRole('link', { name: 'Overland' }).click();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('raising-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
}

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

test('the temple priest offers a raising quest, and its reward raises the dead', async ({
  page,
}, testInfo) => {
  await start(page);
  // Snag is dead, and the party is one hex out of Westhold.
  await edit(
    page,
    `save.members[0].dead = true;
     save.members[0].character.hp.current = 0;
     save.position = { col: 4, row: 8 };
     save.visited.push('4,8');`,
  );
  await page.locator('[data-hex="3,8"]').click();
  await page.getByRole('button', { name: 'Pass the quarter' }).click();
  const log = page.getByRole('region', { name: 'Journey log' });
  await expect(log).toContainText('Sister Berit has work that would raise the dead');

  await page.getByRole('button', { name: 'Visit Westhold' }).click();
  const priest = page.getByRole('region', { name: 'Sister Berit' });
  await expect(priest).toContainText('Reward: the temple raises one dead PC');
  await page.screenshot({ path: testInfo.outputPath('raising-offer.png'), fullPage: true });
  await priest.getByRole('button', { name: /^Take on / }).click();
  await expect(log).toContainText('The party takes on');

  // The temple's own price is half what it was: 125 crowns a level.
  await page.getByRole('tab', { name: 'Inn and temple' }).click();
  await expect(page.getByRole('button', { name: /^Raise \(/ })).toContainText('125');

  // Its step done, the quest's only reward is raising Snag.
  await edit(page, `for (const id in save.quests) save.quests[id].status = 'ready';`);
  await page.getByRole('button', { name: 'Visit Westhold' }).click();
  await page
    .getByRole('region', { name: 'Sister Berit' })
    .getByRole('button', { name: 'Raise Snag' })
    .click();
  await expect(log).toContainText('Sister Berit raises Snag');
  await page.screenshot({ path: testInfo.outputPath('raising-done.png'), fullPage: true });
});
