import { afterEach, describe, expect, it, vi } from 'vitest';
import { SHIPPED_CONTENT } from '../src/data/content.ts';
import { SHIPPED_SRD } from '../src/data/load.ts';
import { ContentSchemas, SrdSchemas } from '../src/data/schemas/index.ts';
import { parseShipped } from '../src/data/shipped.ts';

// A production build takes the shipped JSON without parsing it (src/data/shipped.ts). That is
// only safe while every file parses to exactly itself: valid, and with nothing the schema would
// strip or fill in.
describe('shipped data', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it.each(Object.keys(ContentSchemas) as (keyof typeof ContentSchemas)[])(
    'content %s parses to itself',
    (name) => {
      expect(ContentSchemas[name].parse(SHIPPED_CONTENT[name])).toStrictEqual(
        SHIPPED_CONTENT[name],
      );
    },
  );

  it.each(Object.keys(SrdSchemas) as (keyof typeof SrdSchemas)[])(
    'SRD %s parses to itself',
    (name) => {
      expect(SrdSchemas[name].parse(SHIPPED_SRD[name])).toStrictEqual(SHIPPED_SRD[name]);
    },
  );

  it('is parsed outside a production build, and taken as is in one', () => {
    const schema = { parse: vi.fn((raw: unknown) => raw) };
    expect(parseShipped(schema, { a: 1 })).toEqual({ a: 1 });
    expect(schema.parse).toHaveBeenCalledTimes(1);
    vi.stubEnv('PROD', true);
    const json = { b: 2 };
    expect(parseShipped(schema, json)).toBe(json);
    expect(schema.parse).toHaveBeenCalledTimes(1);
  });
});
