// src/services/api.ts
import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
})

// Interceptor: agregar JWT a cada request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Interceptor: redirigir al login si el token expiró
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.clear()
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

// ── Auth ─────────────────────────────────────────────────────
export const authApi = {
  login:    (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }),
  register: (email: string, password: string, full_name: string) =>
    api.post('/api/auth/register', { email, password, full_name }),
  logout:   () => api.post('/api/auth/logout'),
}

// ── Catalog ──────────────────────────────────────────────────

export interface Recording {
  recording_id: number
  title: string
  description: string
  course_id: number
  course_name: string
  course_code: string
  school_id: number
  school_name: string
  semester: string
  semester_id: number
  year: number
  teacher_id: number
  duration_seconds: number
  thumbnail_url: string | null
  video_url: string
  recommendation_pct: number
  tags: string[]
}

/** Respuesta paginada del backend: el total y el número de páginas los calcula él. */
export interface Paginated<T> {
  data: T[]
  page: number
  limit: number
  total: number
  total_pages: number
}

export const catalogApi = {
  getAll: (params?: Record<string, string>) =>
    api.get<Paginated<Recording>>('/api/catalog', { params }),
  getById: (id: number) =>
    api.get(`/api/catalog/${id}`),
  getSchools: () =>
    api.get('/api/catalog/schools'),
  getCourses: (schoolId?: string) =>
    api.get('/api/catalog/courses', { params: schoolId ? { school_id: schoolId } : {} }),
}

// ── Panel administrativo (Práctica 3) ────────────────────────
// Reservado a administrador / catedrático / auxiliar: el gateway responde 403
// a cualquier otro rol y los microservicios lo vuelven a verificar por gRPC.

export interface Semester {
  id: number; name: string; year: number; code: string
  is_active: boolean; total_courses: string
}
export interface School {
  id: number; name: string; code: string; total_courses: string
}
export interface Course {
  course_id: number; course_name: string; course_code: string
  school_id: number; school_name: string; school_code: string
  semester_id: number; semester: string; year: number
  teacher_ids: number[]; total_teachers: string
}
export interface Teacher {
  id: number; email: string; full_name: string
  role_name: string; is_active: boolean; is_blocked: boolean
}
export interface ImportBatch {
  id: number; filename: string; uploaded_by: number
  total_rows: number; inserted_rows: number; skipped_rows: number; failed_rows: number
  status: string; started_at: string; finished_at: string | null
}
export interface ImportSummary {
  batch_id: number; filename: string; total_rows: number
  inserted: number; skipped: number; failed: number; status: string
  errors: { row: number; column?: string; message: string }[]
}

export const adminApi = {
  // Semestres
  listSemesters:  () => api.get<Semester[]>('/api/admin/semesters'),
  createSemester: (body: Partial<Semester>) => api.post('/api/admin/semesters', body),
  updateSemester: (id: number, body: Partial<Semester>) => api.put(`/api/admin/semesters/${id}`, body),
  deleteSemester: (id: number) => api.delete(`/api/admin/semesters/${id}`),

  // Escuelas / Áreas
  listSchools:  () => api.get<School[]>('/api/admin/schools'),
  createSchool: (body: Partial<School>) => api.post('/api/admin/schools', body),
  updateSchool: (id: number, body: Partial<School>) => api.put(`/api/admin/schools/${id}`, body),
  deleteSchool: (id: number) => api.delete(`/api/admin/schools/${id}`),

  // Cursos
  listCourses: (params?: { school_id?: number; semester_id?: number }) =>
    api.get<Course[]>('/api/admin/courses', { params }),
  createCourse: (body: any) => api.post('/api/admin/courses', body),
  updateCourse: (id: number, body: any) => api.put(`/api/admin/courses/${id}`, body),
  deleteCourse: (id: number) => api.delete(`/api/admin/courses/${id}`),

  // Docentes y asignaciones
  listTeachers:       () => api.get<Teacher[]>('/api/admin/teachers'),
  listRoles:          () => api.get('/api/admin/roles'),
  listCourseTeachers: (courseId: number) => api.get(`/api/admin/courses/${courseId}/teachers`),
  assignTeacher:      (courseId: number, teacherId: number) =>
    api.post(`/api/admin/courses/${courseId}/teachers`, { teacher_id: teacherId }),
  unassignTeacher:    (courseId: number, teacherId: number) =>
    api.delete(`/api/admin/courses/${courseId}/teachers/${teacherId}`),
}

export const importApi = {
  // multipart/form-data: axios pone el boundary solo si NO se fija el header.
  upload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post<ImportSummary>('/api/admin/import/csv', form)
  },
  listBatches: () => api.get<ImportBatch[]>('/api/admin/import/batches'),
  getBatch:    (id: number) => api.get(`/api/admin/import/batches/${id}`),
}

// ── Usuarios ─────────────────────────────────────────────────
export const usersApi = {
  getAll:     () => api.get('/api/users'),
  assignRole: (id: number, roleId: number) => api.put(`/api/users/${id}/role`, { role_id: roleId }),
  toggleBlock:(id: number, blocked: boolean) => api.put(`/api/users/${id}/block`, { blocked }),
}

// ── Checkpoints ──────────────────────────────────────────────
export const checkpointApi = {
  save: (user_id: number, video_id: number, position_seconds: number, total_seconds: number) =>
    api.post('/api/checkpoints', { user_id, video_id, position_seconds, total_seconds }),
  get: (video_id: number, user_id: number) =>
    api.get(`/api/checkpoints/${video_id}`, { params: { user_id } }),
}

// ── Ratings ──────────────────────────────────────────────────
export const ratingsApi = {
  save: (user_id: number, video_id: number, stars: number, comment?: string) =>
    api.post('/api/ratings', { user_id, video_id, stars, comment }),
  getStats: (video_id: number) =>
    api.get(`/api/ratings/${video_id}/stats`),
}

export default api
