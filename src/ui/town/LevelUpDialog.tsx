import { useRef, useState } from 'preact/hooks';
import type { Character } from '../../data/schemas/index.ts';
import { advance, levelPlan, type LevelPlan } from '../../game/character/advance.ts';
import { classOption } from '../../game/character/class-step.ts';
import type { FocusChoice } from '../../game/character/foci.ts';
import type { SpendStep } from '../../game/character/training.ts';
import { levelUpMember, trainMember } from '../../game/world/training.ts';
import { spendPoints } from '../../game/character/training.ts';
import type { World } from '../../game/world/types.ts';
import { levelSummary } from '../../render/level-view.ts';
import { createRng } from '../../rules/rng.ts';
import { data } from '../builder/data.ts';
import { useDialog } from '../dialog.ts';
import { cue } from '../sound.ts';
import { FociPicks, fociNeeds, MagicPicks, magicNeeds, magicPicks } from './LevelPicks.tsx';
import { SkillSpend } from './SkillSpend.tsx';
import type { Act } from './TownScreen.tsx';

type Screen = 'foci' | 'magic' | 'skills';
const TITLES: Record<Screen, string> = {
  foci: 'Foci',
  magic: 'Spells and abilities',
  skills: 'Skills',
};

/** The screens a level shows: only those with something to pick, and skills last. */
function screensFor(c: Character, plan: LevelPlan | null): Screen[] {
  if (!plan) return ['skills'];
  const picks = magicPicks(c, plan);
  return [
    ...(plan.focusPicks.length > 0 ? (['foci'] as const) : []),
    ...(picks.arts + picks.spells > 0 ? (['magic'] as const) : []),
    'skills',
  ];
}

/**
 * One level's screens, or only skills when no level is ready. Nothing changes until the last
 * screen's button, which takes the level and spends the planned points together.
 */
function LevelSteps(props: {
  character: Character;
  plan: LevelPlan | null;
  onCommit: (choices: Parameters<typeof levelUpMember>[3], spend: SpendStep[]) => void;
  onCancel: () => void;
}) {
  const { character: c, plan } = props;
  const [at, setAt] = useState(0);
  const [foci, setFoci] = useState<FocusChoice[]>(plan?.focusPicks.map(() => ({ id: '' })) ?? []);
  const [arts, setArts] = useState<string[]>([]);
  const [spells, setSpells] = useState<string[]>([]);
  const [spend, setSpend] = useState<SpendStep[]>([]);
  const screens = screensFor(c, plan);
  const screen = screens[at] as Screen;
  const choices = { foci: foci.filter((f) => f.id !== ''), arts, spells };
  // The game's own check decides; a throwaway RNG leaves the real one untouched.
  const check = plan ? advance(data, c, choices, createRng('level-check')) : null;
  const base = check?.ok ? check.character : c;
  const needs = !plan
    ? []
    : screen === 'foci'
      ? fociNeeds(c, foci)
      : screen === 'magic'
        ? magicNeeds(c, plan, arts, spells)
        : check && !check.ok
          ? [check.reason]
          : [];
  const last = at === screens.length - 1;
  const spent = spendPoints(data, base, spend).ok;
  return (
    <>
      <p class="hint">
        {plan
          ? `Level ${plan.classLevel} as ${classOption(data, plan.classId)?.name}: +${plan.skillPoints} skill points${plan.quickPoints > 0 ? ` and ${plan.quickPoints} Quick Learner point` : ''}.`
          : `No level is ready for ${c.name}; spend saved points.`}
      </p>
      {screens.length > 1 && (
        <ol class="level-steps" aria-label="Steps">
          {screens.map((s, i) => (
            <li key={s} aria-current={i === at ? 'step' : undefined}>
              {TITLES[s]}
            </li>
          ))}
        </ol>
      )}
      <section class="level-screen" aria-label={TITLES[screen]}>
        <h3>{TITLES[screen]}</h3>
        {plan && screen === 'foci' && (
          <FociPicks character={c} plan={plan} foci={foci} onChange={setFoci} />
        )}
        {plan && screen === 'magic' && (
          <MagicPicks
            character={c}
            plan={plan}
            arts={arts}
            spells={spells}
            onArts={setArts}
            onSpells={setSpells}
          />
        )}
        {screen === 'skills' && <SkillSpend base={base} steps={spend} onChange={setSpend} />}
      </section>
      {needs.length > 0 && (
        <ul class="hint needed" aria-label="Still needed">
          {needs.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <div class="level-nav">
        {at > 0 ? (
          <button type="button" class="secondary" onClick={() => setAt(at - 1)}>
            Back
          </button>
        ) : (
          <button type="button" class="secondary" onClick={props.onCancel}>
            Cancel
          </button>
        )}
        {!last ? (
          <button type="button" disabled={needs.length > 0} onClick={() => setAt(at + 1)}>
            Next
          </button>
        ) : (
          <button
            type="button"
            class="create"
            disabled={needs.length > 0 || !spent || (!plan && spend.length === 0)}
            onClick={() => props.onCommit(choices, spend)}
          >
            {plan ? 'Level up' : 'Spend points'}
          </button>
        )}
      </div>
    </>
  );
}

/** Leveling up as a popup: foci, spells and abilities, then skills; one level after another. */
export function LevelUpDialog(props: {
  world: World;
  memberId: string;
  act: Act;
  onClose: () => void;
}) {
  const box = useRef<HTMLElement>(null);
  const [summary, setSummary] = useState<string[] | null>(null);
  const [round, setRound] = useState(0);
  useDialog({ box, onEscape: props.onClose, trap: true });
  const m = props.world.members.find((x) => x.id === props.memberId);
  if (!m) return null;
  const c = m.character;
  const plan = levelPlan(data, c);
  const commit = (choices: Parameters<typeof levelUpMember>[3], spend: SpendStep[]) => {
    const before = c;
    let done = false;
    props.act(() => {
      const r = plan
        ? cue(levelUpMember(props.world, data, m.id, choices, spend), 'level')
        : trainMember(props.world, data, m.id, (x) => spendPoints(data, x, spend));
      done = r.ok;
      return r;
    });
    if (!done) return;
    if (plan) setSummary(levelSummary(data, before, m.character));
    else props.onClose();
  };
  return (
    <div class="level-backdrop">
      <section
        ref={box}
        class="level-dialog panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Level up ${c.name}`}
        tabIndex={-1}
      >
        <h2>{c.name}</h2>
        {summary ? (
          <section aria-label="Level up summary">
            <ul>
              {summary.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <div class="level-nav">
              {plan && (
                <button
                  type="button"
                  onClick={() => {
                    setSummary(null);
                    setRound(round + 1);
                  }}
                >
                  Next level
                </button>
              )}
              <button type="button" class={plan ? 'secondary' : undefined} onClick={props.onClose}>
                Done
              </button>
            </div>
          </section>
        ) : (
          <LevelSteps
            key={`${round}-${c.xp}-${plan?.classLevel ?? 0}`}
            character={c}
            plan={plan}
            onCommit={commit}
            onCancel={props.onClose}
          />
        )}
      </section>
    </div>
  );
}
