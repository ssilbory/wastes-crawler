import type { FactionAsset, FactionAttribute } from '../../../src/data/schemas/index.ts';
import { findHeading, parseTables, proseText, sectionLines, slug } from '../markdown.ts';
import { parseDice, parseInt10 } from '../parse-values.ts';
import type { SrdReader } from '../reader.ts';

const FILES: Record<FactionAttribute, string> = {
  cunning: '6.0 Factions/Cunning Assets.md',
  force: '6.0 Factions/Force Assets.md',
  wealth: '6.0 Factions/Wealth Assets.md',
};

const LETTERS: Record<string, FactionAttribute> = { F: 'force', C: 'cunning', W: 'wealth' };

/** "1d6 damage" or "None". */
function parseDamage(text: string, where: string): FactionAsset['counter'] {
  if (text === 'None') return null;
  const m = /^(\S+) damage$/.exec(text);
  if (!m?.[1]) throw new Error(`${where}: bad damage "${text}"`);
  return parseDice(m[1]);
}

/** "F v. C/1d6 damage", "C v. C/Special", "Special", or "None". */
function parseAttack(text: string, where: string): FactionAsset['attack'] {
  if (text === 'None') return null;
  if (text === 'Special') return { kind: 'special' };
  const m = /^([FCW]) v\. ([FCW])\/(.+)$/.exec(text);
  const attacker = LETTERS[m?.[1] ?? ''];
  const defender = LETTERS[m?.[2] ?? ''];
  if (!m?.[3] || !attacker || !defender) throw new Error(`${where}: bad attack "${text}"`);
  const damage = m[3] === 'Special' ? null : parseDamage(m[3], where);
  return { kind: 'check', attacker, defender, damage };
}

const QUALITIES = { Subtle: 'subtle', Action: 'action', Special: 'special' } as const;

function parseQualities(text: string, where: string): FactionAsset['qualities'] {
  if (text === '') return [];
  return text.split(',').map((q) => {
    const quality = QUALITIES[q.trim() as keyof typeof QUALITIES];
    if (!quality) throw new Error(`${where}: bad quality "${q}"`);
    return quality;
  });
}

/** Each asset's paragraphs, from its "**Name:**" paragraph up to the next asset's. */
function descriptions(lines: string[]): Map<string, string> {
  const texts = new Map<string, string[]>();
  let current: string[] = [];
  for (const line of lines) {
    const m = /^\*\*([^*:]+):\*\*\s*(.*)$/.exec(line.trim());
    if (m?.[1]) {
      current = [m[2] ?? ''];
      texts.set(m[1], current);
    } else current.push(line);
  }
  return new Map([...texts].map(([name, body]) => [name, proseText(body)]));
}

function extractFile(reader: SrdReader, attribute: FactionAttribute): FactionAsset[] {
  const file = FILES[attribute];
  const doc = reader.doc(file);
  const top = findHeading(doc, /Assets$/);
  const texts = descriptions(sectionLines(doc, top));
  return doc.headings
    .filter((h) => h.level === 4)
    .flatMap((heading) => {
      const rating = parseInt10(heading.text.replace(/^\D+/, ''));
      return parseTables(sectionLines(doc, heading)).flatMap((table) =>
        table.rows.map((row): FactionAsset => {
          if (row.length !== 7) throw new Error(`${file}: ${row[0]} has ${row.length} cells`);
          const [name, cost, hp, magic, attack, counter, qualities] = row as [
            string,
            string,
            string,
            string,
            string,
            string,
            string,
          ];
          const where = `${file}: ${name}`;
          const text = texts.get(name);
          if (!text) throw new Error(`${where}: no description`);
          return {
            id: slug(name),
            name,
            source: { file, heading: heading.text },
            attribute,
            rating,
            cost: parseInt10(cost),
            hp: parseInt10(hp),
            magic: magic.toLowerCase() as FactionAsset['magic'],
            attack: parseAttack(attack, where),
            counter: parseDamage(counter, where),
            qualities: parseQualities(qualities, where),
            text,
          };
        }),
      );
    });
}

export function extractFactionAssets(reader: SrdReader): FactionAsset[] {
  return (['force', 'cunning', 'wealth'] as const).flatMap((a) => extractFile(reader, a));
}
