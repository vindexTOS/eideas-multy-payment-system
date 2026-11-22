require('reflect-metadata');
const assert = require('node:assert');
const { describe, it } = require('node:test');
const {
  BUSINESS_TIME_ZONE,
  buildMonthRange,
  endOfMonth,
  startOfMonth,
  toMonthKey,
} = require('../dist/shared/utils/month-range.util');

// Tbilisi is UTC+4 all year: its midnight is 20:00 UTC the day before.
describe('month windows are inclusive Tbilisi calendar months', () => {
  it('uses the Tbilisi zone', () => {
    assert.strictEqual(BUSINESS_TIME_ZONE, 'Asia/Tbilisi');
  });

  it('builds a gap-free list with inclusive bounds', () => {
    const r = buildMonthRange({ from: '2026-01', to: '2026-03' });
    assert.deepStrictEqual(
      r.months.map((m) => m.month),
      ['2026-01', '2026-02', '2026-03'],
    );
    assert.strictEqual(r.start.toISOString(), '2025-12-31T20:00:00.000Z');
    assert.strictEqual(r.end.toISOString(), '2026-03-31T19:59:59.999Z');
  });

  it('ends february on the 28th in a common year', () => {
    assert.strictEqual(
      buildMonthRange({ from: '2026-02', to: '2026-02' }).end.toISOString(),
      '2026-02-28T19:59:59.999Z',
    );
  });

  it('ends february on the 29th in a leap year', () => {
    assert.strictEqual(
      buildMonthRange({ from: '2028-02', to: '2028-02' }).end.toISOString(),
      '2028-02-29T19:59:59.999Z',
    );
  });

  it('ends december and starts january across the year boundary', () => {
    assert.strictEqual(endOfMonth(2026, 12).toISOString(), '2026-12-31T19:59:59.999Z');
    assert.strictEqual(startOfMonth(2027, 1).toISOString(), '2026-12-31T20:00:00.000Z');
  });

  it('crosses the year boundary for "last N months"', () => {
    const r = buildMonthRange({ months: 3, now: new Date('2026-02-10T00:00:00Z') });
    assert.deepStrictEqual(
      r.months.map((m) => m.month),
      ['2025-12', '2026-01', '2026-02'],
    );
  });

  it('is already in the new month in Tbilisi while UTC is still in the old one', () => {
    // 31 Oct 21:00 UTC = 1 Nov 01:00 in Tbilisi
    const r = buildMonthRange({ months: 1, now: new Date('2026-10-31T21:00:00Z') });
    assert.deepStrictEqual(
      r.months.map((m) => m.month),
      ['2026-11'],
    );
    assert.strictEqual(r.start.toISOString(), '2026-10-31T20:00:00.000Z');
  });

  it('is still in the old month in Tbilisi up to its midnight', () => {
    // 31 Oct 19:59 UTC = 31 Oct 23:59 in Tbilisi
    const r = buildMonthRange({ months: 1, now: new Date('2026-10-31T19:59:00Z') });
    assert.deepStrictEqual(
      r.months.map((m) => m.month),
      ['2026-10'],
    );
  });

  it('swaps a reversed range instead of returning nothing', () => {
    assert.strictEqual(buildMonthRange({ from: '2026-05', to: '2026-03' }).months.length, 3);
  });

  it('formats a month key the way the SQL bucket does (Tbilisi calendar)', () => {
    assert.strictEqual(toMonthKey(new Date('2026-03-01T00:00:00Z')), '2026-03');
    // 28 Feb 21:00 UTC is already 1 March in Tbilisi
    assert.strictEqual(toMonthKey(new Date('2026-02-28T21:00:00Z')), '2026-03');
    // the last millisecond of February in Tbilisi
    assert.strictEqual(toMonthKey(new Date('2026-02-28T19:59:59.999Z')), '2026-02');
  });

  it('does not depend on the zone the server runs in', () => {
    const { execFileSync } = require('node:child_process');
    const script = `
      const { buildMonthRange } = require(${JSON.stringify(require.resolve('../dist/shared/utils/month-range.util'))});
      const r = buildMonthRange({ months: 1, now: new Date('2026-10-31T21:00:00Z') });
      process.stdout.write(r.months[0].month + ' ' + r.start.toISOString() + ' ' + r.end.toISOString());
    `;
    const results = ['UTC', 'Asia/Tbilisi', 'America/New_York', 'Asia/Tokyo'].map((tz) =>
      execFileSync(process.execPath, ['-e', script], { env: { ...process.env, TZ: tz } }).toString(),
    );
    for (const result of results) {
      assert.strictEqual(result, '2026-11 2026-10-31T20:00:00.000Z 2026-11-30T19:59:59.999Z');
    }
  });
});
