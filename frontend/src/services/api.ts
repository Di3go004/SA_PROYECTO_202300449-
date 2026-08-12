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
export const catalogApi = {
  getAll: (params?: Record<string, string>) =>
    api.get('/api/catalog', { params }),
  getById: (id: number) =>
    api.get(`/api/catalog/${id}`),
  getSchools: () =>
    api.get('/api/catalog/schools'),
  getCourses: (schoolId?: string) =>
    api.get('/api/catalog/courses', { params: schoolId ? { school_id: schoolId } : {} }),
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
