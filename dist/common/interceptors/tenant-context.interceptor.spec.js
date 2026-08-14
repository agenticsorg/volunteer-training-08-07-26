"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const tenant_context_interceptor_1 = require("./tenant-context.interceptor");
describe('TenantContextInterceptor', () => {
    let interceptor;
    beforeEach(() => {
        interceptor = new tenant_context_interceptor_1.TenantContextInterceptor();
    });
    it('should be defined', () => {
        expect(interceptor).toBeDefined();
    });
    it('should extract tenantId from x-tenant-id header', () => {
        const mockRequest = {
            headers: { 'x-tenant-id': 'tenant-123' },
            path: '/api/messages',
        };
        const mockContext = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue(mockRequest),
            }),
        };
        const mockNext = {
            handle: jest.fn().mockReturnValue({ pipe: jest.fn(() => ({})) }),
        };
        interceptor.intercept(mockContext, mockNext);
        expect(mockRequest.tenantId).toBe('tenant-123');
        expect(mockNext.handle).toHaveBeenCalled();
    });
    it('should throw BadRequestException if tenantId is missing on protected endpoint', () => {
        const mockRequest = {
            headers: {},
            path: '/api/messages',
        };
        const mockContext = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue(mockRequest),
            }),
        };
        const mockNext = {
            handle: jest.fn(),
        };
        expect(() => {
            interceptor.intercept(mockContext, mockNext);
        }).toThrow(common_1.BadRequestException);
    });
    it('should skip tenant context check for /health endpoint', () => {
        const mockRequest = {
            headers: {},
            path: '/health',
        };
        const mockContext = {
            switchToHttp: jest.fn().mockReturnValue({
                getRequest: jest.fn().mockReturnValue(mockRequest),
            }),
        };
        const mockNext = {
            handle: jest.fn().mockReturnValue({ pipe: jest.fn(() => ({})) }),
        };
        interceptor.intercept(mockContext, mockNext);
        expect(mockNext.handle).toHaveBeenCalled();
    });
});
//# sourceMappingURL=tenant-context.interceptor.spec.js.map