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
  /**
   * The VID records after the timestamp, when the frame is a well-formed
   * terminal-protocol frame (see protocol/terminal-protocol.ts). Null for
   * JSON and for anything that does not chain into records exactly.
   */
  records: VidRecord[] | null;
  /** Why a frame that looked like VID records was refused, for the audit log. */
  protocolError: string | null;
}

/** One `[VID][len][value]` record of a terminal-protocol frame. */
export interface VidRecord {
  vid: number;
  /** Catalogue key ('payment', 'transactionAmount', ...), null for a VID the catalogue lacks. */
  key: string | null;
  length: number;
  /** Unsigned integer value; null for a zero-length record or an unknown VID. */
  value: number | null;
  /** Value bytes as hex. */
  hex: string;
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
  /**
   * VIDs this handler claims in terminal-protocol frames. Those frames are
   * routed by VID whatever topic they arrived on; `event` then only matters
   * for JSON frames (the simulator).
   */
  readonly vids?: readonly number[];
  /** Short name used in logs and in the device_messages audit row. */
  readonly name: string;
  handle(message: MqttInboundMessage): Promise<void>;
}

export const DEVICE_EVENT_HANDLERS = Symbol('DEVICE_EVENT_HANDLERS');
