"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SLIService = void 0;
const common_1 = require("@nestjs/common");
const logger_1 = require("./logger");
let SLIService = class SLIService {
    emit(metric) {
        logger_1.logger.info({
            sli_metric: metric.endpoint,
            latency_ms: metric.latencyMs,
            timestamp: metric.timestamp.toISOString(),
        }, 'SLI metric emitted');
    }
    recordLatency(endpoint, latencyMs) {
        this.emit({
            endpoint,
            latencyMs,
            timestamp: new Date(),
        });
    }
};
exports.SLIService = SLIService;
exports.SLIService = SLIService = __decorate([
    (0, common_1.Injectable)()
], SLIService);
//# sourceMappingURL=sli.service.js.map