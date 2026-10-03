// How keys and actions read on the settings page. Pure.
import type { KeyAction } from '../data/schemas/index.ts';

const NAMES: Record<string, string> = {
  ArrowUp: '↑',
  ArrowDown: '↓',
  ArrowLeft: '←',
  ArrowRight: '→',
  ' ': 'Space',
};

export const keyLabel = (key: string) => NAMES[key] ?? (key.length === 1 ? key.toUpperCase() : key);

export const ACTION_NAMES: Record<KeyAction, string> = {
  forward: 'Forward',
  back: 'Back',
  'turn-left': 'Turn left',
  'turn-right': 'Turn right',
  'step-left': 'Step left',
  'step-right': 'Step right',
  search: 'Search',
};
