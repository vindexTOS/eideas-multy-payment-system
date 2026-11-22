/**
 * Earnings are reported by calendar month in Tbilisi time: from the 1st at
 * 00:00:00.000 to the last day at 23:59:59.999, inclusive. Every aggregation
 * uses these helpers (and the SQL month bucket uses BUSINESS_TIME_ZONE), so
 * "a month" means exactly one thing across the platform - whatever zone the
 * server itself runs in.
 */

/**
 * The client's business clock. Georgia is UTC+4 all year (no DST since
 * 2005), but the IANA name is used so a rule change needs no code change.
 * Also used verbatim inside SQL (`AT TIME ZONE`), so it must stay a constant.
 */
export const BUSINESS_TIME_ZONE = 'Asia/Tbilisi';

export interface MonthKey {
  /** `YYYY-MM` */
  month: string;
  year: number;
  /** 1-12 */
  monthNumber: number;
}

export interface MonthRange {
  start: Date;
  end: Date;
  months: MonthKey[];
}

const pad = (n: number): string => String(n).padStart(2, '0');

// Throws at startup if the runtime has no data for the zone: better than
// silently bucketing money into the wrong month.
const wallClock = new Intl.DateTimeFormat('en-US', {
  timeZone: BUSINESS_TIME_ZONE,
  hourCycle: 'h23',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
});

/** The calendar fields an instant shows on a wall clock in Tbilisi. */
const zonedFields = (date: Date) => {
  const fields: Record<string, number> = {};
  for (const part of wallClock.formatToParts(date)) {
    if (part.type !== 'literal') fields[part.type] = Number.parseInt(part.value, 10);
  }
  return fields as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>;
};

/** How far the business zone is ahead of UTC at an instant, in ms (+4h). */
const zoneOffsetMs = (date: Date): number => {
  const f = zonedFields(date);
  const wallAsUtc = Date.UTC(f.year, f.month - 1, f.day, f.hour, f.minute, f.second);
  return wallAsUtc - (date.getTime() - date.getUTCMilliseconds());
};

/** The current (or given) month, as the calendar in Tbilisi shows it. */
const zonedMonth = (date: Date): { year: number; monthNumber: number } => {
  const f = zonedFields(date);
  return { year: f.year, monthNumber: f.month };
};

export const toMonthKey = (date: Date): string => {
  const { year, monthNumber } = zonedMonth(date);
  return `${year}-${pad(monthNumber)}`;
};

export const parseMonthKey = (key: string): { year: number; monthNumber: number } => {
  const match = /^(\d{4})-(\d{1,2})$/.exec(key.trim());
  if (!match) throw new Error(`Invalid month key "${key}", expected YYYY-MM`);
  const year = Number.parseInt(match[1], 10);
  const monthNumber = Number.parseInt(match[2], 10);
  if (monthNumber < 1 || monthNumber > 12) throw new Error(`Invalid month in "${key}"`);
  return { year, monthNumber };
};

/** The 1st at 00:00:00.000 Tbilisi time, as an instant. */
export const startOfMonth = (year: number, monthNumber: number): Date => {
  const wall = Date.UTC(year, monthNumber - 1, 1);
  // The offset is read at the guess and then re-read at the result, so a
  // zone that changes its offset around midnight still lands on midnight.
  const guess = wall - zoneOffsetMs(new Date(wall));
  return new Date(wall - zoneOffsetMs(new Date(guess)));
};

export const addMonths = (year: number, monthNumber: number, delta: number) => {
  const zeroBased = monthNumber - 1 + delta;
  return {
    year: year + Math.floor(zeroBased / 12),
    monthNumber: (((zeroBased % 12) + 12) % 12) + 1,
  };
};

/** Last millisecond of the month in Tbilisi - inclusive end, as the client described. */
export const endOfMonth = (year: number, monthNumber: number): Date => {
  const next = addMonths(year, monthNumber, 1);
  return new Date(startOfMonth(next.year, next.monthNumber).getTime() - 1);
};

/**
 * Builds the full, gap-free list of months in the window. Charts need every
 * month present (a month with zero payments must render as a zero column,
 * not disappear), which a plain GROUP BY cannot give us.
 */
export const buildMonthRange = (input: {
  from?: string;
  to?: string;
  months?: number;
  now?: Date;
}): MonthRange => {
  const now = input.now ?? new Date();
  let fromY: number;
  let fromM: number;
  let toY: number;
  let toM: number;

  if (input.from || input.to) {
    const to = input.to ? parseMonthKey(input.to) : zonedMonth(now);
    const from = input.from ? parseMonthKey(input.from) : to;
    fromY = from.year;
    fromM = from.monthNumber;
    toY = to.year;
    toM = to.monthNumber;
  } else {
    const count = Math.max(1, input.months ?? 12);
    ({ year: toY, monthNumber: toM } = zonedMonth(now));
    const start = addMonths(toY, toM, -(count - 1));
    fromY = start.year;
    fromM = start.monthNumber;
  }

  if (fromY * 12 + fromM > toY * 12 + toM) {
    [fromY, fromM, toY, toM] = [toY, toM, fromY, fromM];
  }

  const months: MonthKey[] = [];
  let cursor = { year: fromY, monthNumber: fromM };
  const lastIndex = toY * 12 + toM;
  // Hard cap so a bogus range cannot build a million rows.
  while (cursor.year * 12 + cursor.monthNumber <= lastIndex && months.length < 120) {
    months.push({
      month: `${cursor.year}-${pad(cursor.monthNumber)}`,
      year: cursor.year,
      monthNumber: cursor.monthNumber,
    });
    cursor = addMonths(cursor.year, cursor.monthNumber, 1);
  }

  return {
    start: startOfMonth(fromY, fromM),
    end: endOfMonth(toY, toM),
    months,
  };
};
