import type { Attribute, Cost, Dice } from '../../src/data/schemas/index.ts';

export function parseDice(text: string): Dice {
  const m = /^(\d+)d(\d+)(?:([+-])(\d+))?$/.exec(text.replace(/\s+/g, ''));
  if (!m?.[1] || !m[2]) throw new Error(`not a dice expression: "${text}"`);
  const modifier = m[3] && m[4] ? Number(m[4]) * (m[3] === '-' ? -1 : 1) : 0;
  return { count: Number(m[1]), sides: Number(m[2]), modifier };
}

export function parseCost(text: string): Cost | null {
  const t = text.trim();
  if (t === '-' || t === '' || /^none$/i.test(t)) return null;
  const m = /^([\d,]+)\s*(cp|sp|gp)$/.exec(t);
  if (!m?.[1] || !m[2]) throw new Error(`not a cost: "${text}"`);
  return { amount: Number(m[1].replace(/,/g, '')), unit: m[2] as Cost['unit'] };
}

/** "+3" or "-1" or "3". */
export function parseSigned(text: string): number {
  const m = /^([+-]?)(\d+)$/.exec(text.trim());
  if (!m?.[2]) throw new Error(`not a signed integer: "${text}"`);
  return Number(m[2]) * (m[1] === '-' ? -1 : 1);
}

export function parseInt10(text: string): number {
  const t = text.trim();
  if (!/^\d+$/.test(t)) throw new Error(`not an integer: "${text}"`);
  return Number(t);
}

const ATTRIBUTES: Record<string, Attribute> = {
  str: 'str',
  dex: 'dex',
  con: 'con',
  int: 'int',
  wis: 'wis',
  cha: 'cha',
};

export function parseAttributes(text: string): Attribute[] {
  return text.split('/').map((part) => {
    const a = ATTRIBUTES[part.trim().toLowerCase()];
    if (!a) throw new Error(`not an attribute: "${part}"`);
    return a;
  });
}
