// src/pages/AdminPage.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'

interface User {
  id: number
  email: string
  full_name: string
  role_name: string
  is_active: boolean
  is_blocked: boolean
}

interface SystemStats {
  total_platform_views: number
  total_platform_ratings: number
  avg_recommendation: number
  total_videos: number
  active_teachers: number
  active_students: number
}

type RoleFilter = 'todos' | 'estudiante' | 'docente' | 'administrador'

export default function AdminPage() {
  const navigate         = useNavigate()
  const { user, logout } = useAuth()

  const [users,       setUsers]       = useState<User[]>([])
  const [stats,       setStats]       = useState<SystemStats | null>(null)
  const [roleFilter,  setRoleFilter]  = useState<RoleFilter>('todos')
  const [search,      setSearch]      = useState('')
  const [loading,     setLoading]     = useState(true)
  const [activeSection, setActiveSection] = useState<'dashboard' | 'users'>('dashboard')

  useEffect(() => {
    // Redirigir si no es admin
    if (user && user.role !== 'administrador') {
      navigate('/catalog')
      return
    }
    loadData()
  }, [user])

  const loadData = async () => {
    setLoading(true)
    try {
      const [usersRes, statsRes] = await Promise.allSettled([
        api.get('/api/users'),
        api.get('/api/analytics/reports/system-stats'),
      ])
      if (usersRes.status === 'fulfilled') setUsers(usersRes.value.data)
      if (statsRes.status === 'fulfilled') setStats(statsRes.value.data)
    } catch (err) {
      console.error('Error cargando datos admin:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleAssignRole = async (userId: number, roleId: number) => {
    try {
      await api.put(`/api/users/${userId}/role`, { role_id: roleId })
      await loadData()
    } catch (err: any) {
      alert(err.response?.data?.message || 'Error al asignar rol')
    }
  }

  const handleToggleBlock = async (u: User) => {
    try {
      await api.put(`/api/users/${u.id}/block`, { blocked: !u.is_blocked })
      await loadData()
    } catch (err: any) {
      alert('Error al cambiar estado del usuario')
    }
  }

  const handleLogout = async () => {
    try { await api.post('/api/auth/logout') } catch {}
    logout()
    navigate('/login')
  }

  const filteredUsers = users.filter(u => {
    const matchRole   = roleFilter === 'todos' || u.role_name === roleFilter
    const matchSearch = !search || u.email.includes(search) || u.full_name?.toLowerCase().includes(search.toLowerCase())
    return matchRole && matchSearch
  })

  const getRoleBadgeClass = (role: string) => {
    if (role === 'administrador') return 'badge-yellow'
    if (role === 'docente')       return 'badge-green'
    return 'badge-blue'
  }

  const ROLE_IDS: Record<string, number> = { estudiante: 2, docente: 3, administrador: 1 }

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarBrand}>🎓 YoUSAC</div>
        <nav style={styles.sideNav}>
          {[
            { key: 'dashboard', label: '📊 Dashboard' },
            { key: 'users',     label: '👥 Usuarios' },
          ].map(item => (
            <button
              key={item.key}
              style={{ ...styles.sideNavItem, ...(activeSection === item.key ? styles.sideNavActive : {}) }}
              onClick={() => setActiveSection(item.key as any)}
            >
              {item.label}
            </button>
          ))}
          <button style={styles.sideNavItem} onClick={() => navigate('/catalog')}>
            🎬 Catálogo
          </button>
        </nav>
        <div style={styles.sidebarFooter}>
          <p style={styles.sidebarUser}>{user?.email}</p>
          <span className="badge badge-yellow">Administrador</span>
          <button className="btn btn-secondary" onClick={handleLogout}
            style={{ marginTop: 12, width: '100%', padding: '6px' }}>
            Salir
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        {/* Top bar */}
        <div style={styles.topbar}>
          <h1 style={styles.pageTitle}>
            {activeSection === 'dashboard' ? 'Dashboard' : 'Gestión de Usuarios'}
          </h1>
        </div>

        {loading ? (
          <div style={styles.loading}>Cargando datos...</div>
        ) : (
          <>
            {/* Dashboard */}
            {activeSection === 'dashboard' && (
              <div>
                <div style={styles.statsGrid}>
                  {[
                    { label: 'Reproducciones',   value: stats?.total_platform_views   || 0, color: '#3b82f6' },
                    { label: 'Calificaciones',    value: stats?.total_platform_ratings || 0, color: '#8b5cf6' },
                    { label: 'Videos publicados', value: stats?.total_videos           || 0, color: '#f59e0b' },
                    { label: 'Estudiantes activos', value: stats?.active_students      || 0, color: '#22c55e' },
                    { label: 'Docentes activos',  value: stats?.active_teachers        || 0, color: '#ec4899' },
                    { label: '% Recomendación promedio', value: `${Number(stats?.avg_recommendation ?? 0).toFixed(0)}%`, color: '#06b6d4' },
                  ].map(stat => (
                    <div key={stat.label} className="card" style={styles.statCard}>
                      <p style={{ ...styles.statValue, color: stat.color }}>{stat.value}</p>
                      <p style={styles.statLabel}>{stat.label}</p>
                    </div>
                  ))}
                </div>

                <div className="card" style={{ marginTop: 24 }}>
                  <h3 style={{ color: '#f1f5f9', marginBottom: 16 }}>Distribución de usuarios</h3>
                  <div style={{ display: 'flex', gap: 24 }}>
                    {(['estudiante', 'docente', 'administrador'] as const).map(role => {
                      const count = users.filter(u => u.role_name === role).length
                      return (
                        <div key={role} style={{ textAlign: 'center' }}>
                          <p style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>{count}</p>
                          <span className={`badge ${getRoleBadgeClass(role)}`}>{role}s</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* Usuarios */}
            {activeSection === 'users' && (
              <div>
                {/* Filtros */}
                <div style={styles.tableFilters}>
                  <input
                    type="text"
                    placeholder="Buscar por nombre o correo..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    style={{ flex: 2 }}
                  />
                  <div style={styles.roleTabs}>
                    {(['todos', 'estudiante', 'docente', 'administrador'] as RoleFilter[]).map(r => (
                      <button
                        key={r}
                        style={{ ...styles.roleTab, ...(roleFilter === r ? styles.roleTabActive : {}) }}
                        onClick={() => setRoleFilter(r)}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tabla */}
                <div style={styles.tableWrapper}>
                  <table style={styles.table}>
                    <thead>
                      <tr>
                        {['Nombre', 'Correo', 'Rol', 'Estado', 'Acciones'].map(h => (
                          <th key={h} style={styles.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map(u => (
                        <tr key={u.id} style={styles.tr}>
                          <td style={styles.td}>{u.full_name || '—'}</td>
                          <td style={styles.td}>{u.email}</td>
                          <td style={styles.td}>
                            <span className={`badge ${getRoleBadgeClass(u.role_name)}`}>{u.role_name}</span>
                          </td>
                          <td style={styles.td}>
                            <span style={{ color: u.is_blocked ? '#ef4444' : '#22c55e', fontSize: 13 }}>
                              {u.is_blocked ? '🔒 Bloqueado' : '✅ Activo'}
                            </span>
                          </td>
                          <td style={styles.td}>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {/* Cambiar rol */}
                              <select
                                value={u.role_name}
                                onChange={e => handleAssignRole(u.id, ROLE_IDS[e.target.value])}
                                style={{ padding: '4px 8px', fontSize: 12, width: 'auto' }}
                              >
                                <option value="estudiante">Estudiante</option>
                                <option value="docente">Docente</option>
                                <option value="administrador">Admin</option>
                              </select>
                              {/* Bloquear */}
                              <button
                                className={`btn ${u.is_blocked ? 'btn-secondary' : 'btn-danger'}`}
                                style={{ padding: '4px 10px', fontSize: 12 }}
                                onClick={() => handleToggleBlock(u)}
                              >
                                {u.is_blocked ? 'Activar' : 'Bloquear'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#64748b', padding: 32 }}>
                      No se encontraron usuarios
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', minHeight: '100vh', background: '#0f172a' },
  sidebar: {
    width: 220, background: '#1e293b', borderRight: '1px solid #334155',
    display: 'flex', flexDirection: 'column', padding: '20px 0',
    position: 'sticky', top: 0, height: '100vh',
  },
  sidebarBrand: { fontSize: 18, fontWeight: 700, color: '#f1f5f9', padding: '0 20px 20px', borderBottom: '1px solid #334155' },
  sideNav: { flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4 },
  sideNavItem: {
    width: '100%', textAlign: 'left', padding: '10px 12px',
    border: 'none', borderRadius: 8, background: 'transparent',
    color: '#94a3b8', fontSize: 14, cursor: 'pointer',
  },
  sideNavActive: { background: '#0f172a', color: '#f1f5f9' },
  sidebarFooter: { padding: '16px 20px', borderTop: '1px solid #334155' },
  sidebarUser: { fontSize: 12, color: '#64748b', marginBottom: 8, wordBreak: 'break-all' },
  main: { flex: 1, overflow: 'auto' },
  topbar: {
    padding: '20px 24px', borderBottom: '1px solid #334155',
    background: '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  },
  pageTitle: { fontSize: 20, fontWeight: 600, color: '#f1f5f9' },
  statsGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 16, padding: 24,
  },
  statCard: { textAlign: 'center' },
  statValue: { fontSize: 32, fontWeight: 700, marginBottom: 4 },
  statLabel: { fontSize: 13, color: '#64748b' },
  tableFilters: {
    display: 'flex', gap: 12, padding: '16px 24px',
    alignItems: 'center', flexWrap: 'wrap',
  },
  roleTabs: { display: 'flex', gap: 4 },
  roleTab: {
    padding: '6px 12px', border: 'none', borderRadius: 8,
    background: '#1e293b', color: '#94a3b8', fontSize: 13, cursor: 'pointer',
  },
  roleTabActive: { background: '#3b82f6', color: 'white' },
  tableWrapper: { padding: '0 24px 24px', overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    textAlign: 'left', padding: '12px 16px', fontSize: 12,
    color: '#64748b', fontWeight: 500, borderBottom: '1px solid #334155',
    background: '#1e293b',
  },
  tr: { borderBottom: '1px solid #1e293b' },
  td: { padding: '12px 16px', fontSize: 14, color: '#f1f5f9', verticalAlign: 'middle' },
  loading: { textAlign: 'center', color: '#64748b', padding: 60 },
}
