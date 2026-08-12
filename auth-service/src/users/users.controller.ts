import { Controller, UseGuards, UseFilters, ForbiddenException } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { UsersService } from './users.service';
import { GrpcAuthGuard } from '../middleware/grpc-auth.guard';
import { GrpcRolesGuard } from '../middleware/grpc-roles.guard';
import { Roles } from '../middleware/roles.decorator';
import { GrpcExceptionFilter } from '../middleware/grpc-exception.filter';

@Controller()
@UseGuards(GrpcAuthGuard, GrpcRolesGuard)
@UseFilters(GrpcExceptionFilter)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Admin: ver todos los usuarios
  @GrpcMethod('AuthService', 'GetAllUsers')
  @Roles('administrador')
  async getAllUsers() {
    const users = await this.usersService.getAllUsers();
    return { json: JSON.stringify(users) };
  }

  // Une los dos casos que existían por REST (GET /users/:id solo-admin y
  // GET /users/me/profile cualquier usuario autenticado) en una sola RPC:
  // el propio usuario puede ver su perfil, un admin puede ver cualquiera.
  @GrpcMethod('AuthService', 'GetUserById')
  async getUserById(data: { id: number; __user?: any }) {
    const requester = data.__user;
    if (requester?.role !== 'administrador' && requester?.sub !== data.id) {
      throw new ForbiddenException('No tenés permisos para ver este perfil');
    }
    const user = await this.usersService.getUserById(data.id);
    return { json: JSON.stringify(user) };
  }

  // Admin: asignar rol a un usuario
  @GrpcMethod('AuthService', 'AssignRole')
  @Roles('administrador')
  async assignRole(data: { user_id: number; role_id: number; admin_id: number }) {
    return this.usersService.assignRole(data.user_id, data.role_id, data.admin_id);
  }

  // Admin: bloquear/desbloquear usuario
  @GrpcMethod('AuthService', 'ToggleBlock')
  @Roles('administrador')
  async toggleBlock(data: { user_id: number; blocked: boolean }) {
    return this.usersService.toggleBlock(data.user_id, data.blocked);
  }
}
