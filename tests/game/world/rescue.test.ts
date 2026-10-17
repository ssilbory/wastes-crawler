import { describe, expect, it } from 'vitest';
import { freeCaptive } from '../../../src/game/world/rescue.ts';
import { data, world } from './helpers.ts';

describe('freeing a captive (docs/rules-adaptation.md, NPCs in Phase 6c)', () => {
  it('names no town when the captive is bound for none the party knows', () => {
    const w = world([2]);
    const lost = {
      ...data,
      content: {
        ...data.content,
        captives: data.content.captives.map((c) =>
          c.id === 'merchant' ? { ...c, destination: 'nowhere' } : c,
        ),
      },
    };
    expect(freeCaptive(w, lost, 'merchant')).toBe(true);
    expect(w.npcs).toMatchObject([{ kind: 'captive', type: 'merchant' }]);
    expect(w.log.at(-1)).toMatch(/joins the party until they reach safety\.$/);
  });
});
