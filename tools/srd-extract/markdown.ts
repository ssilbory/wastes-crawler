import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface Heading {
  level: number;
  text: string;
  /** Index into MdDoc.lines. */
  line: number;
}

export interface MdDoc {
  /** Path relative to the vendor root, used in source citations. */
  file: string;
  lines: string[];
  headings: Heading[];
}

export interface Table {
  header: string[];
  rows: string[][];
}

export function parseDoc(file: string, text: string): MdDoc {
  let lines = text.replace(/\r\n/g, '\n').split('\n');
  if (lines[0] === '---') {
    const end = lines.indexOf('---', 1);
    if (end > 0) lines = lines.slice(end + 1);
  }
  const headings: Heading[] = [];
  lines.forEach((line, i) => {
    const m = /^(#{1,6})\s+(.*?)\s*$/.exec(line);
    if (m?.[1] && m[2] !== undefined) headings.push({ level: m[1].length, text: m[2], line: i });
  });
  return { file, lines, headings };
}

export function readDoc(root: string, file: string): MdDoc {
  return parseDoc(file, readFileSync(join(root, file), 'utf8'));
}

export function findHeading(doc: MdDoc, match: string | RegExp): Heading {
  const found = doc.headings.find((h) =>
    typeof match === 'string' ? h.text === match : match.test(h.text),
  );
  if (!found) throw new Error(`${doc.file}: no heading matching ${String(match)}`);
  return found;
}

/** The headings nested directly or indirectly under `parent`. */
export function childHeadings(doc: MdDoc, parent: Heading): Heading[] {
  const out: Heading[] = [];
  for (const h of doc.headings) {
    if (h.line <= parent.line) continue;
    if (h.level <= parent.level) break;
    out.push(h);
  }
  return out;
}

/** Lines after `heading`, up to the next heading of any level unless `nested` is true. */
export function sectionLines(doc: MdDoc, heading: Heading, nested = false): string[] {
  const next = doc.headings.find(
    (h) => h.line > heading.line && (nested ? h.level <= heading.level : true),
  );
  return doc.lines.slice(heading.line + 1, next ? next.line : doc.lines.length);
}

function splitRow(line: string): string[] {
  const body = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return body.split(/(?<!\\)\|/).map((cell) => cleanInline(cell));
}

export function parseTables(lines: string[]): Table[] {
  const tables: Table[] = [];
  for (let i = 0; i < lines.length; i++) {
    const header = lines[i];
    const align = lines[i + 1];
    if (!header?.trim().startsWith('|') || !align || !/^\|?[\s:|-]+\|?$/.test(align.trim())) {
      continue;
    }
    const table: Table = { header: splitRow(header), rows: [] };
    let j = i + 2;
    for (; j < lines.length && lines[j]?.trim().startsWith('|'); j++) {
      const row = splitRow(lines[j] ?? '');
      if (row.some((cell) => cell !== '')) table.rows.push(row);
    }
    tables.push(table);
    i = j - 1;
  }
  return tables;
}

/** Strips link and emphasis markup and repairs sentences joined without a space. */
export function cleanInline(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\{%[^%]*%\}/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\\([*#|_])/g, '$1')
    .replace(/([a-z)’'”])\.([A-Z])/g, '$1. $2')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

/** Joins wrapped lines into paragraphs separated by blank lines. */
export function proseText(lines: string[]): string {
  const paragraphs: string[] = [];
  let current: string[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') {
      if (current.length > 0) paragraphs.push(cleanInline(current.join(' ')));
      current = [];
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) paragraphs.push(cleanInline(current.join(' ')));
  return paragraphs.join('\n\n');
}

export interface Bullet {
  name: string;
  text: string;
}

/** Parses "- **Name**: text" bullets, including indented continuation lines. */
export function parseBullets(lines: string[]): Bullet[] {
  const bullets: Bullet[] = [];
  let current: { name: string; parts: string[] } | undefined;
  const flush = () => {
    if (current) bullets.push({ name: current.name, text: cleanInline(current.parts.join(' ')) });
    current = undefined;
  };
  for (const raw of lines) {
    const m = /^[-*]\s+\*\*(.+?)\*\*:?\s*(.*)$/.exec(raw);
    if (m?.[1] !== undefined) {
      flush();
      current = { name: m[1].replace(/:$/, '').trim(), parts: [m[2] ?? ''] };
    } else if (current && /^\s+\S/.test(raw)) {
      current.parts.push(raw.trim());
    } else if (raw.trim() === '') {
      continue;
    } else {
      flush();
    }
  }
  flush();
  return bullets;
}

export function slug(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
