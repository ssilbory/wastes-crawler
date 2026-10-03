# 0004: Procedural levels are optional side dungeons

Status: accepted, 2026-10-03

## Context

The plan left procedural levels open until Phase 12: none, optional side dungeons, or the main campaign.

## Decision

Sam's call: optional side dungeons.

- The campaign's dungeons are hand-made in the ASCII format (ADR 0003).
- Seeded procedural ruins sit on some hexes as extra delves for loot, XP, and components. They are generated in the same doubled ASCII format and pass the same validation as `pnpm validate:levels` before the party can enter.
- The generator draws only on the world's seeded RNG, so a world's ruins are the same on every reload.

## Consequences

- No campaign beat depends on a generator; the quest chain and the boss stay authored.
- The generator is built in Phase 12e, after the campaign dungeons.
