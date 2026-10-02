import type { Focus, Skill } from '../../../src/data/schemas/index.ts';
import {
  childHeadings,
  cleanInline,
  findHeading,
  parseBullets,
  proseText,
  sectionLines,
  slug,
} from '../markdown.ts';
import type { SrdReader } from '../reader.ts';

export function extractSkills(reader: SrdReader): Skill[] {
  const doc = reader.doc('1.0 Character Creation/1.2.0 Skills.md');
  const heading = findHeading(doc, /The Skill List$/);
  return parseBullets(sectionLines(doc, heading)).map((b) => ({
    id: slug(b.name),
    name: b.name,
    source: { file: doc.file, heading: heading.text },
    description: b.text,
  }));
}

export function extractFoci(reader: SrdReader): Focus[] {
  const doc = reader.doc('1.0 Character Creation/1.6.0 Foci.md');
  const list = findHeading(doc, /Focus List$/);
  return childHeadings(doc, list)
    .filter((h) => h.level === list.level + 1)
    .map((h) => {
      const paragraphs = proseText(sectionLines(doc, h)).split('\n\n');
      const description: string[] = [];
      const levels: { level: number; parts: string[] }[] = [];
      for (const p of paragraphs) {
        const m = /^Level (\d):\s*(.*)$/s.exec(p);
        if (m?.[1]) levels.push({ level: Number(m[1]), parts: [m[2] ?? ''] });
        else if (levels.length > 0) levels.at(-1)?.parts.push(p);
        else description.push(p);
      }
      return {
        id: slug(h.text),
        name: cleanInline(h.text),
        source: { file: doc.file, heading: h.text },
        description: description.join('\n\n'),
        levels: levels.map((l) => ({ level: l.level, text: l.parts.join('\n\n').trim() })),
      };
    });
}
