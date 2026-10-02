# Project rules

- Layers: src/rules imports nothing from src/game, src/render, or src/ui.
  src/render never mutates state. Only src/game mutates state.
- Mechanics: before implementing any rule, read the matching file in
  vendor/wwn-srd/ and cite its path in a comment. Never use D&D defaults.
- House rules live only in docs/rules-adaptation.md. If a rule is not in the
  SRD or that file, stop and ask.
- All randomness goes through the injected seeded RNG. No Math.random.
- All content is JSON in data/ with a zod schema. No hardcoded monsters,
  items, or spells in code.
- Every rules function gets Vitest coverage, including edge cases.
- Done means: npm run typecheck && npm run lint && npm test all pass.
- Keep files under ~300 lines. Prefer many small modules.
- Never add a dependency without checking its license is MIT, BSD, Apache,
  ISC, zlib, or CC0.
