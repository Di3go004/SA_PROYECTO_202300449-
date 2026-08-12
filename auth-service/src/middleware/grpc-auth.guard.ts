// src/middleware/grpc-auth.guard.ts
// Principio S: solo valida JWT, no hace nada más — equivalente a jwt.guard.ts (HTTP)
// pero leyendo la metadata gRPC en vez de un header Authorization/cookie.
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Metadata } from '@grpc/grpc-js';

@Injectable()
export class GrpcAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const rpc = context.switchToRpc();
    const data: any = rpc.getData();
    const metadata: Metadata = rpc.getContext();

    const authHeader = metadata?.get('authorization')?.[0] as string | undefined;
    const token = authHeader?.split(' ')[1];

    if (!token) throw new UnauthorizedException('Token de autenticación requerido');

    try {
      // gRPC no tiene un "request" HTTP donde colgar request.user: se anota
      // directamente sobre el objeto data (mismo objeto que recibe el handler).
      data.__user = this.jwtService.verify(token);
      return true;
    } catch {
      throw new UnauthorizedException('Token inválido o expirado');
    }
  }
}
