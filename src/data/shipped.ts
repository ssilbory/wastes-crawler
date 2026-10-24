// The JSON shipped in data/ is fixed when the game is built, and the test suite proves each file
// parses with its schema to exactly itself (tests/shipped-data.test.ts). So a production build
// takes it as it is: parsing it again on every load was half the startup time on a slow phone.
// Development, the tests, and the tools still parse it. Saves, imports, and editor work, which
// come from players, are always parsed.

/** `json` parsed with `schema`, or taken as is in a production build. */
export function parseShipped(schema: { parse: (raw: unknown) => unknown }, json: unknown): unknown {
  // Undefined under the tools, which run outside Vite.
  return import.meta.env?.PROD === true ? json : schema.parse(json);
}
