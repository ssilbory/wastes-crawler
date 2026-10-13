# Presentation plan

The plan for continued development after the rules and content phases in
`docs/plan.md`. Those phases held the renderer to wireframe until the game
loop was complete (plan.md, Risks: Renderer rabbit hole). The loop is
complete now, so this plan turns to how the game looks and how its fights
read.

## Ground rules (Sam's calls)

- **No external assets for now.** Every texture, glyph, and portrait is
  generated in code: SVG geometry from `src/render/`, drawn by `src/ui/`. If
  generated art doesn't hold up, the fallback is images made from prompts to
  an image model, checked into the repo as our own work. No third-party art
  packs.
- **Layers stay as they are.** `src/render/` returns plain drawing data
  (points, path strings, colors) and stays covered at 100%. `src/ui/` only
  turns that data into elements and CSS.
- **Deterministic.** Variation (which stone is cracked, where a joint
  falls) comes from a hash of the cell and side, never from an RNG, so a
  view looks the same on every visit and in every screenshot. Game
  randomness still goes only through the seeded RNG.
- **Motion is optional.** Flicker and transitions are CSS animations, off
  under `prefers-reduced-motion`. Playwright screenshots freeze animations,
  so baselines stay stable.
- **Presentation is not rules.** Nothing here changes a roll, a number, or a
  turn. Any combat change that does (stage V5) needs a ruling in
  `docs/rules-adaptation.md` first.
- **Screenshots.** Each stage that changes the look updates the e2e
  baselines in the same PR, so the diff shows the change.

## Stages

| Stage | Scope                                                                                                                                                                                                                                                                                            | Exit                                                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| V1    | Dungeon view. Light falloff and tint by source (torch, lantern, Light of Faith, sight without light), dimming as the light's die steps down, torch flicker. Perspective-correct procedural detail: coursed stone on walls, planks and iron bands on doors, flagstones on the floor, stair treads | Done: see V1 below. The level editor's test walk shares the same view                                   |
| V2    | Overland map. Terrain glyphs per hex (trees, hills, peaks, reeds, ripples) as SVG symbols, roads and rivers as paths joining hex edges, a parchment and ink theme, icons for towns, dungeons, groves, and exits, soft-edged fog, a party token, and a tint for the quarter of the day            | Every terrain in `data/content/terrains.json` has a glyph; map editor and game share them               |
| V3    | Combat presentation. Generated silhouettes by monster type and by people and class, floating damage and Shock numbers, hit and miss flashes, a turn-order strip, hit chance and damage range on hover (read from `src/rules/attacks.ts`), reach lines from `formation.ts`, log filters by side   | The command menu shows odds before every attack; no change to `pnpm sim` results                        |
| V4    | Dungeon furniture. Floor and wall features (rubble, bones, altars, fountains, braziers) as a new field in the level format and the editor, an encounter portrait over the view, a compass on the automap, step and turn transitions                                                              | `content-guide.md` documents the field; `pnpm validate:levels` passes                                   |
| V5    | Combat mechanics, only with rulings: mid-fight formation swaps, Fighting Withdrawal, readied actions                                                                                                                                                                                             | Each one has its ruling in `docs/rules-adaptation.md` and its SRD citation before code                  |
| V6    | Prompted art, only if V1 to V4 fall short: portraits and textures from an image model, kept in `public/art/`, with the prompt beside each file so it can be made again                                                                                                                           | A decision recorded as an ADR in `docs/decisions/`, including the license we put on the generated files |

## V1: dungeon view (done)

| Piece        | Where                                               | What it does                                                                                                                                                                                                                                                                                                          |
| ------------ | --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Light        | `src/render/dungeon-light.ts`                       | What lights the view and how: tint, reach, and whether it flickers. Torches flicker warm orange, lanterns burn steadier and further, Light of Faith is pale gold and still, and sight without light is a cold grey with short reach                                                                                   |
| Reach        | same                                                | Reach follows the light's die (1 + die / 4 cells): a fresh lantern lights the whole corridor, a guttering torch two cells. Each panel darkens by its distance, along it for walls and floors running away, so a near wall is never shadowed by the dark beyond it                                                     |
| Detail       | `src/render/dungeon-detail.ts`                      | Mortar lines and joints, door planks, bands, and ring, flagstones, ceiling beams, and stair treads, laid out in each panel's own perspective quad so they recede with it                                                                                                                                              |
| View         | `src/render/dungeon-view.ts`, `dungeon-geometry.ts` | Floor cells now come back as panels so their flagstones draw, and every panel carries its detail path                                                                                                                                                                                                                 |
| Traps        | `src/render/trap-art.ts`                            | A known trap: a pressure plate with spike holes (damage), needle holes and a green stain (poison), or spilled filth (disease); a tripwire wall to wall at ankle height (alarm). The party's chalk ring circles each one. A disarmed trap stays in view, its plate wedged or its wire cut and its chalk struck through |
| Drawing      | `src/ui/world/DungeonView.tsx`                      | One SVG for the game and the editor's test walk: each panel with its detail and its shadow, then the light's tint glowing up from the party                                                                                                                                                                           |
| Flicker, CSS | `src/ui/world/world.css`                            | Torch flicker keyframes on the shadows and tint, off under `prefers-reduced-motion`                                                                                                                                                                                                                                   |
