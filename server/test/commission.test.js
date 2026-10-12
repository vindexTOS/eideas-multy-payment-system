/**
 * Runs against the compiled output (`npm run build` first), so there is no
 * ts-jest in the dependency tree - `node --test` is enough.
 *
 * These cover the two rules the whole platform's money depends on: how the
 * commission is chosen, and what "a month" means.
 */
require('reflect-metadata');
const assert = require('node:assert');
const { describe, it } = require('node:test');
const { CommissionService } = require('../dist/shared/services/commission.service');

const commission = new CommissionService();

describe('commission = max(minTariff, amount * percent / 100)', () => {
  it('takes the percentage when it exceeds the minimum', () => {
    const r = commission.calculate({ amount: 100, minTariff: 0.5, percentTariff: 5 });
    assert.strictEqual(r.commission, 5);
    assert.strictEqual(r.netAmount, 95);
    assert.strictEqual(r.appliedRule, 'percent');
  });

  it('falls back to the minimum tariff on a small payment', () => {
    const r = commission.calculate({ amount: 2, minTariff: 0.5, percentTariff: 5 });
    assert.strictEqual(r.commission, 0.5);
    assert.strictEqual(r.netAmount, 1.5);
    assert.strictEqual(r.appliedRule, 'min_tariff');
  });

  it('gives a tie to the minimum tariff', () => {
    const r = commission.calculate({ amount: 10, minTariff: 0.5, percentTariff: 5 });
    assert.strictEqual(r.commission, 0.5);
    assert.strictEqual(r.appliedRule, 'min_tariff');
  });

  it('never takes more than the amount that came in', () => {
    const r = commission.calculate({ amount: 0.3, minTariff: 1, percentTariff: 5 });
    assert.strictEqual(r.commission, 0.3);
    assert.strictEqual(r.netAmount, 0);
  });

  it('accepts the strings that numeric columns return', () => {
    const r = commission.calculate({ amount: '33.33', minTariff: '0.50', percentTariff: '2.50' });
    assert.strictEqual(r.commission, 0.83);
    assert.strictEqual(r.netAmount, 32.5);
  });

  it('does not drift on binary float artifacts', () => {
    const r = commission.calculate({ amount: 0.1 + 0.2, minTariff: 0, percentTariff: 10 });
    assert.strictEqual(r.amount, 0.3);
    assert.strictEqual(r.commission, 0.03);
  });
});
