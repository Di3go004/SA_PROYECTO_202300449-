// src/middleware/grpc-roles.guard.ts
// Equivalente gRPC de roles.guard.ts — mismo criterio (@Roles metadata), pero lee
// el usuario que GrpcAuthGuard dejó anotado en data.__user en vez de request.user.
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

@Injectable()
export class GrpcRolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
    if (!requiredRoles) return true;

    const data: any = context.switchToRpc().getData();
    const user = data?.__user;
    if (!user || !requiredRoles.includes(user.role)) {
      throw new ForbiddenException('No tenés permisos para realizar esta acción');
    }
    return true;
  }
}
