import { describe, expect, it } from 'vitest';
import { attemptDisarm, attemptLock, lockDifficulty } from './locks.ts';

const rule = { base: 7, perLevels: 2, cap: 12 };

describe('lockDifficulty', () => {
  it('adds a point every two levels', () => {
    expect(lockDifficulty(rule, 1)).toBe(7);
    expect(lockDifficulty(rule, 2)).toBe(8);
    expect(lockDifficulty(rule, 5)).toBe(9);
  });
  it('stops at the cap', () => {
    expect(lockDifficulty(rule, 10)).toBe(12);
    expect(lockDifficulty(rule, 30)).toBe(12);
  });
  it('treats a level below zero as zero', () => {
    expect(lockDifficulty(rule, -3)).toBe(7);
  });
});

describe('attemptLock', () => {
  const pick = { method: 'pick' as const, armed: true };
  it('opens on a success without springing a picked trap', () => {
    expect(attemptLock({ ...pick, success: true, missedBy: 0 })).toEqual({
      opens: true,
      springs: false,
    });
  });
  it('springs an armed trap when a pick misses by 2 or more', () => {
    expect(attemptLock({ ...pick, success: false, missedBy: 2 }).springs).toBe(true);
    expect(attemptLock({ ...pick, success: false, missedBy: 1 }).springs).toBe(false);
  });
  it('always springs an armed trap when forcing', () => {
    expect(attemptLock({ method: 'force', armed: true, success: true, missedBy: 0 })).toEqual({
      opens: true,
      springs: true,
    });
    expect(attemptLock({ method: 'force', armed: true, success: false, missedBy: 1 })).toEqual({
      opens: false,
      springs: true,
    });
  });
  it('springs nothing once the trap is safe', () => {
    expect(attemptLock({ method: 'force', armed: false, success: true, missedBy: 0 }).springs).toBe(
      false,
    );
    expect(attemptLock({ method: 'pick', armed: false, success: false, missedBy: 5 })).toEqual({
      opens: false,
      springs: false,
    });
  });
});

describe('attemptDisarm', () => {
  it('disarms on a success', () => expect(attemptDisarm(true, 0)).toBe('disarmed'));
  it('springs on a miss by 2 or more', () => expect(attemptDisarm(false, 2)).toBe('sprung'));
  it('holds on a near miss', () => expect(attemptDisarm(false, 1)).toBe('held'));
});
