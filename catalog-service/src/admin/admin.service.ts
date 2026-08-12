// src/admin/admin.service.ts
// Gestión de las entidades académicas del panel administrativo.
//
// Regla del módulo: TODA escritura pasa por un procedimiento almacenado de
// DB/practica3_sps.sql. Acá no hay un solo INSERT/UPDATE/DELETE suelto — las
// validaciones de unicidad, integridad referencial y bloqueo de borrados con
// dependientes viven en la base, no duplicadas en TypeScript.
import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { CatalogDatabaseService } from '../common/database.service';

@Injectable()
export class AdminService {
  constructor(private readonly db: CatalogDatabaseService) {}

  // Los SPs comunican los errores de negocio con RAISE EXCEPTION. Se traducen a
  // BadRequest (→ INVALID_ARGUMENT en gRPC) para que el mensaje del SP llegue
  // literal al usuario en vez de convertirse en un 500 opaco.
  private async callSp(sql: string, params: any[]) {
    try {
      return await this.db.query(sql, params);
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  // ── Semestres ────────────────────────────────────────────────────────────

  async listSemesters() {
    const result = await this.db.query(
      'SELECT * FROM vw_semesters_admin ORDER BY year DESC, name',
    );
    return result.rows;
  }

  async createSemester(name: string, year: number, code: string, isActive: boolean) {
    const result = await this.callSp(
      'CALL sp_create_semester($1, $2, $3, $4, NULL)',
      [name, year, code || null, isActive],
    );
    return { id: result.rows[0]?.p_id, message: 'Semestre creado exitosamente' };
  }

  async updateSemester(
    id: number, name: string, year: number, code: string, isActive: boolean,
  ) {
    await this.callSp(
      'CALL sp_update_semester($1, $2, $3, $4, $5)',
      [id, name, year, code || null, isActive],
    );
    return { message: 'Semestre actualizado exitosamente' };
  }

  async deleteSemester(id: number) {
    await this.callSp('CALL sp_delete_semester($1)', [id]);
    return { message: 'Semestre eliminado exitosamente' };
  }

  // ── Escuelas / Áreas ─────────────────────────────────────────────────────

  async listSchools() {
    const result = await this.db.query('SELECT * FROM vw_schools_admin ORDER BY name');
    return result.rows;
  }

  async createSchool(name: string, code: string) {
    const result = await this.callSp('CALL sp_create_school($1, $2, NULL)', [name, code]);
    return { id: result.rows[0]?.p_id, message: 'Escuela creada exitosamente' };
  }

  async updateSchool(id: number, name: string, code: string) {
    await this.callSp('CALL sp_update_school($1, $2, $3)', [id, name, code]);
    return { message: 'Escuela actualizada exitosamente' };
  }

  async deleteSchool(id: number) {
    await this.callSp('CALL sp_delete_school($1)', [id]);
    return { message: 'Escuela eliminada exitosamente' };
  }

  // ── Cursos ───────────────────────────────────────────────────────────────

  // Usa vw_courses_admin (LEFT JOIN) y no vw_courses_with_teachers: un curso
  // recién creado todavía no tiene docente y debe seguir apareciendo acá.
  async listCourses(schoolId?: number, semesterId?: number) {
    const result = await this.db.query(
      `SELECT * FROM vw_courses_admin
        WHERE ($1::INT IS NULL OR school_id   = $1)
          AND ($2::INT IS NULL OR semester_id = $2)
        ORDER BY year DESC, semester, course_name`,
      [schoolId || null, semesterId || null],
    );
    return result.rows;
  }

  async createCourse(name: string, code: string, schoolId: number, semesterId: number) {
    const result = await this.callSp(
      'CALL sp_create_course($1, $2, $3, $4, NULL)',
      [name, code, schoolId, semesterId],
    );
    return { id: result.rows[0]?.p_id, message: 'Curso creado exitosamente' };
  }

  async updateCourse(
    id: number, name: string, code: string, schoolId: number, semesterId: number,
  ) {
    await this.callSp(
      'CALL sp_update_course($1, $2, $3, $4, $5)',
      [id, name, code, schoolId, semesterId],
    );
    return { message: 'Curso actualizado exitosamente' };
  }

  async deleteCourse(id: number) {
    await this.callSp('CALL sp_delete_course($1)', [id]);
    return { message: 'Curso eliminado exitosamente' };
  }

  // ── Asignaciones docente ↔ curso ─────────────────────────────────────────

  async listCourseTeachers(courseId: number) {
    const course = await this.db.query('SELECT id FROM courses WHERE id = $1', [courseId]);
    if (!course.rows[0]) throw new NotFoundException('Curso no encontrado');

    const result = await this.db.query(
      'SELECT teacher_id, created_at FROM course_teachers WHERE course_id = $1 ORDER BY created_at',
      [courseId],
    );
    return result.rows;
  }

  // Se usa el SP estricto (no sp_ensure_teacher_assignment): desde el panel,
  // reasignar un docente que ya está en el curso es un error del usuario y debe
  // avisarse. La variante idempotente queda reservada a la carga masiva.
  async assignTeacher(teacherId: number, courseId: number) {
    await this.callSp('CALL sp_assign_teacher_to_course($1, $2)', [teacherId, courseId]);
    return { message: 'Docente asignado exitosamente' };
  }

  async unassignTeacher(teacherId: number, courseId: number) {
    await this.callSp('CALL sp_unassign_teacher_from_course($1, $2)', [teacherId, courseId]);
    return { message: 'Docente desasignado exitosamente' };
  }
}
