// The full journey log, searched and filtered (Sam's ask). The filters look for the words such lines
// use (the notes in src/game), so they are a quick sieve, not a record of what each line is. Pure.

export type LogFilter = 'all' | 'fights' | 'loot' | 'quests' | 'deaths';

export const LOG_FILTERS: Record<LogFilter, { label: string; words: RegExp | null }> = {
  all: { label: 'Everything', words: null },
  fights: {
    label: 'Fights',
    words: /\b(fights?|fought|wins|rounds?|ambush\w*|attacks?|flees?|encounters?)\b/i,
  },
  loot: { label: 'Loot and coin', words: /\b(loot|crowns|cache|vault|hoard|treasure)\b/i },
  quests: { label: 'Quests', words: /\b(quests?|rewards?)\b|: done\.| has failed/i },
  deaths: {
    label: 'Deaths',
    words: /\b(dies|died|dead|slain|killed|falls|mortally|lost for good)\b/i,
  },
};

/** The lines that pass the filter and hold the text, newest first, keyed by place in the log. */
export function filterLog(
  log: readonly string[],
  filter: LogFilter,
  text: string,
): { key: number; line: string }[] {
  const words = LOG_FILTERS[filter].words;
  const needle = text.trim().toLowerCase();
  return log
    .map((line, key) => ({ key, line }))
    .filter(
      ({ line }) =>
        (!words || words.test(line)) && (!needle || line.toLowerCase().includes(needle)),
    )
    .reverse();
}
