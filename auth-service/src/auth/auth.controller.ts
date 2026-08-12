import { Controller, UseFilters } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { AuthService } from './auth.service';
import { GrpcExceptionFilter } from '../middleware/grpc-exception.filter';

// Register/Login/Logout son públicos: el gateway no exige JWT previo para estas RPCs.
@Controller()
@UseFilters(GrpcExceptionFilter)
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @GrpcMethod('AuthService', 'Register')
  async register(data: { email: string; password: string; full_name: string }) {
    return this.authService.register(data.email, data.password, data.full_name);
  }

  @GrpcMethod('AuthService', 'Login')
  async login(data: { email: string; password: string }) {
    // La Session Cookie HttpOnly+Secure (requisito de la práctica) la setea el
    // api-gateway, único componente que le habla HTTP al navegador. Este RPC
    // solo genera el JWT — un microservicio gRPC no tiene noción de cookies.
    return this.authService.login(data.email, data.password);
  }

  @GrpcMethod('AuthService', 'Logout')
  async logout(data: { token: string }) {
    if (data.token) await this.authService.logout(data.token);
    return { message: 'Sesión cerrada exitosamente' };
  }
}
