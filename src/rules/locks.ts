// Locks and chest traps (docs/rules-adaptation.md, Locks and chests). Sneak picks locks and defeats
// traps (vendor/wwn-srd/1.0 Character Creation/1.2.0 Skills.md); picking a lock or disarming a
// trap takes a turn (vendor/wwn-srd/2.0 The Rules of the Game/2.13.0 Dungeon Exploration.md); the
// difficulties sit on the SRD's 6 to 14 scale and gear moves a check within its -2 to +2
// (2.3.0 Skill Checks.md, 2.3.1). Forcing a lock with Str/Exert, and what springs a chest's trap,
// are Sam's calls.

export interface LockDifficulty {
  base: number;
  perLevels: number;
  cap: number;
}

/** The lock's and its trap's difficulty for a vault or chest of this level. */
export function lockDifficulty(rule: LockDifficulty, level: number): number {
  return Math.min(rule.cap, rule.base + Math.floor(Math.max(0, level) / rule.perLevels));
}

export type LockMethod = 'pick' | 'force';

export interface LockAttempt {
  method: LockMethod;
  success: boolean;
  /** How far the check fell short of the difficulty; 0 on a success. */
  missedBy: number;
  /** The chest's trap is still set: neither disarmed nor already sprung. */
  armed: boolean;
}

/**
 * What an attempt on a lock does: a success opens it. Forcing springs an armed trap whatever the
 * roll; picking springs it only on a miss by 2 or more, as a fumbled disarm does.
 */
export function attemptLock(a: LockAttempt): { opens: boolean; springs: boolean } {
  const springs = a.armed && (a.method === 'force' || (!a.success && a.missedBy >= 2));
  return { opens: a.success, springs };
}

/** A disarm attempt: a success makes the trap safe; a miss by 2 or more springs it. */
export function attemptDisarm(success: boolean, missedBy: number): 'disarmed' | 'sprung' | 'held' {
  if (success) return 'disarmed';
  return missedBy >= 2 ? 'sprung' : 'held';
}
