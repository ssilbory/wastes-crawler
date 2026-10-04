export type Step =
  | 'people'
  | 'attributes'
  | 'background'
  | 'class'
  | 'foci'
  | 'magic'
  | 'free-skill'
  | 'gear'
  | 'identity';
export type StepStatus =
  { state: 'incomplete' } | { state: 'ok' } | { state: 'error'; message: string };

export const OK: StepStatus = { state: 'ok' };
export const INCOMPLETE: StepStatus = { state: 'incomplete' };
export const fail = (message: string): StepStatus => ({ state: 'error', message });
