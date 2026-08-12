// src/enrollments/enrollments.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { CatalogDatabaseService } from '../common/database.service';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly db: CatalogDatabaseService) {}

  async enrollStudent(studentId: number, courseId: number, adminId: number) {
    try {
      await this.db.query('CALL sp_enroll_student($1, $2, $3)', [
        studentId, courseId, adminId,
      ]);
      return { message: 'Estudiante inscrito exitosamente' };
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }
  }

  async unenrollStudent(studentId: number, courseId: number) {
    await this.db.query('CALL sp_unenroll_student($1, $2)', [studentId, courseId]);
    return { message: 'Inscripción eliminada exitosamente' };
  }

  async getStudentCourses(studentId: number) {
    const result = await this.db.query(
      'SELECT * FROM fn_get_student_courses($1)',
      [studentId],
    );
    return result.rows;
  }
}
