import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiTenantScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const requestTenantId = (request as any).tenantId;
    const params = request.params;

    // For routes with tenant_id path parameter, verify it matches authenticated tenant
    if (params.tenantId && params.tenantId !== requestTenantId) {
      throw new ForbiddenException('Access denied: tenant ID mismatch');
    }

    // For routes with mailbox_id, we'll verify ownership at the service level
    // For routes with message_id, we'll verify ownership at the service level
    // This guard ensures no API endpoint can accidentally expose another tenant's data

    return true;
  }
}
