// src/import/import.service.ts
// Ingesta masiva de grabaciones desde CSV.
//
// Estrategia transaccional: todo el lote corre en UNA transacción, pero cada
// fila se protege con su propio SAVEPOINT. Es la parte menos obvia del módulo y
// la razón es concreta: los SPs reportan los errores de negocio con RAISE
// EXCEPTION, y en PostgreSQL una excepción deja la transacción entera abortada
// ("current transaction is aborted, commands ignored until end of transaction
// block"). Sin SAVEPOINT, la primera fila inválida invalidaría todas las
// siguientes. Con SAVEPOINT se revierte solo esa fila, se registra el error y el
// lote continúa; al final un único COMMIT publica todo lo que sí entró.
import { Injectable, BadRequestException } from '@nestjs/common';
import { PoolClient } from 'pg';
import { CatalogDatabaseService } from '../common/database.service';
import { AuthGrpcClient } from '../common/auth-grpc.client';
import { parseCsv, validateHeaders, CsvRow } from './csv-parser';

interface RowError {
  row: number;
  column?: string;
  message: string;
}

export interface ImportSummary {
  batch_id: number;
  filename: string;
  total_rows: number;
  inserted: number;
  skipped: number;
  failed: number;
  status: string;
  errors: RowError[];
}

@Injectable()
export class ImportService {
  constructor(
    private readonly db: CatalogDatabaseService,
    private readonly authClient: AuthGrpcClient,
  ) {}

  async importRecordings(
    filename: string,
    csvContent: string,
    uploadedBy: number,
    userToken: string,
  ): Promise<ImportSummary> {
    if (!csvContent || csvContent.trim() === '') {
      throw new BadRequestException('El archivo CSV está vacío');
    }

    // Errores de formato del archivo (vacío, sin columnas obligatorias) son del
    // archivo entero, no de una fila: se rechazan antes de abrir ningún lote.
    let parsed;
    try {
      parsed = parseCsv(csvContent);
      validateHeaders(parsed.headers);
    } catch (error: any) {
      throw new BadRequestException(error.message);
    }

    if (parsed.rows.length === 0) {
      throw new BadRequestException('El archivo CSV no contiene filas de datos');
    }

    // Una sola llamada gRPC para todo el archivo, no una por fila.
    const teachersByEmail = await this.resolveTeachers(parsed.rows, userToken);

    return this.db.withTransaction(async (client) => {
      const batchId = await this.startBatch(client, filename, uploadedBy);

      let inserted = 0;
      let skipped = 0;
      const errors: RowError[] = [];

      for (const row of parsed.rows) {
        const outcome = await this.importRow(client, row, teachersByEmail);

        if (outcome.status === 'INSERTADO') inserted++;
        else if (outcome.status === 'OMITIDO') skipped++;
        else {
          errors.push({ row: row.lineNumber, column: outcome.column, message: outcome.message });
          await client.query('CALL sp_log_import_error($1, $2, $3, $4, $5)', [
            batchId, row.lineNumber, outcome.message, outcome.column || null, row.raw || null,
          ]);
        }
      }

      await client.query('CALL sp_finish_import_batch($1, $2, $3, $4)', [
        batchId, parsed.rows.length, inserted, skipped,
      ]);

      const batch = await client.query(
        'SELECT status FROM csv_import_batches WHERE id = $1',
        [batchId],
      );

      return {
        batch_id: batchId,
        filename,
        total_rows: parsed.rows.length,
        inserted,
        skipped,
        failed: errors.length,
        status: batch.rows[0]?.status,
        errors,
      };
    });
  }

  // ── Internos ─────────────────────────────────────────────────────────────

  private async resolveTeachers(rows: CsvRow[], userToken: string) {
    const emails = [
      ...new Set(
        rows
          .map((row) => (row.values['teacher_email'] || '').trim().toLowerCase())
          .filter((email) => email !== ''),
      ),
    ];

    const teachers = await this.authClient.resolveTeachersByEmail(emails, userToken);
    return new Map(teachers.map((t) => [t.email.toLowerCase(), t]));
  }

  private async startBatch(client: PoolClient, filename: string, uploadedBy: number) {
    const result = await client.query('CALL sp_start_import_batch($1, $2, NULL)', [
      filename,
      uploadedBy,
    ]);
    return result.rows[0].p_batch_id as number;
  }

  private async importRow(
    client: PoolClient,
    row: CsvRow,
    teachersByEmail: Map<string, any>,
  ): Promise<{ status: string; message?: string; column?: string }> {
    const value = (column: string) => row.values[column] ?? '';

    // El docente se resuelve antes de tocar la base: si el correo no pertenece a
    // un catedrático/auxiliar existente, la fila se descarta con un mensaje que
    // dice exactamente qué correo falló. Un CSV nunca crea usuarios.
    const email = value('teacher_email').toLowerCase();
    const teacher = teachersByEmail.get(email);

    if (!teacher) {
      return {
        status: 'ERROR',
        column: 'teacher_email',
        message: `El correo "${value('teacher_email')}" no corresponde a un catedrático o auxiliar registrado`,
      };
    }

    if (teacher.is_blocked) {
      return {
        status: 'ERROR',
        column: 'teacher_email',
        message: `El docente "${value('teacher_email')}" está bloqueado`,
      };
    }

    const year = parseInt(value('year'), 10);
    if (Number.isNaN(year)) {
      return { status: 'ERROR', column: 'year', message: `Año inválido: "${value('year')}"` };
    }

    const duration = parseInt(value('duration_seconds'), 10);

    await client.query('SAVEPOINT fila_actual');
    try {
      const result = await client.query(
        `CALL sp_import_recording_row(
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, NULL, NULL
         )`,
        [
          value('school_code'),
          value('school_name') || null,
          value('course_code'),
          value('course_name') || null,
          value('semester_name'),
          year,
          teacher.id,
          value('title'),
          value('description') || null,
          Number.isNaN(duration) ? 0 : duration,
          value('video_url'),
          value('thumbnail_url') || null,
          value('tags') || null,
          this.parseBoolean(value('is_published')),
        ],
      );

      await client.query('RELEASE SAVEPOINT fila_actual');
      return { status: result.rows[0]?.p_status || 'INSERTADO' };
    } catch (error: any) {
      // Se revierte solo esta fila; la transacción del lote sigue viva.
      await client.query('ROLLBACK TO SAVEPOINT fila_actual');
      return { status: 'ERROR', message: this.cleanDbMessage(error.message) };
    }
  }

  /** 'true'/'1'/'si'/'sí' ⇒ true. Vacío ⇒ true (publicada por defecto). */
  private parseBoolean(raw: string): boolean {
    const value = raw.trim().toLowerCase();
    if (value === '') return true;
    return ['true', '1', 'si', 'sí', 'yes', 'y', 't'].includes(value);
  }

  /** Quita el ruido de PL/pgSQL para que el mensaje sea legible en el panel. */
  private cleanDbMessage(message: string): string {
    return String(message || 'Error desconocido')
      .replace(/^error:\s*/i, '')
      .split('\n')[0]
      .trim();
  }

  // ── Consulta de lotes (evidencia en el panel) ────────────────────────────

  async listBatches() {
    const result = await this.db.query(
      `SELECT id, filename, uploaded_by, total_rows, inserted_rows, skipped_rows,
              failed_rows, status, started_at, finished_at
         FROM csv_import_batches
        ORDER BY started_at DESC
        LIMIT 50`,
    );
    return result.rows;
  }

  async getBatch(id: number) {
    const batch = await this.db.query('SELECT * FROM csv_import_batches WHERE id = $1', [id]);
    if (!batch.rows[0]) throw new BadRequestException(`El lote ${id} no existe`);

    const errors = await this.db.query(
      `SELECT row_number, column_name, raw_line, error_message
         FROM csv_import_errors WHERE batch_id = $1 ORDER BY row_number`,
      [id],
    );

    return { ...batch.rows[0], errors: errors.rows };
  }
}
