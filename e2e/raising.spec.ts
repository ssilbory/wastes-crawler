import { expect, test, type Page } from '@playwright/test';

// Raising the dead: with a PC dead, Rubblegate's necromancer offers a quest whose only reward is
// raising them, and her crypt's own price is halved. The offer and cooldown rules are unit tested.
const starters = ['snag', 'grukk'].map((n) => `tools/sim/parties/starter/${n}.json`);
const WORLD_KEY = 'wastes-crawler.world';

async function start(page: Page) {
  await page.goto('/#/arena');
  await page.getByLabel('Import character files').setInputFiles(starters);
  await expect(page.getByRole('region', { name: 'Roster' }).getByRole('listitem')).toHaveCount(
    starters.length,
  );
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('link', { name: 'Overland' }).click();
  // The arena has a formation of its own: wait for the Overland page before picking slots.
  await expect(page.getByRole('heading', { name: 'Overland', level: 1 })).toBeVisible();
  await page.getByRole('combobox', { name: 'Front row, slot 1' }).selectOption({ label: 'Snag' });
  await page.getByRole('combobox', { name: 'Front row, slot 2' }).selectOption({ label: 'Grukk' });
  await page.getByRole('textbox', { name: 'Seed (optional)' }).fill('raising-e2e');
  await page.getByRole('button', { name: 'Start a new world' }).click();
  await page.getByRole('button', { name: 'Begin the journey' }).click();
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

test('the necromancer offers a raising quest, and its reward raises the dead', async ({
  page,
}, testInfo) => {
  await start(page);
  // Snag is dead, and the party is one hex out of Rubblegate.
  await edit(
    page,
    `save.members[0].dead = true;
     save.members[0].character.hp.current = 0;
     save.position = { col: 4, row: 8 };
     save.visited.push('4,8');`,
  );
  await page.locator('[data-hex="3,8"]').click();
  await page.getByRole('button', { name: /^(Hike|Camp)$/ }).click();
  const log = page.getByRole('region', { name: 'Journey log' });
  await expect(log).toContainText('Ysolde the Necromancer has work that would raise the dead');

  await page.getByRole('button', { name: 'Visit Rubblegate' }).click();
  const priest = page.getByRole('region', { name: 'Ysolde the Necromancer' });
  await expect(priest).toContainText('Reward: one dead PC raised');
  await page.screenshot({ path: testInfo.outputPath('raising-offer.png'), fullPage: true });
  await priest.getByRole('button', { name: /^Take on / }).click();
  await expect(log).toContainText('The party takes on');

  // The crypt's own price is half what it was: 125 crowns a level.
  await page.getByRole('tab', { name: 'Inn and healer' }).click();
  await expect(page.getByRole('region', { name: 'Crypt' })).toContainText(
    'Raise Snag (125 crowns)',
  );

  // Its step done, the quest's only reward is raising Snag.
  await edit(page, `for (const id in save.quests) save.quests[id].status = 'ready';`);
  await page.getByRole('button', { name: 'Visit Rubblegate' }).click();
  await page
    .getByRole('region', { name: 'Ysolde the Necromancer' })
    .getByRole('button', { name: 'Raise Snag' })
    .click();
  await expect(log).toContainText('Ysolde the Necromancer raises Snag');
  await page.screenshot({ path: testInfo.outputPath('raising-done.png'), fullPage: true });
});
