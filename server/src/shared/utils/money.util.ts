/**
 * All money columns are `numeric(14,2)`, which the pg driver hands back as a
 * string. Everything money-ish funnels through here so we never let a float
 * artifact (0.1 + 0.2) reach the database or a chart.
 */
export const toAmount = (value: string | number | null | undefined): number => {
  if (value === null || value === undefined) return 0;
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Half-up rounding to 2 decimals, immune to binary representation noise. */
export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

export const sumAmounts = (values: Array<string | number | null | undefined>): number =>
  round2(values.reduce<number>((acc, v) => acc + toAmount(v), 0));

/** Format for storage in a numeric column. */
export const toNumericString = (value: number): string => round2(value).toFixed(2);
