import { Controller, MessageEvent, Sse, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserDocument } from '../users/schemas/user.schema';
import { TradingEventsService } from './trading-events.service';

@Controller('trading')
export class TradingEventsController {
  constructor(private readonly eventsService: TradingEventsService) {}

  /** SSE stream of journal-change events for the authenticated user. */
  @Sse('events')
  @UseGuards(AuthGuard('jwt-sse'))
  events(@CurrentUser() user: UserDocument): Observable<MessageEvent> {
    return this.eventsService.subscribe(user._id.toString());
  }
}
