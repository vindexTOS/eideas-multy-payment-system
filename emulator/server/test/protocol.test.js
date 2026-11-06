const assert = require('node:assert');
const { describe, it } = require('node:test');
const {
  VID,
  CONFIG_DEFAULTS,
  decodeFrame,
  encodeTerminalFrame,
  summarise,
} = require('../dist/protocol/terminal-protocol');

/** A server -> terminal frame: clock little-endian, as the platform writes it. */
const serverFrame = (records) => {
  const clock = Buffer.alloc(4);
  clock.writeUInt32LE(1760000000, 0);
  return Buffer.concat([clock, ...records.map((r) => Buffer.from(r))]);
};

describe('terminal -> server frames', () => {
  it('writes the clock big-endian and amounts little-endian', () => {
    const frame = encodeTerminalFrame(
      [
        { vid: VID.TRANSACTION_AMOUNT, value: 1250 },
        { vid: VID.PAYMENT, value: 0x01 },
      ],
      1760000000,
    );
    assert.strictEqual(frame.readUInt32BE(0), 1760000000);
    assert.deepStrictEqual(frame.subarray(4), Buffer.from([0x80, 0x02, 0xe2, 0x04, 0x81, 0x01, 0x01]));
  });

  it('refuses what a terminal never sends, and out-of-spec values', () => {
    assert.throws(() => encodeTerminalFrame([{ vid: VID.SET_AMOUNT, value: 5 }]), /a terminal does not send it/);
    assert.throws(() => encodeTerminalFrame([{ vid: VID.TRANSACTION_AMOUNT, value: 10001 }]), /1-10000/);
    assert.throws(() => encodeTerminalFrame([{ vid: VID.PAYMENT_STATUS, value: 2 }]), /0-1/);
    assert.throws(() => encodeTerminalFrame([{ vid: 0xc7, value: 1 }]), /Unknown VID 0xC7/);
  });
});

describe('server -> terminal frames', () => {
  it('reads a full config push', () => {
    const frame = serverFrame([
      [0x01, 2, 0xd5, 0x03],
      [0x02, 2, 0xc8, 0x00],
      [0x08, 1, 0x02],
    ]);
    const { clock, records, error } = decodeFrame(frame, 'le');
    assert.strictEqual(error, null);
    assert.strictEqual(clock, 1760000000);
    assert.deepStrictEqual(
      records.map((r) => [r.key, r.value, r.kind]),
      [
        ['countryCode', 981, 'config'],
        ['scaleFactor', 200, 'config'],
        ['operationMode', 2, 'config'],
      ],
    );
    assert.strictEqual(records[2].meaning, 'QR + Normal');
  });

  it('reads set-amount and the zero-length reconcile', () => {
    const { records } = decodeFrame(serverFrame([[0x50, 2, 0xf4, 0x01], [0x51, 0]]), 'le');
    assert.strictEqual(records[0].value, 500);
    assert.strictEqual(records[1].key, 'reconcile');
    assert.strictEqual(records[1].value, null);
  });

  it('flags an out-of-spec value instead of applying it', () => {
    const { records } = decodeFrame(serverFrame([[0x02, 2, 0x05, 0x00]]), 'le');
    assert.match(records[0].problem, /scaleFactor \(0x02\) must be 10-10000, got 5/);
  });

  it('reports a malformed frame rather than throwing', () => {
    assert.match(decodeFrame(serverFrame([[0x50, 4, 1, 2, 3, 4]]), 'le').error, /must carry 2 bytes, got 4/);
    assert.match(decodeFrame(Buffer.from([1, 2]), 'le').error, /a record needs at least 6/);
    assert.match(decodeFrame(serverFrame([[0x50, 2, 1]]), 'le').error, /declares 2 bytes, only 1 left/);
  });

  it('summarises records for the log', () => {
    const { records } = decodeFrame(
      encodeTerminalFrame([
        { vid: VID.TRANSACTION_AMOUNT, value: 500 },
        { vid: VID.PAYMENT, value: 0x10 },
      ]),
      'be',
    );
    assert.strictEqual(summarise(records), 'transactionAmount=500, payment=Reject');
  });

  it('has the spec defaults', () => {
    assert.deepStrictEqual(
      { ...CONFIG_DEFAULTS },
      {
        countryCode: 981,
        scaleFactor: 100,
        pulseFrequency: 5,
        pulseDutyCycle: 50,
        lcdBrightness: 100,
        advBoardBrightness: 100,
        rs485ScanCount: 4,
        operationMode: 1,
      },
    );
  });
});
