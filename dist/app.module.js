"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const core_1 = require("@nestjs/core");
const health_module_1 = require("./health/health.module");
const observability_module_1 = require("./observability/observability.module");
const queue_module_1 = require("./queue/queue.module");
const database_module_1 = require("./database/database.module");
const tenant_context_interceptor_1 = require("./common/interceptors/tenant-context.interceptor");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({
                isGlobal: true,
                envFilePath: '.env',
            }),
            database_module_1.DatabaseModule,
            health_module_1.HealthModule,
            observability_module_1.ObservabilityModule,
            queue_module_1.QueueModule,
        ],
        providers: [
            {
                provide: core_1.APP_INTERCEPTOR,
                useClass: tenant_context_interceptor_1.TenantContextInterceptor,
            },
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map