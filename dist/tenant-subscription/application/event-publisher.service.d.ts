import { EventEmitter2 } from '@nestjs/event-emitter';
import { DomainEvent } from '@common/domain/domain-event';
export declare class EventPublisherService {
    private eventEmitter;
    private logger;
    constructor(eventEmitter: EventEmitter2);
    publishEvent(event: DomainEvent): Promise<void>;
    publishEvents(events: DomainEvent[]): Promise<void>;
}
//# sourceMappingURL=event-publisher.service.d.ts.map