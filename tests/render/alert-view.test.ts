import { describe, expect, it } from 'vitest';
import { step } from '../../src/game/dungeon/explore.ts';
import { addMemberStrain } from '../../src/game/world/members.ts';
import { abandonQuest } from '../../src/game/world/quest-board.ts';
import {
  addAlerts,
  alertSnapshot,
  alertsSince,
  STRAIN_WINDOW,
  type Alert,
} from '../../src/render/alert-view.ts';
import { below, place } from '../game/dungeon/helpers.ts';
import { data, member, world } from '../game/world/helpers.ts';

describe('alerts', () => {
  it('warns of strain taken while time passes, with Broken and death', () => {
    const w = world();
    const before = alertSnapshot(w);
    w.quarter += 1;
    addMemberStrain(w, data, member(w, 'Snag'), 1, 'condition');
    expect(alertsSince(before, w, data)).toEqual([
      {
        kind: 'strain',
        title: 'Snag: +1 strain',
        text: expect.stringMatching(/^Strain 1\/\d+\.$/),
      },
    ]);
    const later = alertSnapshot(w);
    w.quarter += 1;
    const snag = member(w, 'Snag');
    snag.character = { ...snag.character, strain: { value: 9, broken: true } };
    expect(alertsSince(later, w, data)[0]?.text).toMatch(/Snag is Broken\.$/);
    w.quarter += 1;
    const last = alertSnapshot(w);
    w.quarter += 1;
    snag.dead = true;
    w.log.push('Day 1, Morning: Snag dies of exhaustion and privation.');
    expect(alertsSince(last, w, data)).toEqual([
      { kind: 'strain', title: 'Snag has died', text: 'Snag dies of exhaustion and privation.' },
    ]);
    // The dead give no more warnings.
    expect(alertsSince(alertSnapshot(w), w, data)).toEqual([]);
  });

  it('says nothing of strain when no time passed, or strain went down', () => {
    const w = world();
    const before = alertSnapshot(w);
    addMemberStrain(w, data, member(w, 'Snag'), 1, 'push');
    expect(alertsSince(before, w, data)).toEqual([]);
    const strained = alertSnapshot(w);
    w.quarter += 1;
    const snag = member(w, 'Snag');
    snag.character = { ...snag.character, strain: { value: 0, broken: false } };
    expect(alertsSince(strained, w, data)).toEqual([]);
  });

  it('passes over the dead and anyone who joined since, and dates nothing it cannot find', () => {
    const w = world();
    const snag = member(w, 'Snag');
    const before = alertSnapshot(w);
    w.quarter += 1;
    w.members.push({
      ...snag,
      id: 'newcomer',
      character: { ...snag.character, name: 'Newcomer', strain: { value: 2, broken: false } },
    });
    expect(alertsSince(before, w, data)).toEqual([]);
    w.members.pop();
    snag.dead = true;
    expect(alertsSince(before, w, data)).toEqual([
      { kind: 'strain', title: 'Snag has died', text: '' },
    ]);
    const dead = alertSnapshot(w);
    w.quarter += 1;
    snag.character = { ...snag.character, strain: { value: 3, broken: false } };
    expect(alertsSince(dead, w, data)).toEqual([]);
  });

  it('tells of quests taken, moved on, done, paid, and failed', () => {
    const w = world();
    let before = alertSnapshot(w);
    w.quests['bandit-camp'] = { status: 'active', step: 0, acceptedDay: 0 };
    expect(alertsSince(before, w, data)).toEqual([
      {
        kind: 'quest',
        title: 'Quest taken: The Raider Camp',
        text: expect.stringContaining('Break the raider camp'),
      },
    ]);
    before = alertSnapshot(w);
    expect(alertsSince(before, w, data)).toEqual([]);
    w.quests['bandit-camp'] = { status: 'ready', step: 1, acceptedDay: 0 };
    expect(alertsSince(before, w, data)).toEqual([
      {
        kind: 'quest',
        title: 'Quest done: The Raider Camp',
        text: expect.stringMatching(/^Return to .+ for the reward\.$/),
      },
    ]);
    before = alertSnapshot(w);
    w.quests['bandit-camp'] = { status: 'done', step: 1, acceptedDay: 0 };
    expect(alertsSince(before, w, data)[0]?.title).toBe('Quest complete: The Raider Camp');
    w.quests.surveyor = { status: 'active', step: 0, acceptedDay: 0 };
    before = alertSnapshot(w);
    expect(abandonQuest(w, data, 'surveyor')).toEqual({ ok: true });
    expect(alertsSince(before, w, data)).toEqual([
      {
        kind: 'quest',
        title: expect.stringMatching(/^Quest failed: /),
        text: expect.stringContaining('has failed: abandoned.'),
      },
    ]);
  });

  it('tells of a quest moved on a step', () => {
    const w = world();
    w.quests['barrow-torc'] = { status: 'active', step: 0, acceptedDay: 0 };
    const before = alertSnapshot(w);
    w.quests['barrow-torc'] = { status: 'active', step: 1, acceptedDay: 0 };
    expect(alertsSince(before, w, data)).toEqual([
      {
        kind: 'quest',
        title: "Quest updated: The Barrow-King's Torc",
        text: expect.stringContaining('Destroy the golems guarding the east hall'),
      },
    ]);
  });

  it('names the quest item the party picks up', () => {
    const w = place(below(), 'barrow-upper', 4, 0, 'e');
    w.quests['barrow-torc'] = { status: 'active', step: 2, acceptedDay: 0 };
    const before = alertSnapshot(w);
    expect(step(w, data, 'forward')).toEqual({ ok: true });
    expect(alertsSince(before, w, data)).toContainEqual({
      kind: 'quest',
      title: 'Quest item found',
      text: expect.stringMatching(
        /^The Barrow-King's Torc: the party takes the barrow-king's torc\. Return to .+ for the reward\.$/,
      ),
    });
  });
});

describe('the inn notice', () => {
  it('says whether a show paid for the beds, with any tips', () => {
    const w = world();
    let before = alertSnapshot(w);
    w.performedDay = w.day;
    w.log.push(
      'Day 1, Evening: Grukk plays the common room, and the inn gives the party its beds for the night.',
      'Day 1, Evening: The crowd throws 3 crowns in tips.',
    );
    expect(alertsSince(before, w, data)).toEqual([
      {
        kind: 'inn',
        title: 'A good night at the inn',
        text: 'Grukk plays the common room, and the inn gives the party its beds for the night. The crowd throws 3 crowns in tips.',
      },
    ]);
    // Nothing more until the next night's show.
    expect(alertsSince(alertSnapshot(w), w, data)).toEqual([]);
    w.day += 1;
    before = alertSnapshot(w);
    w.performedDay = w.day;
    w.log.push('Day 2, Evening: Grukk plays to a cold room. The inn still wants paying.');
    expect(alertsSince(before, w, data)).toEqual([
      {
        kind: 'inn',
        title: 'A cold room',
        text: 'Grukk plays to a cold room. The inn still wants paying.',
      },
    ]);
  });

  it('says nothing when the journal holds no show for the night', () => {
    const w = world();
    const before = alertSnapshot(w);
    w.performedDay = w.day;
    w.log.push('Day 1, Evening: The party sleeps.');
    expect(alertsSince(before, w, data)).toEqual([]);
  });
});

describe('the strain window (Sam’s ask)', () => {
  const strain = (title: string): Alert => ({ kind: 'strain', title, text: `${title} text` });
  const quest = (title: string): Alert => ({ kind: 'quest', title, text: '' });

  it('opens one window for the first strain notices, newest first', () => {
    const { shown, nextId } = addAlerts([], [strain('Snag: +1'), strain('Grukk: +2')], 0, 5);
    expect(shown).toEqual([
      {
        kind: 'strain',
        title: STRAIN_WINDOW,
        text: '',
        id: 0,
        entries: [
          { title: 'Grukk: +2', text: 'Grukk: +2 text' },
          { title: 'Snag: +1', text: 'Snag: +1 text' },
        ],
      },
    ]);
    expect(nextId).toBe(1);
  });

  it('adds later strain to the open window under the same id, and other notices beside it', () => {
    const first = addAlerts([], [strain('Snag: +1')], 0, 5);
    const later = addAlerts(first.shown, [strain('Snag: +1 again'), quest('Quest taken')], 1, 5);
    expect(later.shown).toHaveLength(2);
    const [window, other] = later.shown;
    expect(window?.id).toBe(0);
    expect(window?.entries?.map((e) => e.title)).toEqual(['Snag: +1 again', 'Snag: +1']);
    expect(other).toEqual({ kind: 'quest', title: 'Quest taken', text: '', id: 1 });
    expect(later.nextId).toBe(2);
    // Nothing new leaves it as it was.
    expect(addAlerts(later.shown, [], 2, 5)).toEqual({ shown: later.shown, nextId: 2 });
    // More strain grows the window and leaves the other notices as they are.
    const more = addAlerts(later.shown, [strain('Grukk: +1')], 2, 5);
    expect(more.shown[0]?.entries).toHaveLength(3);
    expect(more.shown[1]).toBe(later.shown[1]);
  });

  it('opens a fresh window once the last was dismissed', () => {
    const first = addAlerts([], [strain('Snag: +1')], 0, 5);
    const dismissed = first.shown.filter((a) => a.kind !== 'strain');
    const again = addAlerts(dismissed, [strain('Grukk: +1')], first.nextId, 5);
    expect(again.shown).toMatchObject([{ id: 1, entries: [{ title: 'Grukk: +1' }] }]);
  });

  it('lets the oldest other notices give way, never the strain window', () => {
    const open = addAlerts([], [strain('Snag: +1')], 0, 3);
    const full = addAlerts(open.shown, [quest('a'), quest('b'), quest('c')], open.nextId, 3);
    expect(full.shown.map((a) => a.title)).toEqual([STRAIN_WINDOW, 'b', 'c']);
  });
});
