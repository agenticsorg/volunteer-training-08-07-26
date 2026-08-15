import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'] as string;

    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    // TODO: In production, validate against a database of API keys
    // For now, accept any non-empty API key for testing
    // Extract tenant_id from API key or header
    const tenantId = request.headers['x-tenant-id'] as string;
    if (!tenantId) {
      throw new UnauthorizedException('Missing tenant ID');
    }

    (request as any).tenantId = tenantId;
    (request as any).user = { tenantId };

    return true;
  }
}
