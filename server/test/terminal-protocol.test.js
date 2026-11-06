require('reflect-metadata');
const assert = require('node:assert');
const { describe, it } = require('node:test');
const { FrameCodec } = require('../dist/modules/mqtt/frame.codec');
const { PaymentFrameParser } = require('../dist/modules/mqtt/payment-frame.parser');
const { MqttRouterService } = require('../dist/modules/mqtt/mqtt-router.service');
const {
  VID,
  TERMINAL_CONFIG_DEFAULTS,
  effectiveConfig,
} = require('../dist/modules/mqtt/protocol/terminal-protocol');

const codec = new FrameCodec();
const parser = new PaymentFrameParser({ getOrThrow: () => ({ amountDivisor: 100 }) });

/** 2025-10-09, a believable device clock. */
const CLOCK = 1760000000;

const u8 = (n) => Buffer.from([n]);
const u16 = (n) => {
  const buf = Buffer.alloc(2);
  buf.writeUInt16LE(n, 0);
  return buf;
};

/** A terminal->server frame: timestamp (BE, as the lift terminals send it), then records. */
const terminalFrame = (records, clock = CLOCK, writeClock = 'writeUInt32BE') => {
  const head = Buffer.alloc(4);
  head[writeClock](clock, 0);
  return Buffer.concat([
    head,
    ...records.map(([vid, bytes]) => Buffer.concat([Buffer.from([vid, bytes.length]), bytes])),
  ]);
};

const paymentFrame = (amountTetri, result = 0x01, clock = CLOCK) =>
  terminalFrame(
    [
      [VID.TRANSACTION_AMOUNT, u16(amountTetri)],
      [VID.PAYMENT, u8(result)],
    ],
    clock,
  );

describe('terminal frame decoding', () => {
  it('reads a one-record frame both as the lift header and as a record', () => {
    const frame = codec.decode(terminalFrame([[VID.PAYMENT_STATUS, u8(1)]]));
    assert.strictEqual(frame.command, VID.PAYMENT_STATUS);
    assert.strictEqual(frame.length, 1);
    assert.strictEqual(frame.timestamp, CLOCK);
    assert.deepStrictEqual(
      frame.records.map((r) => [r.key, r.value]),
      [['paymentStatus', 1]],
    );
  });

  it('decodes several records in one frame, uint16 little-endian', () => {
    const frame = codec.decode(paymentFrame(500));
    assert.deepStrictEqual(
      frame.records.map((r) => [r.vid, r.key, r.value]),
      [
        [0x80, 'transactionAmount', 500],
        [0x81, 'payment', 1],
      ],
    );
    assert.strictEqual(frame.protocolError, null);
  });

  it('keeps an unknown VID raw instead of refusing the frame', () => {
    const frame = codec.decode(
      terminalFrame([
        [0xc7, Buffer.from([1, 2, 3])],
        [VID.PAYMENT, u8(1)],
      ]),
    );
    assert.strictEqual(frame.records[0].key, null);
    assert.strictEqual(frame.records[0].hex, '010203');
    assert.strictEqual(frame.records[1].value, 1);
  });

  it('refuses a known VID with the wrong width, and says why', () => {
    const frame = codec.decode(terminalFrame([[VID.TRANSACTION_AMOUNT, Buffer.alloc(4)]]));
    assert.strictEqual(frame.records, null);
    assert.match(frame.protocolError, /transactionAmount \(0x80\) must carry 2 bytes, got 4/);
  });

  it('refuses a record that runs past the end of the frame', () => {
    const buf = Buffer.concat([Buffer.alloc(4), Buffer.from([VID.TRANSACTION_AMOUNT, 2, 0xf4])]);
    const frame = codec.decode(buf);
    assert.strictEqual(frame.records, null);
    assert.match(frame.protocolError, /declares 2 bytes, only 1 left/);
  });

  it('does not take a frame with no known VID for a terminal frame', () => {
    const frame = codec.decode(terminalFrame([[0xc7, u8(5)]]));
    assert.strictEqual(frame.records, null);
    assert.strictEqual(frame.protocolError, null);
  });

  it('never reads JSON as records', () => {
    const frame = codec.decode(Buffer.from(JSON.stringify({ amount: 5 })));
    assert.strictEqual(frame.records, null);
  });
});

describe('terminal frame encoding', () => {
  it('round-trips a full config frame', () => {
    const records = Object.entries(TERMINAL_CONFIG_DEFAULTS).map(([, value], i) => ({
      vid: i + 1,
      value,
    }));
    const decoded = codec.decode(codec.encodeRecords(records));
    assert.deepStrictEqual(
      Object.fromEntries(decoded.records.map((r) => [r.key, r.value])),
      { ...TERMINAL_CONFIG_DEFAULTS },
    );
    assert.strictEqual(decoded.records[0].value, 0x3d5);
  });

  it('encodes set-amount as a uint16 record and reconcile as a zero-length one', () => {
    const amount = codec.encodeRecords([{ vid: VID.SET_AMOUNT, value: 500 }]);
    assert.deepStrictEqual(amount.subarray(4), Buffer.from([0x50, 0x02, 0xf4, 0x01]));

    const reconcile = codec.encodeRecords([{ vid: VID.RECONCILE }]);
    assert.deepStrictEqual(reconcile.subarray(4), Buffer.from([0x51, 0x00]));
  });

  it('refuses values outside the spec range', () => {
    assert.throws(
      () => codec.encodeRecords([{ vid: VID.SCALE_FACTOR, value: 5 }]),
      /scaleFactor \(0x02\) must be 10-10000, got 5/,
    );
    assert.throws(() => codec.encodeRecords([{ vid: VID.SET_AMOUNT, value: 10001 }]), /1-10000/);
    assert.throws(() => codec.encodeRecords([{ vid: VID.OPERATION_MODE }]), /needs an integer/);
  });

  it('refuses to send events and unknown VIDs', () => {
    assert.throws(() => codec.encodeRecords([{ vid: VID.PAYMENT, value: 1 }]), /is an event/);
    assert.throws(() => codec.encodeRecords([{ vid: 0xc7, value: 1 }]), /Unknown VID 0xC7/);
    // ...unless the simulator is building a terminal->server frame.
    const sim = codec.encodeRecords([{ vid: VID.PAYMENT, value: 1 }], { allowEvents: true });
    assert.strictEqual(codec.decode(sim).records[0].value, 1);
  });
});

describe('terminal config', () => {
  it('fills holes with spec defaults and drops keys the catalogue lacks', () => {
    const config = effectiveConfig({ scaleFactor: 200, retired: 1 });
    assert.strictEqual(config.scaleFactor, 200);
    assert.strictEqual(config.rs485ScanCount, 4);
    assert.strictEqual(config.operationMode, 1);
    assert.strictEqual('retired' in config, false);
  });
});

describe('terminal payment parsing', () => {
  const receivedAt = new Date();

  it('books a successful payment in lari, at the device clock', () => {
    const outcome = parser.parseTerminal(codec.decode(paymentFrame(1250)), receivedAt);
    assert.strictEqual(outcome.kind, 'book');
    assert.strictEqual(outcome.payment.amount, 12.5);
    assert.strictEqual(outcome.payment.paidAt.getTime(), CLOCK * 1000);
    assert.match(outcome.payment.externalRef, new RegExp(`^${CLOCK}-[0-9a-f]{12}$`));
  });

  it('gives a redelivered frame the same idempotency key, and the next payment a new one', () => {
    const first = parser.parseTerminal(codec.decode(paymentFrame(500)), receivedAt);
    const again = parser.parseTerminal(codec.decode(paymentFrame(500)), receivedAt);
    const next = parser.parseTerminal(codec.decode(paymentFrame(500, 1, CLOCK + 40)), receivedAt);
    assert.strictEqual(first.payment.externalRef, again.payment.externalRef);
    assert.notStrictEqual(first.payment.externalRef, next.payment.externalRef);
  });

  it('recognises a little-endian device clock', () => {
    const frame = terminalFrame(
      [
        [VID.TRANSACTION_AMOUNT, u16(500)],
        [VID.PAYMENT, u8(1)],
      ],
      CLOCK,
      'writeUInt32LE',
    );
    const outcome = parser.parseTerminal(codec.decode(frame), receivedAt);
    assert.strictEqual(outcome.payment.paidAt.getTime(), CLOCK * 1000);
  });

  it('with no believable clock, books at arrival time and with no idempotency key', () => {
    // A clock counting from boot would repeat after a reboot and drop a real
    // payment as a "duplicate". Better a reversible double count.
    const outcome = parser.parseTerminal(codec.decode(paymentFrame(500, 1, 3600)), receivedAt);
    assert.strictEqual(outcome.payment.externalRef, null);
    assert.strictEqual(outcome.payment.paidAt, receivedAt);
  });

  it('books a partly successful payment, flagged partial', () => {
    const outcome = parser.parseTerminal(codec.decode(paymentFrame(500, 0x02)), receivedAt);
    assert.strictEqual(outcome.kind, 'book');
    assert.strictEqual(outcome.payment.details.partial, true);
  });

  it('does not book a rejected, aborted or offline payment', () => {
    for (const result of [0x00, 0x10, 0x22, 0x35]) {
      const outcome = parser.parseTerminal(codec.decode(paymentFrame(500, result)), receivedAt);
      assert.deepStrictEqual(outcome, { kind: 'declined', result, amountTetri: 500 });
    }
  });

  it('refuses a success with no amount in the frame', () => {
    const frame = terminalFrame([[VID.PAYMENT, u8(1)]]);
    const outcome = parser.parseTerminal(codec.decode(frame), receivedAt);
    assert.strictEqual(outcome.kind, 'invalid');
    assert.match(outcome.reason, /without a 0x80 amount/);
  });

  it('refuses an out-of-range amount - which is what a byte-order mismatch looks like', () => {
    // 500 tetri written big-endian reads as 62465 little-endian.
    const frame = terminalFrame([
      [VID.TRANSACTION_AMOUNT, Buffer.from([0x01, 0xf4])],
      [VID.PAYMENT, u8(1)],
    ]);
    const outcome = parser.parseTerminal(codec.decode(frame), receivedAt);
    assert.strictEqual(outcome.kind, 'invalid');
    assert.match(outcome.reason, /62465/);
  });
});

describe('routing by VID', () => {
  const makeRouter = (handlers) => {
    const logged = [];
    const router = new MqttRouterService(
      { getOrThrow: () => ({ logRawMessages: false }) },
      codec,
      { log: async (message, outcome) => logged.push(outcome) },
      { touch: async () => undefined },
      { findByUid: async () => ({ id: 'device-1' }) },
      handlers,
    );
    return { router, logged };
  };

  const handler = (name, { event = name, vids, fails = false } = {}) => {
    const seen = [];
    return {
      name,
      event,
      vids,
      seen,
      handle: async (message) => {
        seen.push(message.frame.records?.map((r) => r.vid) ?? message.topic.event);
        if (fails) throw new Error(`${name} broke`);
      },
    };
  };

  it('runs every handler a frame claims, once each, whatever the topic says', async () => {
    const payment = handler('payment', { vids: [VID.PAYMENT] });
    const status = handler('status', { vids: [VID.PAYMENT_STATUS] });
    const { router } = makeRouter([payment, status, handler('fallback', { event: '*' })]);

    const frame = terminalFrame([
      [VID.PAYMENT_STATUS, u8(0)],
      [VID.TRANSACTION_AMOUNT, u16(500)],
      [VID.PAYMENT, u8(1)],
    ]);
    await router.dispatch('Pay/T1/events/general', frame);

    assert.deepStrictEqual(payment.seen, [[0x82, 0x80, 0x81]]);
    assert.strictEqual(status.seen.length, 1);
  });

  it('does not let one failing handler cost the others their turn', async () => {
    const status = handler('status', { vids: [VID.PAYMENT_STATUS], fails: true });
    const payment = handler('payment', { vids: [VID.PAYMENT] });
    const { router, logged } = makeRouter([status, payment]);

    await router.dispatch(
      'Pay/T1/events/general',
      terminalFrame([
        [VID.PAYMENT_STATUS, u8(9)],
        [VID.TRANSACTION_AMOUNT, u16(500)],
        [VID.PAYMENT, u8(1)],
      ]),
    );

    assert.strictEqual(payment.seen.length, 1);
    assert.strictEqual(router.getStats().failed, 1);
    assert.match(logged[0].error, /status: status broke/);
  });

  it('sends a frame no handler claims to the fallback', async () => {
    const fallback = handler('fallback', { event: '*' });
    const { router } = makeRouter([handler('payment', { vids: [VID.PAYMENT] }), fallback]);
    await router.dispatch('Pay/T1/events/general', terminalFrame([[VID.TRANSACTION_AMOUNT, u16(1)]]));
    assert.strictEqual(fallback.seen.length, 1);
  });

  it('still routes JSON by topic event', async () => {
    const payment = handler('payment', { vids: [VID.PAYMENT] });
    const { router } = makeRouter([payment]);
    await router.dispatch('Pay/T1/events/payment', Buffer.from(JSON.stringify({ amount: 1 })));
    assert.deepStrictEqual(payment.seen, ['payment']);
  });

  it('keeps a malformed terminal frame in the log even with raw logging off', async () => {
    const { router, logged } = makeRouter([handler('fallback', { event: '*' })]);
    await router.dispatch(
      'Pay/T1/events/general',
      terminalFrame([[VID.TRANSACTION_AMOUNT, Buffer.alloc(4)]]),
    );
    assert.match(logged[0].error, /must carry 2 bytes/);
  });
});

describe('audit log', () => {
  it('stores binary frames whose payload holds NUL bytes, which jsonb refuses', async () => {
    const { DeviceMessageService } = require('../dist/modules/mqtt/device-message.service');
    const saved = [];
    const service = new DeviceMessageService({ create: (row) => row, save: async (row) => saved.push(row) });
    const frame = codec.decode(terminalFrame([[VID.PAYMENT_STATUS, u8(0)]]));

    await service.log({ topic: { raw: 'Pay/T1/events/general', deviceUid: 'T1', event: 'general' }, frame, receivedAt: new Date() });

    assert.strictEqual(JSON.stringify(saved[0].decoded).includes('\\u0000'), false);
    assert.strictEqual(saved[0].decoded.records[0].meaning, 'Idle');
    assert.strictEqual(saved[0].payloadHex.endsWith('820100'), true);
  });
});

describe('terminal config updates', () => {
  it('changes only the keys sent, even through a real DTO instance', async () => {
    const { plainToInstance } = require('class-transformer');
    const { UpdateTerminalConfigDto } = require('../dist/modules/mqtt/dto/terminal.dto');
    const { TerminalCommandsService } = require('../dist/modules/mqtt/terminal-commands.service');
    const saved = [];
    const published = [];
    const service = new TerminalCommandsService(
      { publishRecords: async (uid, records) => (published.push(records), { topic: 't', hex: 'h' }) },
      { saveConfig: async (id, config) => saved.push(config), markConfigSent: async () => undefined },
    );
    const device = { id: 'd1', deviceUid: 'T1', config: { scaleFactor: 200, operationMode: 2 }, configSentAt: null };

    const dto = plainToInstance(UpdateTerminalConfigDto, { lcdBrightness: 40 });
    const result = await service.updateConfig(device, dto);

    assert.deepStrictEqual(
      [saved[0].scaleFactor, saved[0].operationMode, saved[0].lcdBrightness, saved[0].rs485ScanCount],
      [200, 2, 40, 4],
    );
    assert.strictEqual(result.delivered, true);
    // The whole config goes out, not just the changed key.
    assert.strictEqual(published[0].length, 8);
  });
});
