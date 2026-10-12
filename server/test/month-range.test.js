require('reflect-metadata');
const assert = require('node:assert');
const { describe, it } = require('node:test');
const { buildMonthRange, toMonthKey } = require('../dist/shared/utils/month-range.util');

describe('month windows are inclusive calendar months', () => {
  it('builds a gap-free list with inclusive bounds', () => {
    const r = buildMonthRange({ from: '2026-01', to: '2026-03' });
    assert.deepStrictEqual(
      r.months.map((m) => m.month),
      ['2026-01', '2026-02', '2026-03'],
    );
    assert.strictEqual(r.start.toISOString(), '2026-01-01T00:00:00.000Z');
    assert.strictEqual(r.end.toISOString(), '2026-03-31T23:59:59.999Z');
  });

  it('ends february on the 28th in a common year', () => {
    assert.strictEqual(
      buildMonthRange({ from: '2026-02', to: '2026-02' }).end.toISOString(),
      '2026-02-28T23:59:59.999Z',
    );
  });

  it('ends february on the 29th in a leap year', () => {
    assert.strictEqual(
      buildMonthRange({ from: '2028-02', to: '2028-02' }).end.toISOString(),
      '2028-02-29T23:59:59.999Z',
    );
  });

  it('crosses the year boundary for "last N months"', () => {
    const r = buildMonthRange({ months: 3, now: new Date('2026-02-10T00:00:00Z') });
    assert.deepStrictEqual(
      r.months.map((m) => m.month),
      ['2025-12', '2026-01', '2026-02'],
    );
  });

  it('swaps a reversed range instead of returning nothing', () => {
    assert.strictEqual(buildMonthRange({ from: '2026-05', to: '2026-03' }).months.length, 3);
  });

  it('formats a month key the way the SQL bucket does', () => {
    assert.strictEqual(toMonthKey(new Date('2026-03-01T00:00:00Z')), '2026-03');
  });
});
