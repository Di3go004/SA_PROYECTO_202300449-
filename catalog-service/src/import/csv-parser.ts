// src/import/csv-parser.ts
// Parser CSV según RFC 4180, sin dependencias externas.
//
// No alcanza con content.split(',') porque los campos entre comillas pueden
// contener comas, saltos de línea y comillas escapadas (""), y las descripciones
// de las grabaciones las traen. El autómata de abajo recorre el texto carácter a
// carácter llevando un único estado (dentro/fuera de comillas).

export interface CsvRow {
  /** Número de línea real en el archivo (1 = encabezado), para reportar errores. */
  lineNumber: number;
  /** Campos mapeados por nombre de columna. */
  values: Record<string, string>;
  /** Línea original, para adjuntarla al registro de errores. */
  raw: string;
}

export interface ParsedCsv {
  headers: string[];
  rows: CsvRow[];
}

/** Divide el texto en filas de campos, respetando comillas y saltos embebidos. */
export function splitCsv(content: string): string[][] {
  // Excel guarda los .csv con BOM; si no se quita, el primer encabezado queda
  // como "﻿school_code" y ninguna columna hace match.
  const text = content.charCodeAt(0) === 0xfeff ? content.slice(1) : content;

  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let fieldWasQuoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    switch (char) {
      case '"':
        inQuotes = true;
        fieldWasQuoted = true;
        break;
      case ',':
        row.push(field);
        field = '';
        fieldWasQuoted = false;
        break;
      case '\r':
        break; // los CRLF de Windows se ignoran; el corte lo marca el \n
      case '\n':
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        fieldWasQuoted = false;
        break;
      default:
        field += char;
    }
  }

  // Última fila sin salto de línea final.
  if (field !== '' || fieldWasQuoted || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Se descartan las filas totalmente vacías (líneas en blanco del final).
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/**
 * Parsea el archivo y mapea cada fila contra los encabezados.
 *
 * Los encabezados se normalizan a minúsculas y sin espacios, así que da igual si
 * el archivo trae "Video_URL" o "video_url".
 */
export function parseCsv(content: string): ParsedCsv {
  const matrix = splitCsv(content);
  if (matrix.length === 0) {
    throw new Error('El archivo CSV está vacío');
  }

  const headers = matrix[0].map((h) => h.trim().toLowerCase());
  const lines = content.split('\n');

  const rows: CsvRow[] = matrix.slice(1).map((cells, index) => {
    const values: Record<string, string> = {};
    headers.forEach((header, position) => {
      values[header] = (cells[position] ?? '').trim();
    });

    // +2 porque el índice arranca en 0 y la línea 1 es el encabezado. Es
    // aproximado si algún campo contiene saltos de línea, pero sirve para que la
    // persona ubique la fila en el archivo.
    const lineNumber = index + 2;
    return { lineNumber, values, raw: (lines[lineNumber - 1] ?? '').trim() };
  });

  return { headers, rows };
}

/** Columnas mínimas que debe traer el archivo para poder importarse. */
export const REQUIRED_COLUMNS = [
  'school_code',
  'course_code',
  'semester_name',
  'year',
  'teacher_email',
  'title',
  'video_url',
];

export function validateHeaders(headers: string[]): void {
  const missing = REQUIRED_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    throw new Error(
      `Al archivo le faltan las columnas obligatorias: ${missing.join(', ')}`,
    );
  }
}
