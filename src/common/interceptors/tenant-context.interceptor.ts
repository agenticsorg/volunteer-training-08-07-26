import { Injectable, NestInterceptor, ExecutionContext, CallHandler, BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request } from 'express';
import { logger } from '../../observability/logger';

@Injectable()
export class TenantContextInterceptor implements NestInterceptor {
  private skipPaths = ['/health', '/metrics'];

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();

    // Skip tenant context check for public endpoints
    if (this.skipPaths.some(path => request.path.startsWith(path))) {
      return next.handle();
    }

    // Extract tenantId from request headers (in test mode) or JWT (in production)
    // For now, we'll use a header-based approach for testing
    const tenantId = request.headers['x-tenant-id'] as string ||
                     ((request as any).user as any)?.tenantId;

    if (!tenantId) {
      logger.warn({ path: request.path }, 'Missing tenantId in request');
      throw new BadRequestException('Missing tenantId');
    }

    // Store tenantId in request for later use
    (request as any).tenantId = tenantId;

    logger.debug({ tenantId, path: request.path }, 'TenantContext set');

    return next.handle();
  }
}
