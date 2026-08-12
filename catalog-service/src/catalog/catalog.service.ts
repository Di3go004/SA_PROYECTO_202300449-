// src/catalog/catalog.service.ts
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CatalogDatabaseService } from '../common/database.service';

@Injectable()
export class CatalogService {
  // Máximo de clases por página que exige la Práctica 3. La base lo vuelve a
  // recortar dentro de fn_get_catalog_paginated; acá solo se usa para calcular
  // total_pages con el mismo tamaño real que devolvió la consulta.
  static readonly MAX_PAGE_SIZE = 10;

  constructor(private readonly db: CatalogDatabaseService) {}

  // Catálogo paginado (Práctica 3). Toda la resolución ocurre en
  // fn_get_catalog_paginated: alcance por rol, los siete filtros combinables,
  // el recorte a 10 por página y el total de resultados.
  //
  // La versión anterior armaba el SQL concatenando fragmentos y numerando los
  // parámetros a mano. Además de ignorar cinco de los filtros que ya viajaban
  // por el proto, la numeración estaba desfasada: con solo "search" generaba
  // "ILIKE $2" mientras el valor entraba en $1, así que buscar sin filtrar por
  // semestre fallaba. Delegar en la función elimina esa clase de error.
  //
  // El total llega repetido en cada fila (COUNT(*) OVER()); se lee de la primera
  // y se descarta de la respuesta para no filtrar un detalle de implementación
  // al cliente.
  async getCatalog(user: any, filters: any, pagination: { page: number; limit: number }) {
    const result = await this.db.query(
      `SELECT * FROM fn_get_catalog_paginated(
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
       )`,
      [
        user.sub,
        user.role,
        filters.semesterId ?? null,
        filters.semester ?? null,
        filters.schoolId ?? null,
        filters.courseId ?? null,
        filters.teacherId ?? null,
        filters.year ?? null,
        filters.tag ?? null,
        filters.search ?? null,
        pagination.page,
        pagination.limit,
      ],
    );

    const total = result.rows.length > 0 ? Number(result.rows[0].total_count) : 0;
    const limit = Math.min(Math.max(pagination.limit || 10, 1), CatalogService.MAX_PAGE_SIZE);

    return {
      data: result.rows.map(({ total_count, ...recording }) => recording),
      page: pagination.page,
      limit,
      total,
      total_pages: Math.ceil(total / limit),
    };
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

  // vw_courses_with_teachers no expone una columna "name" (es course_name), así
  // que el ORDER BY anterior fallaba siempre; y hasta el PR de esquema de esta
  // práctica la vista tampoco tenía school_id, por lo que el filtro por escuela
  // reventaba igual. Se ordena por course_name y se filtra NULL-safe con un solo
  // texto de consulta.
  async getCourses(schoolId?: string) {
    const result = await this.db.query(
      `SELECT * FROM vw_courses_with_teachers
        WHERE ($1::INT IS NULL OR school_id = $1)
        ORDER BY course_name`,
      [schoolId ? parseInt(schoolId, 10) : null],
    );
    return result.rows;
  }

}
