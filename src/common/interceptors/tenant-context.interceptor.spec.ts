import { Test } from '@nestjs/testing';
import { ExecutionContext, BadRequestException } from '@nestjs/common';
import { TenantContextInterceptor } from './tenant-context.interceptor';

describe('TenantContextInterceptor', () => {
  let interceptor: TenantContextInterceptor;

  beforeEach(() => {
    interceptor = new TenantContextInterceptor();
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
    } as any as ExecutionContext;

    const mockNext = {
      handle: jest.fn().mockReturnValue({ pipe: jest.fn(() => ({})) }),
    };

    interceptor.intercept(mockContext, mockNext);

    expect((mockRequest as any).tenantId).toBe('tenant-123');
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
    } as any as ExecutionContext;

    const mockNext = {
      handle: jest.fn(),
    };

    expect(() => {
      interceptor.intercept(mockContext, mockNext);
    }).toThrow(BadRequestException);
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
    } as any as ExecutionContext;

    const mockNext = {
      handle: jest.fn().mockReturnValue({ pipe: jest.fn(() => ({})) }),
    };

    interceptor.intercept(mockContext, mockNext);

    expect(mockNext.handle).toHaveBeenCalled();
  });
});
