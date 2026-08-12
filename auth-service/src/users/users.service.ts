
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AuthDatabaseService } from '../common/database.service';

@Injectable()
export class UsersService {
  constructor(private readonly db: AuthDatabaseService) {}

  async getAllUsers() {
    // Usa la vista vw_users_with_role de auth_db.sql (RF-033)
    const result = await this.db.authQuery(
      'SELECT * FROM vw_users_with_role ORDER BY created_at DESC',
    );
    return result.rows;
  }

  async getUserById(id: number) {
    const result = await this.db.authQuery(
      'SELECT * FROM vw_users_with_role WHERE id = $1',
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException('Usuario no encontrado');
    return result.rows[0];
  }

  async assignRole(targetUserId: number, newRoleId: number, adminId: number) {
    try {
      // Usa el SP sp_assign_role de auth_db.sql (RF-030)
      await this.db.authQuery('CALL sp_assign_role($1, $2, $3)', [
        targetUserId,
        newRoleId,
        adminId,
      ]);
      return { message: 'Rol asignado exitosamente' };
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  async toggleBlock(userId: number, blocked: boolean) {
    await this.db.authQuery(
      'UPDATE users SET is_blocked = $1, updated_at = NOW() WHERE id = $2',
      [blocked, userId],
    );
    return { message: blocked ? 'Usuario bloqueado' : 'Usuario desbloqueado' };
  }

  async getRoles() {
    const result = await this.db.authQuery('SELECT * FROM roles ORDER BY id');
    return result.rows;
  }
}
