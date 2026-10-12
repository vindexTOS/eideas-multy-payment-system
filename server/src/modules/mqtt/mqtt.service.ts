import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MqttClient, connect } from 'mqtt';
import { randomUUID } from 'node:crypto';
import { MqttConfig } from '../../config/configuration';
import { FrameCodec, PayloadField } from './frame.codec';
import { MqttRouterService } from './mqtt-router.service';
import { commandTopic, inboundTopicFilter } from './mqtt-topic.util';

export interface MqttStatus {
  enabled: boolean;
  connected: boolean;
  url: string;
  rootTopic: string;
  subscribedTo: string | null;
  clientId: string | null;
  reconnects: number;
  lastError: string | null;
}

/**
 * Transport layer: owns the broker connection and nothing else. Decoding and
 * business logic live in `MqttRouterService`.
 *
 * Improvements over the old Express listener: a single connection owned by
 * the DI container, automatic reconnect with observable state, a durable
 * clientId so the broker can keep the session, and dispatch into typed
 * handlers rather than an if/else chain.
 */
@Injectable()
export class MqttService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MqttService.name);
  private readonly config: MqttConfig;
  private client: MqttClient | null = null;
  private clientId: string | null = null;
  private subscribedTo: string | null = null;
  private reconnects = 0;
  private lastError: string | null = null;

  constructor(
    config: ConfigService,
    private readonly router: MqttRouterService,
    private readonly codec: FrameCodec,
  ) {
    this.config = config.getOrThrow<MqttConfig>('mqtt');
  }

  onModuleInit(): void {
    if (!this.config.enabled) {
      this.logger.warn('MQTT listener disabled (MQTT_ENABLED=false)');
      return;
    }
    this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (!this.client) return;
    await new Promise<void>((resolve) => this.client?.end(false, {}, () => resolve()));
    this.client = null;
  }

  getStatus(): MqttStatus {
    return {
      enabled: this.config.enabled,
      connected: this.client?.connected ?? false,
      url: `${this.config.url}:${this.config.port}`,
      rootTopic: this.config.rootTopic,
      subscribedTo: this.subscribedTo,
      clientId: this.clientId,
      reconnects: this.reconnects,
      lastError: this.lastError,
    };
  }

  /** Send a command frame to a terminal. */
  publishCommand(deviceUid: string, command: number, fields: PayloadField[] = []): Promise<void> {
    return this.publishRaw(
      commandTopic(this.config.rootTopic, deviceUid, 'general'),
      this.codec.encode(command, fields),
    );
  }

  publishRaw(topic: string, payload: Buffer | string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client?.connected) {
        reject(new Error('MQTT client is not connected'));
        return;
      }
      this.client.publish(topic, payload, { qos: this.config.qos }, (error) =>
        error ? reject(error) : resolve(),
      );
    });
  }

  private connect(): void {
    this.clientId = `${this.config.clientIdPrefix}-${randomUUID().slice(0, 8)}`;
    const filter = inboundTopicFilter(this.config.rootTopic);

    this.client = connect(this.config.url, {
      port: this.config.port,
      username: this.config.username,
      password: this.config.password,
      clientId: this.clientId,
      clean: false,
      reconnectPeriod: 5000,
      connectTimeout: 15000,
      keepalive: 30,
    });

    this.client.on('connect', () => {
      this.logger.log(`Connected to ${this.config.url}:${this.config.port} as ${this.clientId}`);
      this.client?.subscribe(filter, { qos: this.config.qos }, (error, granted) => {
        if (error) {
          this.lastError = error.message;
          this.logger.error(`Subscribe to ${filter} failed: ${error.message}`);
          return;
        }
        this.subscribedTo = filter;
        this.logger.log(
          `Subscribed: ${granted?.map((g) => `${g.topic} (qos ${g.qos})`).join(', ')}`,
        );
      });
    });

    this.client.on('message', (topic, payload) => {
      // Fire and forget: the broker must not be blocked by our DB writes,
      // and the router already logs every failure.
      void this.router.dispatch(topic, payload).catch((error: Error) => {
        this.logger.error(`Dispatch crashed for ${topic}: ${error.message}`);
      });
    });

    this.client.on('reconnect', () => {
      this.reconnects += 1;
      this.logger.warn(`Reconnecting to broker (attempt ${this.reconnects})`);
    });

    this.client.on('error', (error) => {
      this.lastError = error.message;
      this.logger.error(`Broker error: ${error.message}`);
    });

    this.client.on('close', () => {
      this.subscribedTo = null;
      this.logger.warn('Broker connection closed');
    });
  }
}
