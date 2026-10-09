import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { openStep } from './wizard.ts';

// The Phase 3c exit criterion (docs/plan.md): the builder enforces foci counts and pick lists for
// every people. Expectations come straight from the content files.
interface Named {
  id: string;
  name: string;
}
interface PeopleData extends Named {
  signatureFoci: string[];
  racialFocusPicks: string[];
  lineages?: (Named & { signatureFoci: string[] })[];
}
const read = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const peoples = read<PeopleData[]>('data/content/peoples.json');
const names = new Map(
  [...read<Named[]>('data/srd/foci.json'), ...read<Named[]>('data/content/racial-foci.json')].map(
    (f) => [f.id, f.name],
  ),
);
const name = (id: string) => names.get(id) ?? id;

const CASES = peoples.flatMap((p) =>
  (p.lineages ?? [undefined]).map((l) => ({
    people: p,
    lineage: l,
    signature: [...p.signatureFoci, ...(l?.signatureFoci ?? [])],
  })),
);

async function setUp(page: Page, people: string, lineage: string | undefined) {
  const select = (label: string, option: string) =>
    page.getByRole('combobox', { name: label, exact: true }).selectOption({ label: option });
  await page.goto('/');
  await select('People', people);
  if (lineage) await select('Lineage', lineage);
  const array = [14, 12, 11, 10, 9, 7];
  const attrs = ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'];
  await openStep(page, 'Attributes');
  for (const [i, attr] of attrs.entries()) await select(attr, String(array[i]));
  await openStep(page, 'Background');
  await select('Background', 'Raider');
  await select('Learning pick 1', 'Sneak');
  await select('Learning pick 2', 'Exert');
  await openStep(page, 'Class');
  await select('Class', 'Warrior');
  return select;
}

const optionsOf = async (page: Page, label: string) =>
  (
    await page.getByRole('combobox', { name: label, exact: true }).locator('option').allInnerTexts()
  ).slice(1);

for (const c of CASES) {
  const label = c.lineage ? `${c.people.name} (${c.lineage.name})` : c.people.name;
  test(`enforces racial and class foci: ${label}`, async ({ page }) => {
    const select = await setUp(page, c.people.name, c.lineage?.name);
    await openStep(page, 'Foci');
    const step = page.locator('section.step', { hasText: '5. Foci' });

    // Signature foci are given, and the rest of the three come from the people's list.
    for (const id of c.signature) await expect(step).toContainText(`${name(id)} (signature)`);
    const racialCount = 3 - c.signature.length;
    const racialLabels =
      racialCount === 1
        ? ['Racial focus']
        : Array.from({ length: racialCount }, (_, i) => `Racial focus ${i + 1}`);
    await expect(step.getByRole('combobox', { name: /^Racial focus/ })).toHaveCount(racialCount);
    for (const l of racialLabels) {
      expect(await optionsOf(page, l)).toEqual(c.people.racialFocusPicks.map(name));
    }

    // Class picks: combat-only for the Warrior pick, and never a focus already held racially.
    // A Herd beastman's three racial foci are all signature foci.
    const first = racialCount > 0 ? (c.people.racialFocusPicks[0] as string) : undefined;
    if (first) await select(racialLabels[0] as string, name(first));
    const combat = await optionsOf(page, 'Combat focus');
    const any = await optionsOf(page, 'Any focus');
    expect(combat).not.toContain('Lucky');
    expect(combat).toContain('Poisoner'); // counts as both combat and non-combat
    expect(any).toContain('Rider'); // back with mounts
    expect(any).not.toContain('Unique Gift'); // left out of the setting
    expect(any).toContain('Lucky');
    for (const id of [...c.signature, ...(first ? [first] : [])]) {
      expect(combat).not.toContain(name(id));
      expect(any).not.toContain(name(id));
    }
    await expect(page.locator('section.step', { hasText: '5. Foci' })).not.toContainText('✓');
  });
}
