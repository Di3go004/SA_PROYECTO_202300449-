// src/catalog/catalog.service.ts
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CatalogDatabaseService } from '../common/database.service';

@Injectable()
export class CatalogService {
  constructor(private readonly db: CatalogDatabaseService) {}

  async getCatalog(user: any, filters: any, pagination: { page: number; limit: number }) {
    const offset = (pagination.page - 1) * pagination.limit;
    let query: string;
    let params: any[];

    if (user.role === 'estudiante') {
      query = `
        SELECT * FROM vw_student_catalog
        WHERE student_id = $1
        ${filters.semester ? 'AND semester = $2' : ''}
        ${filters.search   ? 'AND (title ILIKE $3 OR description ILIKE $3)' : ''}
        ORDER BY created_at DESC
        LIMIT $${this.paramCount(filters) + 2} OFFSET $${this.paramCount(filters) + 3}
      `;
      params = [user.sub, ...this.buildFilterParams(filters), pagination.limit, offset];
    } else {
      query = `
        SELECT * FROM vw_catalog
        WHERE 1=1
        ${filters.semester ? 'AND semester = $1' : ''}
        ${filters.search   ? 'AND (title ILIKE $2 OR description ILIKE $2)' : ''}
        ORDER BY created_at DESC
        LIMIT $${this.paramCount(filters) + 1} OFFSET $${this.paramCount(filters) + 2}
      `;
      params = [...this.buildFilterParams(filters), pagination.limit, offset];
    }

    const result = await this.db.query(query, params);
    return { data: result.rows, page: pagination.page, limit: pagination.limit };
  }

  async getRecordingById(id: number, user: any) {
    const result = await this.db.query(
      'SELECT * FROM vw_catalog WHERE recording_id = $1',
      [id],
    );
    if (!result.rows[0]) throw new NotFoundException('Grabación no encontrada');

    const recording = result.rows[0];

    if (user.role === 'estudiante') {
      const enrolled = await this.db.query(
        'SELECT fn_is_student_enrolled($1, $2) AS enrolled',
        [user.sub, recording.course_id],
      );
      if (!enrolled.rows[0]?.enrolled) {
        throw new ForbiddenException('No tienes acceso a esta grabación');
      }
    }
    return recording;
  }

  async getSchools() {
    const result = await this.db.query('SELECT * FROM schools ORDER BY name');
    return result.rows;
  }

  async getCourses(schoolId?: string) {
    const query = schoolId
      ? 'SELECT * FROM vw_courses_with_teachers WHERE school_id = $1 ORDER BY name'
      : 'SELECT * FROM vw_courses_with_teachers ORDER BY name';
    const result = await this.db.query(query, schoolId ? [schoolId] : []);
    return result.rows;
  }

  private buildFilterParams(filters: any): any[] {
    const params: any[] = [];
    if (filters.semester) params.push(filters.semester);
    if (filters.search)   params.push(`%${filters.search}%`);
    return params;
  }

  private paramCount(filters: any): number {
    let count = 0;
    if (filters.semester) count++;
    if (filters.search)   count++;
    return count;
  }
}
