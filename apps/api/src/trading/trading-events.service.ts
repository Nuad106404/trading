import { Injectable, MessageEvent } from '@nestjs/common';
import { interval, map, merge, Observable, Subject } from 'rxjs';

export type TradingScope = 'trades' | 'cash' | 'stats';

/**
 * Per-user SSE fan-out. Services emit lightweight scope events after every
 * journal mutation; each of the user's connected clients (phone, desktop,
 * multiple tabs) invalidates only the affected components. Admin edits emit
 * to the journal OWNER, so their open app updates live too.
 */
@Injectable()
export class TradingEventsService {
  private readonly streams = new Map<string, Subject<MessageEvent>>();

  subscribe(userId: string): Observable<MessageEvent> {
    let subject = this.streams.get(userId);
    if (!subject) {
      subject = new Subject<MessageEvent>();
      this.streams.set(userId, subject);
    }
    // heartbeat keeps proxies (nginx) from timing the idle stream out
    const heartbeat = interval(25_000).pipe(map((): MessageEvent => ({ data: 'ping' })));
    return merge(subject.asObservable(), heartbeat);
  }

  emit(userId: string, scopes: TradingScope[]): void {
    const subject = this.streams.get(userId);
    if (!subject || !subject.observed) return;
    subject.next({ data: { scopes } });
  }
}
