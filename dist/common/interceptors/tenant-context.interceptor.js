"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TenantContextInterceptor = void 0;
const common_1 = require("@nestjs/common");
const logger_1 = require("../../observability/logger");
let TenantContextInterceptor = class TenantContextInterceptor {
    constructor() {
        this.skipPaths = ['/health', '/metrics'];
    }
    intercept(context, next) {
        const request = context.switchToHttp().getRequest();
        // Skip tenant context check for public endpoints
        if (this.skipPaths.some(path => request.path.startsWith(path))) {
            return next.handle();
        }
        // Extract tenantId from request headers (in test mode) or JWT (in production)
        // For now, we'll use a header-based approach for testing
        const tenantId = request.headers['x-tenant-id'] ||
            request.user?.tenantId;
        if (!tenantId) {
            logger_1.logger.warn({ path: request.path }, 'Missing tenantId in request');
            throw new common_1.BadRequestException('Missing tenantId');
        }
        // Store tenantId in request for later use
        request.tenantId = tenantId;
        logger_1.logger.debug({ tenantId, path: request.path }, 'TenantContext set');
        return next.handle();
    }
};
exports.TenantContextInterceptor = TenantContextInterceptor;
exports.TenantContextInterceptor = TenantContextInterceptor = __decorate([
    (0, common_1.Injectable)()
], TenantContextInterceptor);
//# sourceMappingURL=tenant-context.interceptor.js.map