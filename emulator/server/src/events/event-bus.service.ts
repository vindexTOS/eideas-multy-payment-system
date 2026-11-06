import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { DeviceView, FrameEntry } from '../devices/device.types';

export type StreamEvent =
  | { type: 'frame'; frame: FrameEntry }
  | { type: 'device'; device: DeviceView }
  | { type: 'removed'; deviceId: string };

/** In-process fan-out to every open UI tab (the SSE stream). */
@Injectable()
export class EventBusService {
  private readonly subject = new Subject<StreamEvent>();

  emit(event: StreamEvent): void {
    this.subject.next(event);
  }

  get events$(): Observable<StreamEvent> {
    return this.subject.asObservable();
  }
}
