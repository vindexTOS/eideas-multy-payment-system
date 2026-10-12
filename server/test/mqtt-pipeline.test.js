require('reflect-metadata');
const assert = require('node:assert');
const { describe, it } = require('node:test');
const { FrameCodec } = require('../dist/modules/mqtt/frame.codec');
const {
  parseTopic,
  commandTopic,
  inboundTopicFilter,
} = require('../dist/modules/mqtt/mqtt-topic.util');
const { PaymentFrameParser } = require('../dist/modules/mqtt/payment-frame.parser');

const codec = new FrameCodec();

/** `command=4`, 4-byte LE amount in minor units - the assumed layout. */
const binaryFrame = (amountMinor) => {
  const buf = Buffer.alloc(10);
  buf.writeUInt32BE(1760000000, 0);
  buf.writeUInt8(4, 4);
  buf.writeUInt8(4, 5);
  buf.writeUInt32LE(amountMinor, 6);
  return buf;
};

const config = (overrides = {}) => ({
  getOrThrow: () => ({
    paymentCommand: 4,
    amountDivisor: 100,
    binaryPaymentsEnabled: false,
    ...overrides,
  }),
});

describe('topic layout', () => {
  it('parses {root}/{uid}/events/{event}', () => {
    const topic = parseTopic('Pay/TERM-0001/events/payment');
    assert.strictEqual(topic.deviceUid, 'TERM-0001');
    assert.strictEqual(topic.event, 'payment');
    assert.strictEqual(topic.direction, 'events');
  });

  it('collapses nested event paths into one event name', () => {
    assert.strictEqual(parseTopic('Pay/T1/events/payment/success').event, 'payment/success');
  });

  it('derives the subscription filter and command topic from the root', () => {
    assert.strictEqual(inboundTopicFilter('Pay'), 'Pay/+/events/#');
    assert.strictEqual(commandTopic('Pay', 'T1', 'general'), 'Pay/T1/commands/general');
  });
});

describe('frame codec', () => {
  it('decodes a JSON payload as JSON', () => {
    const frame = codec.decode(Buffer.from(JSON.stringify({ amount: 12.5, ref: 'A-1' })));
    assert.strictEqual(frame.json.amount, 12.5);
    assert.strictEqual(frame.framed, false);
  });

  it('decodes the binary header and payload', () => {
    const frame = codec.decode(binaryFrame(1250));
    assert.strictEqual(frame.command, 4);
    assert.strictEqual(frame.length, 4);
    assert.strictEqual(frame.payload.readUInt32LE(0), 1250);
    assert.strictEqual(frame.framed, true);
  });

  it('keeps an unparseable buffer rather than dropping it', () => {
    const frame = codec.decode(Buffer.from([1, 2]));
    assert.strictEqual(frame.framed, false);
    assert.strictEqual(frame.hex, '0102');
  });

  it('encodes a command frame with a 6-byte header', () => {
    const out = codec.encode(1, [{ type: 'number16', value: 500 }]);
    assert.strictEqual(out.length, 8);
    assert.strictEqual(out.readUInt8(4), 1);
    assert.strictEqual(out.readUInt8(5), 2);
    assert.strictEqual(out.readUInt16LE(6), 500);
  });
});

describe('payment frame parsing', () => {
  it('extracts the amount and reference from JSON', () => {
    const parser = new PaymentFrameParser(config());
    const result = parser.parse(
      codec.decode(Buffer.from(JSON.stringify({ amount: 12.5, ref: 'A-1001' }))),
      new Date(),
    );
    assert.strictEqual(result.amount, 12.5);
    assert.strictEqual(result.externalRef, 'A-1001');
  });

  it('converts minor units with the configured divisor', () => {
    const parser = new PaymentFrameParser(config());
    const result = parser.parse(
      codec.decode(Buffer.from(JSON.stringify({ amount_minor: 1250 }))),
      new Date(),
    );
    assert.strictEqual(result.amount, 12.5);
  });

  it('refuses to book an undocumented binary frame by default', () => {
    const parser = new PaymentFrameParser(config());
    assert.strictEqual(parser.parse(codec.decode(binaryFrame(1250)), new Date()), null);
  });

  it('books a binary frame once the layout is confirmed', () => {
    const parser = new PaymentFrameParser(config({ binaryPaymentsEnabled: true }));
    const result = parser.parse(codec.decode(binaryFrame(1250)), new Date());
    assert.strictEqual(result.amount, 12.5);
  });

  it('rejects zero and negative amounts', () => {
    const parser = new PaymentFrameParser(config());
    for (const amount of [0, -5]) {
      assert.strictEqual(
        parser.parse(codec.decode(Buffer.from(JSON.stringify({ amount }))), new Date()),
        null,
      );
    }
  });
});
