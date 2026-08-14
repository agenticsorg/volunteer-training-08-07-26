export interface SLIMetric {
    endpoint: string;
    latencyMs: number;
    timestamp: Date;
}
export declare class SLIService {
    emit(metric: SLIMetric): void;
    recordLatency(endpoint: string, latencyMs: number): void;
}
//# sourceMappingURL=sli.service.d.ts.map