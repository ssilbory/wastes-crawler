// The overland calendar (docs/rules-adaptation.md, Calendar): quarter days roll up into days and
// 12 months of seasons, configured in data/content/overland-rules.json.
import type { OverlandRules } from '../../data/schemas/index.ts';
import { QUARTERS, type Quarter, type Season } from '../../rules/overland.ts';

export interface CalendarDate {
  year: number;
  /** 0-based month index. */
  month: number;
  monthName: string;
  /** 1-based day of the month. */
  dayOfMonth: number;
  season: Season;
}

export function dateOf(rules: OverlandRules, day: number): CalendarDate {
  const fromYearStart = rules.start.month * rules.daysPerMonth + rules.start.day - 1 + day;
  const year = Math.floor(fromYearStart / (12 * rules.daysPerMonth)) + 1;
  const inYear = fromYearStart % (12 * rules.daysPerMonth);
  const month = Math.floor(inYear / rules.daysPerMonth);
  const entry = rules.months[month] as OverlandRules['months'][number];
  return {
    year,
    month,
    monthName: entry.name,
    dayOfMonth: (inYear % rules.daysPerMonth) + 1,
    season: entry.season,
  };
}

export const quarterName = (q: number): Quarter => QUARTERS[q] as Quarter;

export function describeDate(rules: OverlandRules, day: number, quarter: number): string {
  const d = dateOf(rules, day);
  const q = quarterName(quarter);
  const when = `${q.charAt(0).toUpperCase()}${q.slice(1)}`;
  return `${when}, ${d.dayOfMonth} ${d.monthName}, year ${d.year} (${d.season})`;
}
