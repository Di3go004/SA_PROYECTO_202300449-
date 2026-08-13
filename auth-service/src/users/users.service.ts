
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

  // Los "Docentes" que administra el panel de la Práctica 3. Viven en esta base
  // (yousac_auth_db) mientras que las asignaciones a curso viven en la del
  // catálogo, que solo guarda teacher_id como referencia lógica: por eso el
  // panel necesita este listado para poder resolver nombre y correo.
  // Resuelve correo → id para la carga masiva de catalog-service. Solo devuelve
  // usuarios que YA son catedrático o auxiliar: un CSV no puede crear cuentas ni
  // convertir a un estudiante en docente por el hecho de nombrarlo.
  async resolveTeachersByEmail(emails: string[]) {
    if (!emails?.length) return [];

    const normalized = emails
      .map((e) => String(e || '').trim().toLowerCase())
      .filter((e) => e !== '');
    if (!normalized.length) return [];

    const result = await this.db.authQuery(
      `SELECT id, email, full_name, role_name, is_blocked
         FROM vw_users_with_role
        WHERE lower(email) = ANY($1::TEXT[])
          AND role_name IN ('catedratico', 'auxiliar')`,
      [normalized],
    );
    return result.rows;
  }

  async listTeachers() {
    const result = await this.db.authQuery(
      `SELECT id, email, full_name, role_name, is_active, is_blocked
         FROM vw_users_with_role
        WHERE role_name IN ('catedratico', 'auxiliar')
        ORDER BY full_name`,
    );
    return result.rows;
  }
}
