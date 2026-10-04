import type { Art, Spell } from '../../../src/data/schemas/index.ts';
import {
  cleanInline,
  findHeading,
  parseBullets,
  proseText,
  sectionLines,
  slug,
} from '../markdown.ts';
import type { SrdReader } from '../reader.ts';

const SPELL_FILES: { file: string; tradition: Spell['tradition'] }[] = [
  {
    file: '4.0 Magic and Spellcasting/4.4.0 High Magic Spells by Name.md',
    tradition: 'high-magic',
  },
  { file: '4.0 Magic and Spellcasting/4.5.0 Elementalist Spells.md', tradition: 'elementalist' },
  { file: '4.0 Magic and Spellcasting/4.6.0 Necromancer Spells.md', tradition: 'necromancer' },
];

export function extractSpells(reader: SrdReader): Spell[] {
  return SPELL_FILES.flatMap(({ file, tradition }) => {
    const doc = reader.doc(file);
    return doc.headings
      .filter((h) => h.level === 3)
      .map((h) => {
        const m = /^(.+?)\s+Level\s+(\d)$/.exec(h.text);
        if (!m?.[1] || !m[2])
          throw new Error(`${file}: spell heading without a level: "${h.text}"`);
        const name = cleanInline(m[1]);
        return {
          id: slug(name),
          name,
          source: { file, heading: h.text },
          tradition,
          level: Number(m[2]),
          text: proseText(sectionLines(doc, h)),
        };
      });
  });
}

const CLASS_DIR = '1.0 Character Creation/1.5.0 Class List';

const ART_SECTIONS: {
  file: string;
  heading: RegExp;
  tradition: Art['tradition'];
  automatic: boolean;
}[] = [
  {
    file: `${CLASS_DIR}/1.5.10 The High Mage.md`,
    heading: /High Mage Arts$/,
    tradition: 'high-mage',
    automatic: false,
  },
  {
    file: `${CLASS_DIR}/1.5.7 The Elementalist.md`,
    heading: /^1\.5\.7\.1 Elementalist Arts$/,
    tradition: 'elementalist',
    automatic: true,
  },
  {
    file: `${CLASS_DIR}/1.5.7 The Elementalist.md`,
    heading: /^Other Elementalist Arts$/,
    tradition: 'elementalist',
    automatic: false,
  },
  {
    file: `${CLASS_DIR}/1.5.9 The Healer.md`,
    heading: /^1\.5\.9\.1 Healer Arts$/,
    tradition: 'healer',
    automatic: true,
  },
  {
    file: `${CLASS_DIR}/1.5.9 The Healer.md`,
    heading: /^Other Healer Arts$/,
    tradition: 'healer',
    automatic: false,
  },
  {
    file: `${CLASS_DIR}/1.5.5 The Blood Priest.md`,
    heading: /^1\.5\.5\.1 Blood Priest Arts$/,
    tradition: 'blood-priest',
    automatic: false,
  },
  {
    file: `${CLASS_DIR}/1.5.14 The Necromancer.md`,
    heading: /^1\.5\.14\.1 Necromancer Arts$/,
    tradition: 'necromancer',
    automatic: false,
  },
];

export function extractArts(reader: SrdReader): Art[] {
  return ART_SECTIONS.flatMap(({ file, heading, tradition, automatic }) => {
    const doc = reader.doc(file);
    const h = findHeading(doc, heading);
    return parseBullets(sectionLines(doc, h)).map((b) => ({
      id: slug(b.name),
      name: b.name,
      source: { file, heading: h.text },
      tradition,
      automatic,
      text: b.text,
    }));
  });
}
