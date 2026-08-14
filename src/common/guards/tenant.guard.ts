import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Extract tenant ID from request (in real auth, from JWT)
    // For now, allow test-mode header
    const tenantId =
      request.headers['x-tenant-id'] || request.user?.tenantId;

    if (!tenantId) {
      return false;
    }

    request.tenantId = tenantId;
    request.userId = request.headers['x-user-id'] || request.user?.userId;

    return true;
  }
}
