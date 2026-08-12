// src/pages/CatalogPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { catalogApi, adminApi, authApi, Recording, School, Semester } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import Pagination from '../components/Pagination'

const ADMIN_ROLES = ['administrador', 'catedratico', 'auxiliar']

export default function CatalogPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [recordings, setRecordings] = useState<Recording[]>([])
  const [schools, setSchools]       = useState<School[]>([])
  const [semesters, setSemesters]   = useState<Semester[]>([])
  const [loading, setLoading]       = useState(true)

  // `search` es lo que se escribe; `applied` lo que realmente se consultó. Sin
  // separarlos, cada tecla dispararía una petición y reiniciaría la página.
  const [search, setSearch]   = useState('')
  const [applied, setApplied] = useState('')
  const [schoolId, setSchoolId]     = useState('')
  const [semesterId, setSemesterId] = useState('')

  const [page, setPage]   = useState(1)
  const [meta, setMeta]   = useState({ total: 0, totalPages: 0, limit: 10 })

  const canAdmin = ADMIN_ROLES.includes(user?.role || '')

  useEffect(() => {
    // Los filtros se alimentan del catálogo administrativo cuando el rol lo
    // permite; un estudiante solo necesita las escuelas públicas.
    catalogApi.getSchools().then(r => setSchools(r.data)).catch(() => {})
    if (canAdmin) adminApi.listSemesters().then(r => setSemesters(r.data)).catch(() => {})
  }, [canAdmin])

  // Toda la paginación y el filtrado los resuelve el backend: acá solo se
  // reenvían los parámetros y se pinta lo que devuelve.
  useEffect(() => {
    setLoading(true)
    const params: Record<string, string> = { page: String(page) }
    if (applied)    params.search      = applied
    if (schoolId)   params.school_id   = schoolId
    if (semesterId) params.semester_id = semesterId

    catalogApi.getAll(params)
      .then(({ data }) => {
        setRecordings(data.data || [])
        setMeta({ total: data.total, totalPages: data.total_pages, limit: data.limit })
      })
      .catch(() => setRecordings([]))
      .finally(() => setLoading(false))
  }, [page, applied, schoolId, semesterId])

  // Cambiar un filtro debe devolver a la página 1: si estabas en la 3 y el nuevo
  // filtro solo tiene 1 página, quedarías viendo un resultado vacío.
  const applyFilter = (setter: (v: string) => void) => (value: string) => {
    setter(value)
    setPage(1)
  }

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setApplied(search)
    setPage(1)
  }

  const clearAll = () => {
    setSearch(''); setApplied(''); setSchoolId(''); setSemesterId(''); setPage(1)
  }

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* la sesión local se limpia igual */ }
    logout()
    navigate('/login')
  }

  const duration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m} min`
  }

  const hasFilters = applied || schoolId || semesterId

  return (
    <div className="public-shell">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="sidebar-logo">Yo</span>
          <span>YoUSAC</span>
        </div>
        <div className="navbar-actions">
          {canAdmin && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin')}>
              Panel admin
            </button>
          )}
          <span className="badge badge-info">{user?.role}</span>
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Salir</button>
        </div>
      </nav>

      <div className="page-wrap">
        <div>
          <h1>Catálogo de clases</h1>
          <p className="subtitle">Grabaciones disponibles según tus cursos y permisos</p>
        </div>

        <form className="toolbar" onSubmit={submitSearch}>
          <input
            className="grow"
            placeholder="Buscar por título o descripción…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <select value={schoolId} onChange={e => applyFilter(setSchoolId)(e.target.value)}>
            <option value="">Todas las escuelas</option>
            {schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {semesters.length > 0 && (
            <select value={semesterId} onChange={e => applyFilter(setSemesterId)(e.target.value)}>
              <option value="">Todos los semestres</option>
              {semesters.map(s => <option key={s.id} value={s.id}>{s.name} {s.year}</option>)}
            </select>
          )}
          <button type="submit" className="btn btn-primary">Buscar</button>
          {hasFilters && <button type="button" className="btn btn-ghost" onClick={clearAll}>Limpiar</button>}
        </form>

        {loading ? (
          <div className="loading-block"><span className="spinner" /> Cargando catálogo…</div>
        ) : recordings.length === 0 ? (
          <div className="table-wrap">
            <div className="empty-state">
              <span className="empty-icon">🎬</span>
              {hasFilters
                ? 'Ninguna clase coincide con los filtros aplicados'
                : 'Todavía no hay clases disponibles para tu usuario'}
            </div>
          </div>
        ) : (
          <>
            <div className="card-grid">
              {recordings.map(r => (
                <article key={r.recording_id} className="video-card"
                  onClick={() => navigate(`/player/${r.recording_id}`)}>
                  <div className="video-thumb">
                    {r.thumbnail_url
                      ? <img src={r.thumbnail_url} alt={r.title} loading="lazy"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                      : '🎬'}
                    <span className="video-duration">{duration(r.duration_seconds)}</span>
                  </div>
                  <div className="video-body">
                    <h3 className="video-title">{r.title}</h3>
                    <span className="video-meta">{r.course_name}</span>
                    <span className="video-meta">
                      {r.school_name} · {r.semester} {r.year}
                    </span>
                    {r.tags?.length > 0 && (
                      <div className="tag-row">
                        {r.tags.slice(0, 3).map(t => <span key={t} className="tag">{t}</span>)}
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>

            {/* El máximo de 10 por página lo impone el backend, no este componente. */}
            <div className="table-wrap">
              <Pagination
                page={page}
                totalPages={meta.totalPages}
                total={meta.total}
                limit={meta.limit}
                onChange={setPage}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
