import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ApiTenantScopeGuard } from '../guards/api-tenant-scope.guard';

describe('API Tenant Scoping - Defense in Depth', () => {
  describe('ApiKeyGuard', () => {
    let guard: ApiKeyGuard;

    beforeEach(() => {
      guard = new ApiKeyGuard();
    });

    it('should throw UnauthorizedException if no API key provided', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {},
          }),
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if no tenant ID provided', () => {
      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => ({
            headers: {
              'x-api-key': 'test-key',
            },
          }),
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(mockContext)).toThrow(UnauthorizedException);
    });

    it('should set tenantId on request when both headers provided', () => {
      const mockRequest = {
        headers: {
          'x-api-key': 'test-key',
          'x-tenant-id': 'tenant-123',
        },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
      expect((mockRequest as any).tenantId).toBe('tenant-123');
    });
  });

  describe('ApiTenantScopeGuard', () => {
    let guard: ApiTenantScopeGuard;

    beforeEach(() => {
      guard = new ApiTenantScopeGuard();
    });

    it('should throw ForbiddenException if path tenantId does not match authenticated tenantId', () => {
      const mockRequest = {
        params: { tenantId: 'other-tenant' },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      (mockRequest as any).tenantId = 'my-tenant';

      expect(() => guard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should allow access if path tenantId matches authenticated tenantId', () => {
      const mockRequest = {
        params: { tenantId: 'my-tenant' },
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      (mockRequest as any).tenantId = 'my-tenant';

      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });

    it('should allow access if no tenantId in path params', () => {
      const mockRequest = {
        params: {},
      };

      const mockContext = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      (mockRequest as any).tenantId = 'my-tenant';

      const result = guard.canActivate(mockContext);
      expect(result).toBe(true);
    });
  });

  describe('Defense-in-depth tenant isolation verification', () => {
    it('should demonstrate that API-layer guard prevents cross-tenant access', () => {
      // This test verifies the API layer guard works as a defense-in-depth
      // complementary to database RLS
      const guard = new ApiTenantScopeGuard();

      // Tenant A tries to access Tenant B's resource
      const tenantARequest = {
        params: { tenantId: 'tenant-b-id' }, // Trying to access another tenant
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => tenantARequest,
        }),
      } as ExecutionContext;

      (tenantARequest as any).tenantId = 'tenant-a-id'; // But authenticated as tenant A

      // Should be denied at API layer
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('should confirm API key guard requires authentication', () => {
      const guard = new ApiKeyGuard();

      const noHeadersRequest = { headers: {} };
      const context = {
        switchToHttp: () => ({
          getRequest: () => noHeadersRequest,
        }),
      } as ExecutionContext;

      // Should require both API key AND tenant ID
      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should prevent header override attacks', () => {
      // Even if a client tries to add another x-tenant-id header,
      // the guard uses the authenticated tenant from earlier auth layer
      const guard = new ApiTenantScopeGuard();

      const requestWithOverride = {
        params: { tenantId: 'tenant-b-id' },
        headers: {
          'x-override-tenant': 'tenant-a-id', // Client tries to override
        },
      };

      const context = {
        switchToHttp: () => ({
          getRequest: () => requestWithOverride,
        }),
      } as ExecutionContext;

      (requestWithOverride as any).tenantId = 'tenant-a-id'; // Real auth result

      // Client still cannot access tenant-b even with the header override
      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
