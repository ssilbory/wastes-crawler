# 0001: High-level progression

Status: accepted, 2026-10-02

## Context

The WWN SRD stops at 10th level, but the game has no level cap and lets characters switch classes. The plan left four questions open until Phase 2: how class tables continue past 10th, the XP curve past 10th, whether save targets have a floor, and what a character's first level in a new class grants.

## Decision

- Class and casting tables cycle the gains of levels 3 to 10 past 10th level. Level 11 gains what level 3 gained over level 2, through level 18, and then the cycle repeats. Maximum spell level stays at 5.
- XP follows the SRD Fast table to 10th level. Each later step is 3 larger than the one before it: 117 XP for 11th level, 144 for 12th, 174 for 13th.
- Save targets never drop below 2+, the same floor the SRD gives NPCs.
- The first level in a new class grants that class's full level-1 row: hit die, attack bonus, focus picks, and class abilities. Total attack bonus is the sum of each class's table value at that class's own level.

## Consequences

- Levels 3 to 10 set the long-run rate, so the level 1 and 2 bump is never repeated. Tables with uneven gains, such as an Expert's attack bonus or the focus picks, keep their SRD rhythm.
- With a save floor, penalties and disadvantage still matter for high-level characters.
- Switching classes repeatedly gains level-1 rows more than once. The 4th-level requirement in the current class limits how often that can happen.
- Implemented in src/rules/progression.ts, src/rules/advancement.ts, and src/rules/saves.ts.
