# 0003: Levels are hand-written ASCII, with an in-game editor in Phase 11

Status: accepted, 2026-10-03

## Context

Phase 7 needs a level format before the renderer can draw anything. The plan offered hand-written ASCII only, or ASCII plus an in-game editor later.

## Decision

- Levels are authored as the doubled ASCII grid from the plan (walls on cell edges, cells at odd coordinates), inside level JSON in `data/content/dungeons.json`, with stairs links and feature details keyed by cell.
- `pnpm validate:levels` checks every level: grid shape, glyphs, stairs links, and that every cell is reachable from the entrance.
- An in-game level editor that reads and writes the same format is built in Phase 11, Persistence and polish.

## Consequences

- Claude can write, diff, and validate levels as text from Phase 7 on.
- The editor in Phase 11 must round-trip the ASCII format exactly, so hand-written and edited levels stay interchangeable.
