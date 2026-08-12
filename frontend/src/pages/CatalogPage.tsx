// src/pages/CatalogPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { catalogApi, authApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'

interface Recording {
  recording_id: number
  title: string
  description: string
  course_name: string
  school_name: string
  teacher_id: number
  duration_seconds: number
  thumbnail_url: string
  recommendation_pct: number
  semester: string
  year: number
  tags: string[]
}

interface School {
  id: number
  name: string
}

export default function CatalogPage() {
  const navigate        = useNavigate()
  const { user, logout } = useAuth()

  const [recordings, setRecordings] = useState<Recording[]>([])
  const [schools,    setSchools]    = useState<School[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [schoolId,   setSchoolId]   = useState('')
  const [semester,   setSemester]   = useState('')
  const [page,       setPage]       = useState(1)

  const fetchCatalog = async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = { page: String(page), limit: '20' }
      if (search)   params.search   = search
      if (schoolId) params.school_id = schoolId
      if (semester) params.semester = semester

      const res = await catalogApi.getAll(params)
      setRecordings(res.data.data || [])
    } catch (err) {
      console.error('Error cargando catálogo:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    catalogApi.getSchools().then(res => setSchools(res.data))
    fetchCatalog()
  }, [page])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchCatalog()
  }

  const handleLogout = async () => {
    try { await authApi.logout() } catch {}
    logout()
    navigate('/login')
  }

  const formatDuration = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  return (
    <div style={styles.container}>
      {/* Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.navBrand}>🎓 YoUSAC</div>
        <div style={styles.navRight}>
          <span style={styles.navUser}>{user?.email}</span>
          <span className="badge badge-blue">{user?.role}</span>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '6px 14px' }}>
            Salir
          </button>
        </div>
      </nav>

      <div style={styles.content}>
        {/* Filtros */}
        <form onSubmit={handleSearch} style={styles.filters}>
          <input
            type="text"
            placeholder="Buscar por título, descripción o tema..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex: 2 }}
          />
          <select value={schoolId} onChange={e => setSchoolId(e.target.value)} style={{ flex: 1 }}>
            <option value="">Todas las escuelas</option>
            {schools.map(s => (
              <option key={s.id} value={String(s.id)}>{s.name}</option>
            ))}
          </select>
          <select value={semester} onChange={e => setSemester(e.target.value)} style={{ flex: 1 }}>
            <option value="">Todos los semestres</option>
            <option value="Primer Semestre">Primer Semestre</option>
            <option value="Segundo Semestre">Segundo Semestre</option>
          </select>
          <button type="submit" className="btn btn-primary">Buscar</button>
          <button type="button" className="btn btn-secondary" onClick={() => {
            setSearch(''); setSchoolId(''); setSemester(''); setPage(1); fetchCatalog()
          }}>
            Limpiar
          </button>
        </form>

        {/* Grid de grabaciones */}
        {loading ? (
          <div style={styles.loading}>Cargando grabaciones...</div>
        ) : recordings.length === 0 ? (
          <div style={styles.empty}>No se encontraron grabaciones con los filtros aplicados</div>
        ) : (
          <div style={styles.grid}>
            {recordings.map(rec => (
              <div
                key={rec.recording_id}
                style={styles.card}
                onClick={() => navigate(`/player/${rec.recording_id}`)}
              >
                {/* Thumbnail */}
                <div style={styles.thumbnail}>
                  {rec.thumbnail_url
                    ? <img src={rec.thumbnail_url} alt={rec.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={styles.thumbnailPlaceholder}>▶</div>
                  }
                  <span style={styles.duration}>{formatDuration(rec.duration_seconds)}</span>
                </div>

                {/* Info */}
                <div style={styles.cardBody}>
                  <h3 style={styles.cardTitle}>{rec.title}</h3>
                  <p style={styles.cardCourse}>{rec.course_name}</p>
                  <p style={styles.cardSchool}>{rec.school_name}</p>
                  <div style={styles.cardFooter}>
                    <span style={styles.semester}>{rec.semester} {rec.year}</span>
                    <span style={styles.recommendation}>
                      ⭐ {Number(rec.recommendation_pct ?? 0).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Paginación */}
        <div style={styles.pagination}>
          <button
            className="btn btn-secondary"
            disabled={page === 1}
            onClick={() => setPage(p => p - 1)}
          >
            ← Anterior
          </button>
          <span style={{ color: '#94a3b8' }}>Página {page}</span>
          <button
            className="btn btn-secondary"
            disabled={recordings.length < 20}
            onClick={() => setPage(p => p + 1)}
          >
            Siguiente →
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', background: '#0f172a' },
  navbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 24px', background: '#1e293b', borderBottom: '1px solid #334155',
    position: 'sticky', top: 0, zIndex: 10,
  },
  navBrand: { fontSize: 20, fontWeight: 700, color: '#f1f5f9' },
  navRight: { display: 'flex', alignItems: 'center', gap: 12 },
  navUser: { fontSize: 13, color: '#94a3b8' },
  content: { padding: '24px', maxWidth: 1280, margin: '0 auto' },
  filters: {
    display: 'flex', gap: 12, marginBottom: 28,
    background: '#1e293b', padding: 16, borderRadius: 12,
    border: '1px solid #334155', flexWrap: 'wrap',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 20,
  },
  card: {
    background: '#1e293b', border: '1px solid #334155', borderRadius: 12,
    overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.2s, border-color 0.2s',
  },
  thumbnail: {
    position: 'relative', height: 160,
    background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  thumbnailPlaceholder: { fontSize: 48, color: '#3b82f6' },
  duration: {
    position: 'absolute', bottom: 8, right: 8,
    background: 'rgba(0,0,0,0.8)', color: '#f1f5f9',
    padding: '2px 8px', borderRadius: 4, fontSize: 12,
  },
  cardBody: { padding: '14px 16px' },
  cardTitle: { fontSize: 15, fontWeight: 600, color: '#f1f5f9', marginBottom: 6, lineHeight: 1.4 },
  cardCourse: { fontSize: 13, color: '#3b82f6', marginBottom: 2 },
  cardSchool: { fontSize: 12, color: '#64748b', marginBottom: 10 },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  semester: { fontSize: 12, color: '#64748b' },
  recommendation: { fontSize: 13, color: '#fbbf24', fontWeight: 600 },
  loading: { textAlign: 'center', color: '#64748b', padding: 60, fontSize: 16 },
  empty: { textAlign: 'center', color: '#64748b', padding: 60, fontSize: 15 },
  pagination: {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    gap: 16, marginTop: 32,
  },
}
