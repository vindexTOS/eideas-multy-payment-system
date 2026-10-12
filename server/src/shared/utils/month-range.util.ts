/**
 * Earnings are reported by calendar month: from the 1st at 00:00:00.000 to
 * the last day at 23:59:59.999, inclusive. Every aggregation uses these
 * helpers so "a month" means exactly one thing across the platform.
 */
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

export const toMonthKey = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}`;

export const parseMonthKey = (key: string): { year: number; monthNumber: number } => {
  const match = /^(\d{4})-(\d{1,2})$/.exec(key.trim());
  if (!match) throw new Error(`Invalid month key "${key}", expected YYYY-MM`);
  const year = Number.parseInt(match[1], 10);
  const monthNumber = Number.parseInt(match[2], 10);
  if (monthNumber < 1 || monthNumber > 12) throw new Error(`Invalid month in "${key}"`);
  return { year, monthNumber };
};

export const startOfMonthUtc = (year: number, monthNumber: number): Date =>
  new Date(Date.UTC(year, monthNumber - 1, 1, 0, 0, 0, 0));

/** Last millisecond of the month - inclusive end, as the client described. */
export const endOfMonthUtc = (year: number, monthNumber: number): Date =>
  new Date(Date.UTC(year, monthNumber, 0, 23, 59, 59, 999));

export const addMonths = (year: number, monthNumber: number, delta: number) => {
  const zeroBased = monthNumber - 1 + delta;
  return {
    year: year + Math.floor(zeroBased / 12),
    monthNumber: (((zeroBased % 12) + 12) % 12) + 1,
  };
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
    const to = input.to
      ? parseMonthKey(input.to)
      : { year: now.getUTCFullYear(), monthNumber: now.getUTCMonth() + 1 };
    const from = input.from ? parseMonthKey(input.from) : to;
    fromY = from.year;
    fromM = from.monthNumber;
    toY = to.year;
    toM = to.monthNumber;
  } else {
    const count = Math.max(1, input.months ?? 12);
    toY = now.getUTCFullYear();
    toM = now.getUTCMonth() + 1;
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
    start: startOfMonthUtc(fromY, fromM),
    end: endOfMonthUtc(toY, toM),
    months,
  };
};
