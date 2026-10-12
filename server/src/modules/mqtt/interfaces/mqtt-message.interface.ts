/**
 * Topic convention this platform owns:
 *
 *   inbound   {root}/{deviceUid}/events/{event}
 *   outbound  {root}/{deviceUid}/commands/{command}
 *
 * `root` is configurable (MQTT_ROOT_TOPIC) so staging and production can
 * share a broker without hearing each other.
 */
export interface ParsedTopic {
  root: string;
  deviceUid: string;
  direction: 'events' | 'commands' | 'unknown';
  event: string;
  raw: string;
}

/** A decoded binary frame, same framing the lift terminals already use. */
export interface DecodedFrame {
  /** Device clock, unix seconds. */
  timestamp: number | null;
  /** Command/opcode byte. */
  command: number | null;
  /** Declared payload length. */
  length: number | null;
  /** Payload bytes after the 6-byte header. */
  payload: Buffer;
  /** Set when the payload turned out to be JSON. */
  json: Record<string, unknown> | null;
  /** Whole frame as hex, always present. */
  hex: string;
  /** False when the buffer was too short to be a framed message. */
  framed: boolean;
}

export interface MqttInboundMessage {
  topic: ParsedTopic;
  frame: DecodedFrame;
  receivedAt: Date;
}

/**
 * One handler per device event. Registering a new event type means adding a
 * file - not editing a growing if/else chain, which is what the old Express
 * listener turned into.
 */
export interface DeviceEventHandler {
  /** Event segment this handler claims, or '*' for a fallback. */
  readonly event: string;
  /** Short name used in logs and in the device_messages audit row. */
  readonly name: string;
  handle(message: MqttInboundMessage): Promise<void>;
}

export const DEVICE_EVENT_HANDLERS = Symbol('DEVICE_EVENT_HANDLERS');
