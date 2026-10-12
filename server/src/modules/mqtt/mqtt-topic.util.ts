import { ParsedTopic } from './interfaces/mqtt-message.interface';

/**
 * Topics are parsed, never regex-matched inline at the call site. This is
 * the only place that knows the layout.
 */
export const parseTopic = (topic: string): ParsedTopic => {
  const segments = topic.split('/').filter(Boolean);
  const [root = '', deviceUid = '', rawDirection = '', ...rest] = segments;

  const direction: ParsedTopic['direction'] =
    rawDirection === 'events' || rawDirection === 'commands' ? rawDirection : 'unknown';

  return {
    root,
    deviceUid,
    direction,
    // Sub-paths collapse into one event name: events/payment/success -> payment/success
    event: rest.join('/') || 'general',
    raw: topic,
  };
};

export const inboundTopicFilter = (root: string): string => `${root}/+/events/#`;

export const commandTopic = (root: string, deviceUid: string, command = 'general'): string =>
  `${root}/${deviceUid}/commands/${command}`;
