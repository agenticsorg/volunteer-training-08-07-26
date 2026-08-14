import { NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
export declare class TenantContextInterceptor implements NestInterceptor {
    private skipPaths;
    intercept(context: ExecutionContext, next: CallHandler): Observable<any>;
}
//# sourceMappingURL=tenant-context.interceptor.d.ts.map