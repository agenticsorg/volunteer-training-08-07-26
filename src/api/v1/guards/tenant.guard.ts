import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

@Injectable()
export class TenantGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Extract tenant from authenticated session/API key
    // In real implementation, would validate OAuth token or API key
    const authHeader = request.headers.authorization;
    if (!authHeader) {
      throw new HttpException('Missing authorization', HttpStatus.UNAUTHORIZED);
    }

    // For demo: extract tenant-id header (in real: decode JWT or API key)
    const tenantId = request.headers['x-tenant-id'];
    if (!tenantId) {
      throw new HttpException(
        'Missing tenant context',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Attach tenant to request for downstream use
    request.tenantId = tenantId;

    // Set Postgres RLS context for database-level enforcement (second defense-in-depth)
    // In real: would call this via Prisma middleware or raw SQL
    // context.switchToHttp().setRlsContext(tenantId);

    return true;
  }
}
