/**
 * The payment-terminal VID protocol: every value the terminal and the server
 * exchange, by VID (value id). Pure data and pure functions, so it is cheap
 * to unit test and has no way to take the service down.
 *
 * Wire layout, both directions (see FrameCodec):
 *
 *     ┌──────────────┬────────┬────────┬───────────┬────────┬─────┐
 *     │ timestamp 4B │ VID 1B │ len 1B │ value lenB │ VID 1B │ ... │
 *     └──────────────┴────────┴────────┴───────────┴────────┴─────┘
 *
 * A frame carries one or more records after the timestamp. A one-record
 * frame is byte-for-byte the frame the lift terminals speak
 * ([ts][cmd][len][payload]) with the VID in the command byte, which is why
 * FrameCodec's header decode keeps working unchanged.
 *
 * The VID space is split by direction:
 *   0x01-0x4F  configs   server -> terminal
 *   0x50-0x7F  commands  server -> terminal
 *   0x80-0xFF  events    terminal -> server
 *
 * ASSUMPTIONS, to confirm with the firmware author (the spec does not say):
 *  - several records may share one frame, so 0x80 (amount) travels in the
 *    same frame as the 0x81 (payment result) it belongs to;
 *  - multi-byte values are little-endian, like every outbound number16 the
 *    lift terminals already accept. Flip VALUE_BYTE_ORDER if not: the
 *    1-10000 range check on amounts rejects most wrong-order reads, so a
 *    mismatch shows up as unbooked frames, not as invented money.
 */

export const VALUE_BYTE_ORDER: 'le' | 'be' = 'le';

export type VidValueType = 'uint8' | 'uint16' | 'none';
export type VidKind = 'config' | 'command' | 'event';

export const VID = {
  // ── configs ────────────────────────────────────────────────────────────
  COUNTRY_CODE: 0x01,
  SCALE_FACTOR: 0x02,
  PULSE_FREQUENCY: 0x03,
  PULSE_DUTY_CYCLE: 0x04,
  LCD_BRIGHTNESS: 0x05,
  ADV_BOARD_BRIGHTNESS: 0x06,
  RS485_SCAN_COUNT: 0x07,
  OPERATION_MODE: 0x08,
  // ── commands ───────────────────────────────────────────────────────────
  SET_AMOUNT: 0x50,
  RECONCILE: 0x51,
  // ── events ─────────────────────────────────────────────────────────────
  TRANSACTION_AMOUNT: 0x80,
  PAYMENT: 0x81,
  PAYMENT_STATUS: 0x82,
  CANCEL: 0x84,
  WAIT: 0x95,
  /** The spec names 0x84 and 0x9A both "Cancel Transaction"; kept apart until clarified. */
  CANCEL_9A: 0x9a,
  RETURN: 0x9d,
  VOID: 0xb5,
  RECONCILIATION: 0xbb,
} as const;

export interface VidDefinition {
  vid: number;
  /** Stable camelCase name, used in logs, the audit trail and the config JSON. */
  key: string;
  kind: VidKind;
  type: VidValueType;
  label: string;
  min?: number;
  max?: number;
  default?: number;
}

/** Result byte shared by every terminal operation event (0x81, 0x84, 0x95, ...). */
export enum OperationResult {
  UNKNOWN = 0x00,
  SUCCESS = 0x01,
  PARTLY_SUCCESS = 0x02,
  REJECT = 0x10,
  NO_CONNECTION = 0x22,
  TRANSACTION_ABORTED = 0x35,
}

export const OPERATION_RESULT_LABELS: Record<number, string> = {
  [OperationResult.UNKNOWN]: 'Unknown',
  [OperationResult.SUCCESS]: 'Success',
  [OperationResult.PARTLY_SUCCESS]: 'Partly Success',
  [OperationResult.REJECT]: 'Reject',
  [OperationResult.NO_CONNECTION]: 'No Connection',
  [OperationResult.TRANSACTION_ABORTED]: 'Transaction Aborted',
};

/** VID 0x82. */
export enum PaymentStatusValue {
  IDLE = 0,
  BUSY = 1,
}

/** VID 0x08. */
export enum OperationMode {
  NORMAL = 1,
  QR_NORMAL = 2,
  NORMAL_ADVANCED = 3,
  QR_NORMAL_ADVANCED = 4,
  REMOTE_NORMAL = 5,
  QR_REMOTE_NORMAL = 6,
  REMOTE_QR_NORMAL_ADVANCED = 7,
}

export const OPERATION_MODE_LABELS: Record<number, string> = {
  [OperationMode.NORMAL]: 'Normal',
  [OperationMode.QR_NORMAL]: 'QR + Normal',
  [OperationMode.NORMAL_ADVANCED]: 'Normal + Advanced Payment',
  [OperationMode.QR_NORMAL_ADVANCED]: 'QR + Normal + Advanced Payment',
  [OperationMode.REMOTE_NORMAL]: 'Remote Nodes + Normal',
  [OperationMode.QR_REMOTE_NORMAL]: 'QR + Remote Nodes + Normal',
  [OperationMode.REMOTE_QR_NORMAL_ADVANCED]: 'Remote Nodes + QR + Normal + Advanced Payment',
};

const result = (vid: number, key: string, label: string): VidDefinition => ({
  vid,
  key,
  kind: 'event',
  type: 'uint8',
  label,
});

export const VID_DEFINITIONS: readonly VidDefinition[] = [
  {
    vid: VID.COUNTRY_CODE,
    key: 'countryCode',
    kind: 'config',
    type: 'uint16',
    label: 'Country Code',
    min: 0,
    max: 0xffff,
    // 0x3D5 = 981, which is the ISO 4217 code of the lari (GEL).
    default: 0x3d5,
  },
  {
    vid: VID.SCALE_FACTOR,
    key: 'scaleFactor',
    kind: 'config',
    type: 'uint16',
    label: 'Scale Factor (tetri)',
    min: 10,
    max: 10000,
    default: 100,
  },
  {
    vid: VID.PULSE_FREQUENCY,
    key: 'pulseFrequency',
    kind: 'config',
    type: 'uint8',
    label: 'Pulse Frequency (Hz, 0 = 0.5 Hz)',
    min: 0,
    max: 50,
    default: 5,
  },
  {
    vid: VID.PULSE_DUTY_CYCLE,
    key: 'pulseDutyCycle',
    kind: 'config',
    type: 'uint8',
    label: 'Pulse Duty Cycle (%)',
    min: 10,
    max: 80,
    default: 50,
  },
  {
    vid: VID.LCD_BRIGHTNESS,
    key: 'lcdBrightness',
    kind: 'config',
    type: 'uint8',
    label: 'LCD Brightness (%)',
    min: 1,
    max: 100,
    default: 100,
  },
  {
    vid: VID.ADV_BOARD_BRIGHTNESS,
    key: 'advBoardBrightness',
    kind: 'config',
    type: 'uint8',
    label: 'Adv. Board Brightness (%)',
    min: 1,
    max: 100,
    default: 100,
  },
  {
    vid: VID.RS485_SCAN_COUNT,
    key: 'rs485ScanCount',
    kind: 'config',
    type: 'uint8',
    label: 'RS485 Slave Node Scan Count',
    min: 1,
    max: 16,
    default: 4,
  },
  {
    vid: VID.OPERATION_MODE,
    key: 'operationMode',
    kind: 'config',
    type: 'uint8',
    label: 'Operation Mode',
    min: OperationMode.NORMAL,
    max: OperationMode.REMOTE_QR_NORMAL_ADVANCED,
    default: OperationMode.NORMAL,
  },
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
  result(VID.PAYMENT, 'payment', 'Payment'),
  {
    vid: VID.PAYMENT_STATUS,
    key: 'paymentStatus',
    kind: 'event',
    type: 'uint8',
    label: 'Payment Status',
  },
  result(VID.CANCEL, 'cancel', 'Cancel Transaction'),
  result(VID.WAIT, 'wait', 'Wait'),
  result(VID.CANCEL_9A, 'cancel9a', 'Cancel Transaction (0x9A)'),
  result(VID.RETURN, 'return', 'Return'),
  result(VID.VOID, 'void', 'Void Transaction'),
  result(VID.RECONCILIATION, 'reconciliation', 'Reconciliation'),
];

export const VID_CATALOGUE: ReadonlyMap<number, VidDefinition> = new Map(
  VID_DEFINITIONS.map((definition) => [definition.vid, definition]),
);

/** Every event whose value is an OperationResult. */
export const OPERATION_VIDS: readonly number[] = [
  VID.PAYMENT,
  VID.CANCEL,
  VID.WAIT,
  VID.CANCEL_9A,
  VID.RETURN,
  VID.VOID,
  VID.RECONCILIATION,
];

export const valueWidth = (type: VidValueType): number =>
  type === 'uint16' ? 2 : type === 'uint8' ? 1 : 0;

export const hexVid = (vid: number): string =>
  `0x${vid.toString(16).padStart(2, '0').toUpperCase()}`;

// ───────────────────────────── Terminal config ────────────────────────────

export interface TerminalConfig {
  countryCode: number;
  scaleFactor: number;
  pulseFrequency: number;
  pulseDutyCycle: number;
  lcdBrightness: number;
  advBoardBrightness: number;
  rs485ScanCount: number;
  operationMode: number;
}

export type TerminalConfigKey = keyof TerminalConfig;

export const CONFIG_DEFINITIONS = VID_DEFINITIONS.filter((d) => d.kind === 'config');

export const TERMINAL_CONFIG_DEFAULTS: Readonly<TerminalConfig> = Object.freeze(
  Object.fromEntries(
    CONFIG_DEFINITIONS.map((d) => [d.key, d.default]),
  ) as unknown as TerminalConfig,
);

/**
 * Stored config over the spec defaults, so a device never has a hole in its
 * config. Only catalogue keys survive, so a key a later spec drops is shed.
 */
export const effectiveConfig = (
  stored: Record<string, unknown> | null | undefined,
): TerminalConfig =>
  Object.fromEntries(
    CONFIG_DEFINITIONS.map((d) => {
      const value = stored?.[d.key];
      return [d.key, typeof value === 'number' ? value : d.default];
    }),
  ) as unknown as TerminalConfig;

/** Why `value` cannot go out under `definition`, or null when it can. */
export const rangeProblem = (
  definition: VidDefinition,
  value: number | undefined,
): string | null => {
  if (definition.type === 'none') return null;
  const name = `${definition.key} (${hexVid(definition.vid)})`;
  if (value === undefined || !Number.isInteger(value)) return `${name} needs an integer value`;
  const min = definition.min ?? 0;
  const max = definition.max ?? (definition.type === 'uint16' ? 0xffff : 0xff);
  return value < min || value > max ? `${name} must be ${min}-${max}, got ${value}` : null;
};
