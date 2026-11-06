import { MqttClient, connect } from 'mqtt';
import { EmulatorConfig } from '../config';
import { DeviceRecord, NewFrameEntry, TerminalRuntime } from '../devices/device.types';
import {
  CONFIG_DEFAULTS,
  OPERATION_MODE_LABELS,
  OutgoingRecord,
  RESULT,
  RESULT_LABELS,
  TerminalConfig,
  VID,
  decodeFrame,
  encodeTerminalFrame,
  summarise,
} from '../protocol/terminal-protocol';

export class TerminalOfflineError extends Error {}
export class NothingPendingError extends Error {}

export interface TerminalHooks {
  log(entry: NewFrameEntry): void;
  /** Runtime or record changed: tell the UI. */
  changed(): void;
  /** `device` changed in a way that must survive a restart (received config). */
  persist(): void;
}

const lari = (tetri: number): string => `${(tetri / 100).toFixed(2)} GEL`;
const MONEY_MOVED: ReadonlySet<number> = new Set([RESULT.SUCCESS, RESULT.PARTLY_SUCCESS]);

/**
 * One emulated payment terminal: its own MQTT connection, its own client id,
 * subscribed to its own command topic, publishing events exactly where a real
 * terminal would. The platform cannot tell it from hardware - which is the
 * point - except by the uid prefix.
 */
export class VirtualTerminal {
  readonly runtime: TerminalRuntime = {
    connected: false,
    online: false,
    paymentStatus: 'idle',
    pending: null,
    lastError: null,
    connectedAt: null,
    lastHeartbeatAt: null,
  };

  private client: MqttClient | null = null;
  private heartbeat: NodeJS.Timeout | null = null;
  private readonly timers = new Set<NodeJS.Timeout>();

  constructor(
    public device: DeviceRecord,
    private readonly config: EmulatorConfig,
    private readonly hooks: TerminalHooks,
  ) {}

  get clientId(): string {
    return `${this.config.mqtt.clientIdPrefix}-${this.device.uid}`;
  }

  private get commandFilter(): string {
    return `${this.config.mqtt.rootTopic}/${this.device.uid}/commands/#`;
  }

  private eventTopic(kind: 'general' | 'heartbeat'): string {
    return `${this.config.mqtt.rootTopic}/${this.device.uid}/events/${kind}`;
  }

  /** Name or behaviour changed from the UI. */
  update(device: DeviceRecord): void {
    this.device = device;
    if (this.runtime.connected) this.startHeartbeat();
  }

  // ───────────────────────────── connection ────────────────────────────────

  connect(): void {
    if (this.client) return;
    const { mqtt } = this.config;
    this.runtime.online = true;

    // Stable client id + persistent session, like hardware: commands the
    // server sends while this terminal is offline arrive when it is back.
    const client = connect(mqtt.url, {
      port: mqtt.port,
      username: mqtt.username,
      password: mqtt.password,
      clientId: this.clientId,
      clean: false,
      reconnectPeriod: 5000,
      connectTimeout: 10_000,
      keepalive: 30,
    });
    this.client = client;

    client.on('connect', () => {
      this.runtime.connected = true;
      this.runtime.connectedAt = new Date().toISOString();
      this.runtime.lastError = null;
      client.subscribe(this.commandFilter, { qos: mqtt.qos }, (error) => {
        if (error) {
          this.note(`Subscribe to ${this.commandFilter} failed: ${error.message}`);
          return;
        }
        this.note(
          `Connected to ${mqtt.url}:${mqtt.port} as ${this.clientId}, listening on ${this.commandFilter}`,
        );
        // What a terminal says on power-up: here I am, and this is my status.
        this.safely(() => this.setStatus(this.runtime.paymentStatus));
      });
      this.startHeartbeat();
      this.hooks.changed();
    });

    client.on('message', (topic, payload) => this.safely(() => this.onCommand(topic, payload)));

    client.on('close', () => {
      this.stopHeartbeat();
      if (!this.runtime.connected) return;
      this.runtime.connected = false;
      this.note('Disconnected from broker');
      this.hooks.changed();
    });

    client.on('error', (error) => {
      // Fires on every failed reconnect; only a new error is news.
      if (this.runtime.lastError === error.message) return;
      this.runtime.lastError = error.message;
      this.hooks.changed();
    });
  }

  /** Power off: the connection, any pending operation and every timer go. */
  async disconnect(): Promise<void> {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.stopHeartbeat();

    const client = this.client;
    this.client = null;
    this.runtime.online = false;
    this.runtime.pending = null;
    this.runtime.paymentStatus = 'idle';
    if (client) await new Promise<void>((resolve) => client.end(false, {}, () => resolve()));
    this.hooks.changed();
  }

  // ───────────────────────────── server -> terminal ────────────────────────

  private onCommand(topic: string, payload: Buffer): void {
    const decoded = decodeFrame(payload, 'le');
    this.hooks.log({
      direction: 'in',
      topic,
      hex: payload.toString('hex'),
      summary: decoded.error ?? summarise(decoded.records ?? []),
      records: decoded.records,
    });
    if (!decoded.records) return;

    const configChanges: TerminalConfig = {};
    for (const record of decoded.records) {
      if (record.problem) {
        // What strict firmware would do: refuse the value, keep the old one.
        this.note(`Rejected ${record.key}: ${record.problem}`);
      } else if (record.kind === 'config') {
        configChanges[record.key as string] = record.value as number;
      } else if (record.raw === VID.SET_AMOUNT) {
        this.onSetAmount(record.value as number);
      } else if (record.raw === VID.RECONCILE) {
        this.onReconcile();
      } else if (record.kind === 'event') {
        this.note(
          `Ignored ${record.label}: an event VID, which terminals send rather than receive`,
        );
      } else {
        this.note(`Ignored ${record.label}`);
      }
    }

    if (Object.keys(configChanges).length) this.applyConfig(configChanges);
  }

  private applyConfig(changes: TerminalConfig): void {
    const config = { ...(this.device.config ?? CONFIG_DEFAULTS), ...changes };
    this.device = { ...this.device, config, configReceivedAt: new Date().toISOString() };
    this.hooks.persist();
    const described = Object.entries(changes)
      .map(([key, value]) =>
        key === 'operationMode'
          ? `${key}=${value} (${OPERATION_MODE_LABELS[value]})`
          : `${key}=${value}`,
      )
      .join(', ');
    this.note(`Applied config: ${described}`);
    this.hooks.changed();
  }

  private onSetAmount(amountTetri: number): void {
    const busy = this.runtime.pending;
    if (busy) {
      this.note(`Busy with a ${busy.kind}; set-amount ${lari(amountTetri)} ignored`);
      return;
    }
    this.runtime.pending = { kind: 'payment', amountTetri, since: new Date().toISOString() };
    this.setStatus('busy');
    this.answerLater(
      'payment',
      this.device.behaviour.paymentResult,
      `Charging ${lari(amountTetri)}`,
    );
  }

  private onReconcile(): void {
    const busy = this.runtime.pending;
    if (busy) {
      this.note(`Busy with a ${busy.kind}; reconciliation ignored`);
      return;
    }
    this.runtime.pending = { kind: 'reconciliation', since: new Date().toISOString() };
    this.setStatus('busy');
    this.answerLater('reconciliation', this.device.behaviour.reconciliationResult, 'Reconciling');
  }

  private answerLater(kind: 'payment' | 'reconciliation', result: number, doing: string): void {
    const { mode, responseDelayMs } = this.device.behaviour;
    if (mode === 'manual') {
      this.note(`${doing} - waiting for you to answer from the emulator`);
    } else {
      this.note(`${doing} - answering ${RESULT_LABELS[result] ?? result} in ${responseDelayMs} ms`);
      const timer = setTimeout(() => {
        this.timers.delete(timer);
        if (this.runtime.pending?.kind === kind) this.safely(() => this.complete(result));
      }, responseDelayMs);
      this.timers.add(timer);
    }
    this.hooks.changed();
  }

  // ───────────────────────────── terminal -> server ────────────────────────

  /** Answer the pending 0x50 / 0x51 with `result`. */
  complete(result: number): void {
    const pending = this.runtime.pending;
    if (!pending) throw new NothingPendingError('Nothing is waiting for an answer');
    if (pending.kind === 'payment') {
      this.publish([
        { vid: VID.TRANSACTION_AMOUNT, value: pending.amountTetri },
        { vid: VID.PAYMENT, value: result },
      ]);
      if (MONEY_MOVED.has(result)) this.notePulses(pending.amountTetri);
    } else {
      this.publish([{ vid: VID.RECONCILIATION, value: result }]);
    }
    this.runtime.pending = null;
    this.setStatus('idle');
    this.hooks.changed();
  }

  /** A customer paying at the terminal, unprompted by the server. */
  sendPayment(amountTetri: number, result: number): void {
    this.requireConnected();
    this.publish([
      { vid: VID.TRANSACTION_AMOUNT, value: amountTetri },
      { vid: VID.PAYMENT, value: result },
    ]);
    if (MONEY_MOVED.has(result)) this.notePulses(amountTetri);
  }

  sendStatus(status: 'idle' | 'busy'): void {
    this.requireConnected();
    this.setStatus(status);
    this.hooks.changed();
  }

  sendOperation(vid: number, result: number, amountTetri?: number): void {
    this.requireConnected();
    const records: OutgoingRecord[] = [{ vid, value: result }];
    if (amountTetri !== undefined)
      records.unshift({ vid: VID.TRANSACTION_AMOUNT, value: amountTetri });
    this.publish(records);
  }

  /** Exact bytes, spec or not: how you test what the listener does with a bad frame. */
  sendRaw(hex: string): void {
    this.requireConnected();
    const frame = Buffer.from(hex, 'hex');
    const topic = this.eventTopic('general');
    this.client!.publish(topic, frame, { qos: this.config.mqtt.qos });
    const decoded = decodeFrame(frame, 'be');
    this.hooks.log({
      direction: 'out',
      topic,
      hex: frame.toString('hex'),
      summary: `raw: ${decoded.error ?? summarise(decoded.records ?? [])}`,
      records: decoded.records,
    });
  }

  private setStatus(status: 'idle' | 'busy'): void {
    this.runtime.paymentStatus = status;
    this.publish([{ vid: VID.PAYMENT_STATUS, value: status === 'busy' ? 1 : 0 }]);
  }

  /**
   * Publishes while the client exists, connected or reconnecting: mqtt.js
   * queues QoS 1 frames and sends them once the broker is back, which is
   * what a terminal with a flaky modem does too.
   */
  private publish(records: OutgoingRecord[], kind: 'general' | 'heartbeat' = 'general'): void {
    const client = this.client;
    if (!client) throw new TerminalOfflineError(`${this.device.uid} is switched off`);
    const frame = encodeTerminalFrame(records);
    const topic = this.eventTopic(kind);
    client.publish(topic, frame, { qos: this.config.mqtt.qos }, (error) => {
      if (error) this.note(`Publish to ${topic} failed: ${error.message}`);
    });
    // Heartbeats are counted, not logged: one a minute would bury the frames that matter.
    if (kind === 'heartbeat') return;
    const { records: sent } = decodeFrame(frame, 'be');
    this.hooks.log({
      direction: 'out',
      topic,
      hex: frame.toString('hex'),
      summary: summarise(sent ?? []),
      records: sent,
    });
  }

  private requireConnected(): void {
    if (!this.client || !this.runtime.connected) {
      throw new TerminalOfflineError(`${this.device.uid} is not connected to the broker`);
    }
  }

  // ───────────────────────────── helpers ───────────────────────────────────

  /** What the pulse output would do with this payment under the current config. */
  private notePulses(amountTetri: number): void {
    const config = { ...CONFIG_DEFAULTS, ...(this.device.config ?? {}) };
    const pulses = Math.floor(amountTetri / config.scaleFactor);
    const leftover = amountTetri % config.scaleFactor;
    const hz = config.pulseFrequency === 0 ? 0.5 : config.pulseFrequency;
    this.note(
      `Pulse output: ${pulses} pulse(s) at ${hz} Hz, ${config.pulseDutyCycle}% duty ` +
        `(${config.scaleFactor} tetri per pulse)` +
        (leftover ? `, ${leftover} tetri left below one pulse` : ''),
    );
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    const seconds = this.device.behaviour.heartbeatSeconds;
    if (seconds <= 0) return;
    this.heartbeat = setInterval(() => {
      this.safely(() => {
        this.publish(
          [{ vid: VID.PAYMENT_STATUS, value: this.runtime.paymentStatus === 'busy' ? 1 : 0 }],
          'heartbeat',
        );
        this.runtime.lastHeartbeatAt = new Date().toISOString();
        this.hooks.changed();
      });
    }, seconds * 1000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private note(summary: string): void {
    this.hooks.log({ direction: 'note', topic: null, hex: null, summary, records: null });
  }

  /** Broker callbacks and timers must never throw: it would take the process down. */
  private safely(action: () => void): void {
    try {
      action();
    } catch (error) {
      this.note(`Error: ${(error as Error).message}`);
    }
  }
}
