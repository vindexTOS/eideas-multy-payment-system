import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable, interval, map, merge } from 'rxjs';
import { EventBusService } from './event-bus.service';

/** Live feed for the UI: frames as they happen, device state as it changes. */
@Controller('stream')
export class StreamController {
  constructor(private readonly bus: EventBusService) {}

  @Sse()
  stream(): Observable<MessageEvent> {
    return merge(
      this.bus.events$.pipe(map((event) => ({ type: event.type, data: event }))),
      // Keeps idle proxies from closing the connection.
      interval(25_000).pipe(map(() => ({ type: 'ping', data: {} }))),
    );
  }
}
