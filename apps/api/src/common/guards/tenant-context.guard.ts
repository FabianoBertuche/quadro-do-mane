import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { RequestUser } from '../interfaces/request-context.interface';

@Injectable()
export class TenantContextGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user as RequestUser;

    if (!user?.tenantId) {
      throw new ForbiddenException('Contexto de tenant não definido. Selecione um tenant.');
    }

    return true;
  }
}
