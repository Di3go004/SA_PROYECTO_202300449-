// src/pages/SettingsPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api from '../services/api'

export default function SettingsPage() {
  const navigate         = useNavigate()
  const { user, logout } = useAuth()

  const [activeTab,     setActiveTab]     = useState<'profile' | 'security' | 'notifications'>('profile')
  const [currentPass,   setCurrentPass]   = useState('')
  const [newPass,       setNewPass]       = useState('')
  const [confirmPass,   setConfirmPass]   = useState('')
  const [passError,     setPassError]     = useState('')
  const [passSuccess,   setPassSuccess]   = useState('')
  const [passLoading,   setPassLoading]   = useState(false)
  const [notifNewRec,   setNotifNewRec]   = useState(true)
  const [notifProgress, setNotifProgress] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPassError('')
    setPassSuccess('')

    if (newPass !== confirmPass) {
      setPassError('Las contraseñas no coinciden')
      return
    }
    if (newPass.length < 8) {
      setPassError('La contraseña debe tener al menos 8 caracteres')
      return
    }

    setPassLoading(true)
    try {
      await api.put('/api/users/me/password', {
        current_password: currentPass,
        new_password: newPass,
      })
      setPassSuccess('Contraseña actualizada exitosamente')
      setCurrentPass(''); setNewPass(''); setConfirmPass('')
    } catch (err: any) {
      setPassError(err.response?.data?.message || 'Error al cambiar contraseña')
    } finally {
      setPassLoading(false)
    }
  }

  const handleLogout = async () => {
    try { await api.post('/api/auth/logout') } catch {}
    logout()
    navigate('/login')
  }

  const getRoleBadge = (role: string) => {
    const map: Record<string, string> = {
      administrador: 'badge-yellow',
      docente: 'badge-green',
      estudiante: 'badge-blue',
    }
    return map[role] || 'badge-blue'
  }

  return (
    <div style={styles.container}>
      {/* Navbar */}
      <nav style={styles.navbar}>
        <div style={styles.navBrand}>🎓 YoUSAC</div>
        <div style={styles.navLinks}>
          <button className="btn btn-secondary" onClick={() => navigate('/catalog')} style={{ padding: '6px 14px' }}>Catálogo</button>
          <button className="btn btn-secondary" onClick={() => navigate('/assignments')} style={{ padding: '6px 14px' }}>Mis Cursos</button>
        </div>
        <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '6px 14px' }}>Salir</button>
      </nav>

      <div style={styles.layout}>
        {/* Sidebar */}
        <aside style={styles.sidebar}>
          <div style={styles.avatarSection}>
            <div style={styles.avatar}>{user?.email?.[0]?.toUpperCase() || '?'}</div>
            <p style={styles.avatarEmail}>{user?.email}</p>
            <span className={`badge ${getRoleBadge(user?.role || '')}`}>{user?.role}</span>
          </div>
          <nav style={styles.sideNav}>
            {(['profile', 'security', 'notifications'] as const).map(tab => (
              <button
                key={tab}
                style={{ ...styles.sideNavItem, ...(activeTab === tab ? styles.sideNavActive : {}) }}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'profile'       && '👤 Perfil'}
                {tab === 'security'      && '🔒 Seguridad'}
                {tab === 'notifications' && '🔔 Notificaciones'}
              </button>
            ))}
          </nav>
        </aside>

        {/* Contenido */}
        <main style={styles.main}>
          {/* Perfil */}
          {activeTab === 'profile' && (
            <div className="card">
              <h2 style={styles.sectionTitle}>Información de perfil</h2>
              <div style={styles.field}>
                <label style={styles.label}>Correo institucional</label>
                <input type="email" value={user?.email || ''} disabled style={{ opacity: 0.6 }} />
                <p style={styles.hint}>El correo institucional no puede modificarse</p>
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Rol asignado</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <span className={`badge ${getRoleBadge(user?.role || '')}`} style={{ padding: '6px 16px', fontSize: 14 }}>
                    {user?.role}
                  </span>
                  <span style={styles.hint}>El rol es asignado por el administrador</span>
                </div>
              </div>
            </div>
          )}

          {/* Seguridad */}
          {activeTab === 'security' && (
            <div className="card">
              <h2 style={styles.sectionTitle}>Cambiar contraseña</h2>
              {passError   && <div className="error-msg" style={{ marginBottom: 16 }}>{passError}</div>}
              {passSuccess && <div style={{ ...styles.successMsg, marginBottom: 16 }}>{passSuccess}</div>}
              <form onSubmit={handleChangePassword} style={styles.form}>
                <div style={styles.field}>
                  <label style={styles.label}>Contraseña actual</label>
                  <input type="password" value={currentPass} onChange={e => setCurrentPass(e.target.value)} required />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Nueva contraseña</label>
                  <input type="password" value={newPass} onChange={e => setNewPass(e.target.value)} required />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>Confirmar nueva contraseña</label>
                  <input type="password" value={confirmPass} onChange={e => setConfirmPass(e.target.value)} required />
                </div>
                <button type="submit" className="btn btn-primary" disabled={passLoading}>
                  {passLoading ? 'Actualizando...' : 'Actualizar contraseña'}
                </button>
              </form>
            </div>
          )}

          {/* Notificaciones */}
          {activeTab === 'notifications' && (
            <div className="card">
              <h2 style={styles.sectionTitle}>Preferencias de notificaciones</h2>
              <div style={styles.toggleItem}>
                <div>
                  <p style={styles.toggleLabel}>Nueva grabación en mis cursos</p>
                  <p style={styles.hint}>Recibir aviso cuando se publique una clase nueva</p>
                </div>
                <div
                  style={{ ...styles.toggle, background: notifNewRec ? '#3b82f6' : '#334155' }}
                  onClick={() => setNotifNewRec(!notifNewRec)}
                >
                  <div style={{ ...styles.toggleDot, transform: notifNewRec ? 'translateX(20px)' : 'translateX(0)' }} />
                </div>
              </div>
              <div style={styles.toggleItem}>
                <div>
                  <p style={styles.toggleLabel}>Recordatorios de progreso</p>
                  <p style={styles.hint}>Recordatorios semanales sobre cursos con poco avance</p>
                </div>
                <div
                  style={{ ...styles.toggle, background: notifProgress ? '#3b82f6' : '#334155' }}
                  onClick={() => setNotifProgress(!notifProgress)}
                >
                  <div style={{ ...styles.toggleDot, transform: notifProgress ? 'translateX(20px)' : 'translateX(0)' }} />
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 24 }}
                onClick={() => alert('Preferencias guardadas')}>
                Guardar preferencias
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { minHeight: '100vh', background: '#0f172a' },
  navbar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 24px', background: '#1e293b', borderBottom: '1px solid #334155',
  },
  navBrand: { fontSize: 20, fontWeight: 700, color: '#f1f5f9' },
  navLinks: { display: 'flex', gap: 8 },
  layout: { display: 'flex', maxWidth: 1000, margin: '32px auto', gap: 24, padding: '0 24px' },
  sidebar: {
    flex: '0 0 220px', background: '#1e293b',
    border: '1px solid #334155', borderRadius: 12, padding: 20, height: 'fit-content',
  },
  avatarSection: { textAlign: 'center', marginBottom: 24, paddingBottom: 24, borderBottom: '1px solid #334155' },
  avatar: {
    width: 64, height: 64, borderRadius: '50%', background: '#3b82f6',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, fontWeight: 700, color: 'white', margin: '0 auto 12px',
  },
  avatarEmail: { fontSize: 12, color: '#64748b', marginBottom: 8, wordBreak: 'break-all' },
  sideNav: { display: 'flex', flexDirection: 'column', gap: 4 },
  sideNavItem: {
    width: '100%', textAlign: 'left', padding: '10px 12px',
    border: 'none', borderRadius: 8, background: 'transparent',
    color: '#94a3b8', fontSize: 14, cursor: 'pointer',
  },
  sideNavActive: { background: '#0f172a', color: '#f1f5f9' },
  main: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: 600, color: '#f1f5f9', marginBottom: 20 },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, color: '#94a3b8', fontWeight: 500 },
  hint: { fontSize: 12, color: '#475569', marginTop: 4 },
  successMsg: {
    background: '#14532d', border: '1px solid #22c55e',
    color: '#86efac', padding: '10px 14px', borderRadius: 8, fontSize: 14,
  },
  toggleItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '16px 0', borderBottom: '1px solid #334155',
  },
  toggleLabel: { fontSize: 14, color: '#f1f5f9', marginBottom: 4 },
  toggle: {
    width: 44, height: 24, borderRadius: 99, cursor: 'pointer',
    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
  },
  toggleDot: {
    position: 'absolute', top: 2, left: 2,
    width: 20, height: 20, borderRadius: '50%',
    background: 'white', transition: 'transform 0.2s',
  },
}
