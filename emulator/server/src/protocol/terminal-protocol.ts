/**
 * The payment-terminal VID protocol, from the TERMINAL's side.
 *
 * Deliberately its own copy, written from the spec rather than imported from
 * the platform server: the emulator is meant to behave like firmware built
 * from the same document, so it shares no code with the thing it tests.
 *
 *     [timestamp 4B] [VID 1B][len 1B][value] [VID 1B][len 1B][value] ...
 *
 * Terminal -> server frames carry the clock big-endian (as the lift terminals
 * do); server -> terminal frames carry it little-endian. Multi-byte values are
 * little-endian both ways.
 */

export type VidType = 'uint8' | 'uint16' | 'none';
export type VidKind = 'config' | 'command' | 'event';

export const VID = {
  COUNTRY_CODE: 0x01,
  SCALE_FACTOR: 0x02,
  PULSE_FREQUENCY: 0x03,
  PULSE_DUTY_CYCLE: 0x04,
  LCD_BRIGHTNESS: 0x05,
  ADV_BOARD_BRIGHTNESS: 0x06,
  RS485_SCAN_COUNT: 0x07,
  OPERATION_MODE: 0x08,
  SET_AMOUNT: 0x50,
  RECONCILE: 0x51,
  TRANSACTION_AMOUNT: 0x80,
  PAYMENT: 0x81,
  PAYMENT_STATUS: 0x82,
  CANCEL: 0x84,
  WAIT: 0x95,
  CANCEL_9A: 0x9a,
  RETURN: 0x9d,
  VOID: 0xb5,
  RECONCILIATION: 0xbb,
} as const;

export interface VidDefinition {
  vid: number;
  key: string;
  kind: VidKind;
  type: VidType;
  label: string;
  min?: number;
  max?: number;
  default?: number;
}

const config = (
  vid: number,
  key: string,
  type: VidType,
  label: string,
  min: number,
  max: number,
  fallback: number,
): VidDefinition => ({ vid, key, kind: 'config', type, label, min, max, default: fallback });

const operation = (vid: number, key: string, label: string): VidDefinition => ({
  vid,
  key,
  kind: 'event',
  type: 'uint8',
  label,
});

export const VID_DEFINITIONS: readonly VidDefinition[] = [
  config(VID.COUNTRY_CODE, 'countryCode', 'uint16', 'Country Code', 0, 0xffff, 0x3d5),
  config(VID.SCALE_FACTOR, 'scaleFactor', 'uint16', 'Scale Factor (tetri)', 10, 10000, 100),
  config(VID.PULSE_FREQUENCY, 'pulseFrequency', 'uint8', 'Pulse Frequency (Hz, 0 = 0.5)', 0, 50, 5),
  config(VID.PULSE_DUTY_CYCLE, 'pulseDutyCycle', 'uint8', 'Pulse Duty Cycle (%)', 10, 80, 50),
  config(VID.LCD_BRIGHTNESS, 'lcdBrightness', 'uint8', 'LCD Brightness (%)', 1, 100, 100),
  config(
    VID.ADV_BOARD_BRIGHTNESS,
    'advBoardBrightness',
    'uint8',
    'Adv. Board Brightness (%)',
    1,
    100,
    100,
  ),
  config(VID.RS485_SCAN_COUNT, 'rs485ScanCount', 'uint8', 'RS485 Slave Node Scan Count', 1, 16, 4),
  config(VID.OPERATION_MODE, 'operationMode', 'uint8', 'Operation Mode', 1, 7, 1),
  {
    vid: VID.SET_AMOUNT,
    key: 'setAmount',
    kind: 'command',
    type: 'uint16',
    label: 'Set amount (tetri)',
    min: 1,
    max: 10000,
  },
  {
    vid: VID.RECONCILE,
    key: 'reconcile',
    kind: 'command',
    type: 'none',
    label: 'Terminal Reconciliation',
  },
  {
    vid: VID.TRANSACTION_AMOUNT,
    key: 'transactionAmount',
    kind: 'event',
    type: 'uint16',
    label: 'Transaction Amount (tetri)',
    min: 1,
    max: 10000,
  },
  operation(VID.PAYMENT, 'payment', 'Payment'),
  {
    vid: VID.PAYMENT_STATUS,
    key: 'paymentStatus',
    kind: 'event',
    type: 'uint8',
    label: 'Payment Status',
    min: 0,
    max: 1,
  },
  operation(VID.CANCEL, 'cancel', 'Cancel Transaction'),
  operation(VID.WAIT, 'wait', 'Wait'),
  operation(VID.CANCEL_9A, 'cancel9a', 'Cancel Transaction (0x9A)'),
  operation(VID.RETURN, 'return', 'Return'),
  operation(VID.VOID, 'void', 'Void Transaction'),
  operation(VID.RECONCILIATION, 'reconciliation', 'Reconciliation'),
];

export const CATALOGUE: ReadonlyMap<number, VidDefinition> = new Map(
  VID_DEFINITIONS.map((d) => [d.vid, d]),
);

export const CONFIG_DEFINITIONS = VID_DEFINITIONS.filter((d) => d.kind === 'config');

/** Events whose value is an operation result (everything but amount and status). */
export const OPERATION_VIDS: readonly number[] = [
  VID.PAYMENT,
  VID.CANCEL,
  VID.WAIT,
  VID.CANCEL_9A,
  VID.RETURN,
  VID.VOID,
  VID.RECONCILIATION,
];

export const RESULT = {
  UNKNOWN: 0x00,
  SUCCESS: 0x01,
  PARTLY_SUCCESS: 0x02,
  REJECT: 0x10,
  NO_CONNECTION: 0x22,
  TRANSACTION_ABORTED: 0x35,
} as const;

export const RESULT_LABELS: Record<number, string> = {
  [RESULT.UNKNOWN]: 'Unknown',
  [RESULT.SUCCESS]: 'Success',
  [RESULT.PARTLY_SUCCESS]: 'Partly Success',
  [RESULT.REJECT]: 'Reject',
  [RESULT.NO_CONNECTION]: 'No Connection',
  [RESULT.TRANSACTION_ABORTED]: 'Transaction Aborted',
};

export const OPERATION_MODE_LABELS: Record<number, string> = {
  1: 'Normal',
  2: 'QR + Normal',
  3: 'Normal + Advanced Payment',
  4: 'QR + Normal + Advanced Payment',
  5: 'Remote Nodes + Normal',
  6: 'QR + Remote Nodes + Normal',
  7: 'Remote Nodes + QR + Normal + Advanced Payment',
};

export const hexVid = (vid: number): string =>
  `0x${vid.toString(16).padStart(2, '0').toUpperCase()}`;

export const width = (type: VidType): number => (type === 'uint16' ? 2 : type === 'uint8' ? 1 : 0);

export type TerminalConfig = Record<string, number>;

export const CONFIG_DEFAULTS: Readonly<TerminalConfig> = Object.freeze(
  Object.fromEntries(CONFIG_DEFINITIONS.map((d) => [d.key, d.default as number])),
);

export const rangeProblem = (
  definition: VidDefinition,
  value: number | null | undefined,
): string | null => {
  if (definition.type === 'none') return null;
  const name = `${definition.key} (${hexVid(definition.vid)})`;
  if (value === null || value === undefined || !Number.isInteger(value))
    return `${name} needs an integer value`;
  const min = definition.min ?? 0;
  const max = definition.max ?? (definition.type === 'uint16' ? 0xffff : 0xff);
  return value < min || value > max ? `${name} must be ${min}-${max}, got ${value}` : null;
};

// ───────────────────────────── Terminal -> server ──────────────────────────

export interface OutgoingRecord {
  vid: number;
  value?: number;
}

/**
 * Build a frame as the terminal sends it. Refuses unknown VIDs, VIDs a
 * terminal never sends, and out-of-spec values: a misbehaving frame goes
 * through `raw` on purpose, never by accident.
 */
export const encodeTerminalFrame = (
  records: OutgoingRecord[],
  clockSeconds = Math.floor(Date.now() / 1000),
): Buffer => {
  if (!records.length) throw new Error('A frame needs at least one record');
  const parts = records.map(({ vid, value }) => {
    const definition = CATALOGUE.get(vid);
    if (!definition) throw new Error(`Unknown VID ${hexVid(vid)}`);
    if (definition.kind !== 'event') {
      throw new Error(
        `${definition.key} (${hexVid(vid)}) is server -> terminal; a terminal does not send it`,
      );
    }
    const problem = rangeProblem(definition, value);
    if (problem) throw new Error(problem);

    const size = width(definition.type);
    const record = Buffer.alloc(2 + size);
    record.writeUInt8(vid, 0);
    record.writeUInt8(size, 1);
    if (size === 1) record.writeUInt8(value as number, 2);
    if (size === 2) record.writeUInt16LE(value as number, 2);
    return record;
  });
  const clock = Buffer.alloc(4);
  clock.writeUInt32BE(clockSeconds >>> 0, 0);
  return Buffer.concat([clock, ...parts]);
};

// ───────────────────────────── Server -> terminal ──────────────────────────

export interface DecodedRecord {
  vid: string;
  key: string | null;
  label: string;
  value: number | null;
  /** Human meaning of the value where there is one: 'Success', 'QR + Normal', ... */
  meaning: string | null;
  hex: string;
  /** Set when the value is outside the spec; firmware would reject it. */
  problem: string | null;
  kind: VidKind | null;
  raw: number;
}

export interface DecodedFrame {
  clock: number | null;
  records: DecodedRecord[] | null;
  error: string | null;
}

const meaningOf = (vid: number, value: number | null): string | null => {
  if (value === null) return null;
  if (OPERATION_VIDS.includes(vid)) return RESULT_LABELS[value] ?? `Unlisted result ${value}`;
  if (vid === VID.PAYMENT_STATUS) return value === 0 ? 'Idle' : value === 1 ? 'Busy' : null;
  if (vid === VID.OPERATION_MODE) return OPERATION_MODE_LABELS[value] ?? null;
  return null;
};

/** Walk the records of any frame. Never throws: a bad frame comes back with `error`. */
export const decodeFrame = (buffer: Buffer, clockOrder: 'le' | 'be'): DecodedFrame => {
  if (buffer.length < 6) {
    return {
      clock: null,
      records: null,
      error: `Frame is ${buffer.length} bytes; a record needs at least 6`,
    };
  }
  const clock = clockOrder === 'le' ? buffer.readUInt32LE(0) : buffer.readUInt32BE(0);
  const records: DecodedRecord[] = [];
  let offset = 4;

  while (offset < buffer.length) {
    if (offset + 2 > buffer.length)
      return { clock, records: null, error: `Record at byte ${offset} is cut short` };
    const vid = buffer.readUInt8(offset);
    const length = buffer.readUInt8(offset + 1);
    const start = offset + 2;
    if (start + length > buffer.length) {
      return {
        clock,
        records: null,
        error: `${hexVid(vid)} declares ${length} bytes, only ${buffer.length - start} left`,
      };
    }
    const bytes = buffer.subarray(start, start + length);
    const definition = CATALOGUE.get(vid);
    if (definition && length !== width(definition.type)) {
      return {
        clock,
        records: null,
        error: `${definition.key} (${hexVid(vid)}) must carry ${width(definition.type)} bytes, got ${length}`,
      };
    }
    const value = length === 1 ? bytes.readUInt8(0) : length === 2 ? bytes.readUInt16LE(0) : null;
    records.push({
      vid: hexVid(vid),
      key: definition?.key ?? null,
      label: definition?.label ?? `Unknown VID ${hexVid(vid)}`,
      value: definition ? value : null,
      meaning: definition ? meaningOf(vid, value) : null,
      hex: bytes.toString('hex'),
      problem: definition ? rangeProblem(definition, value) : null,
      kind: definition?.kind ?? null,
      raw: vid,
    });
    offset = start + length;
  }
  return { clock, records, error: null };
};

/** One line for the log: "transactionAmount=1250, payment=Success". */
export const summarise = (records: DecodedRecord[]): string =>
  records
    .map((r) => `${r.key ?? r.vid}${r.value === null ? '' : `=${r.meaning ?? r.value}`}`)
    .join(', ');
