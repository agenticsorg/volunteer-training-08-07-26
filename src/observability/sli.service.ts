import { Injectable } from '@nestjs/common';
import { logger } from './logger';

export interface SLIMetric {
  endpoint: string;
  latencyMs: number;
  timestamp: Date;
}

@Injectable()
export class SLIService {
  emit(metric: SLIMetric): void {
    logger.info({
      sli_metric: metric.endpoint,
      latency_ms: metric.latencyMs,
      timestamp: metric.timestamp.toISOString(),
    }, 'SLI metric emitted');
  }

  recordLatency(endpoint: string, latencyMs: number): void {
    this.emit({
      endpoint,
      latencyMs,
      timestamp: new Date(),
    });
  }
}
