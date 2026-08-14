import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent } from '@common/domain/domain-event';

@Injectable()
export class EventPublisherService {
  private logger = new Logger('EventPublisher');

  constructor(private eventEmitter: EventEmitter2) {}

  async publishEvent(event: DomainEvent): Promise<void> {
    this.logger.debug(`Publishing event: ${event.constructor.name}`, event);
    await this.eventEmitter.emitAsync(event.constructor.name, event);
  }

  async publishEvents(events: DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.publishEvent(event);
    }
  }
}
