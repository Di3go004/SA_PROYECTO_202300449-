// src/pages/SettingsPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import api, { authApi } from '../services/api'
import { useToast } from '../components/Toast'

const ROLE_BADGE: Record<string, string> = {
  administrador: 'badge-primary',
  catedratico:   'badge-success',
  auxiliar:      'badge-info',
  estudiante:    'badge-neutral',
}

const ADMIN_ROLES = ['administrador', 'catedratico', 'auxiliar']

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const toast = useToast()

  const [tab, setTab] = useState<'profile' | 'security'>('profile')
  const [currentPass, setCurrentPass] = useState('')
  const [newPass, setNewPass]         = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passError, setPassError]     = useState('')
  const [passLoading, setPassLoading] = useState(false)

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPassError('')

    if (newPass !== confirmPass) return setPassError('Las contraseñas no coinciden')
    if (newPass.length < 8)       return setPassError('La contraseña debe tener al menos 8 caracteres')

    setPassLoading(true)
    try {
      await api.put('/api/users/me/password', {
        current_password: currentPass,
        new_password: newPass,
      })
      toast.success('Contraseña actualizada')
      setCurrentPass(''); setNewPass(''); setConfirmPass('')
    } catch (err: any) {
      setPassError(err.response?.data?.message || 'No se pudo cambiar la contraseña')
    } finally {
      setPassLoading(false)
    }
  }

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* la sesión local se limpia igual */ }
    logout()
    navigate('/login')
  }

  return (
    <div className="public-shell">
      <nav className="navbar">
        <div className="navbar-brand">
          <span className="sidebar-logo">Yo</span>
          <span>YoUSAC</span>
        </div>
        <div className="navbar-actions">
          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/catalog')}>Catálogo</button>
          {ADMIN_ROLES.includes(user?.role || '') && (
            <button className="btn btn-secondary btn-sm" onClick={() => navigate('/admin')}>Panel admin</button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Salir</button>
        </div>
      </nav>

      <div className="page-wrap" style={{ maxWidth: 720 }}>
        <div>
          <h1>Configuración</h1>
          <p className="subtitle">Datos de tu cuenta y seguridad</p>
        </div>

        <div className="segmented" style={{ alignSelf: 'flex-start' }}>
          <button className={tab === 'profile' ? 'is-active' : ''} onClick={() => setTab('profile')}>
            Perfil
          </button>
          <button className={tab === 'security' ? 'is-active' : ''} onClick={() => setTab('security')}>
            Seguridad
          </button>
        </div>

        {tab === 'profile' && (
          <div className="card">
            <div className="card-header"><h2 className="card-title">Datos de la cuenta</h2></div>
            <div className="field">
              <label className="field-label">Correo institucional</label>
              <input value={user?.email || ''} disabled />
            </div>
            <div className="field">
              <label className="field-label">Rol asignado</label>
              <div>
                <span className={`badge ${ROLE_BADGE[user?.role || ''] || 'badge-neutral'}`}>
                  {user?.role}
                </span>
              </div>
            </div>
            <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
              El rol solo puede cambiarlo un administrador desde el panel de gestión.
            </p>
          </div>
        )}

        {tab === 'security' && (
          <div className="card">
            <div className="card-header"><h2 className="card-title">Cambiar contraseña</h2></div>
            {passError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{passError}</div>}
            <form onSubmit={handleChangePassword}>
              <div className="field">
                <label className="field-label">Contraseña actual</label>
                <input type="password" value={currentPass} required
                  onChange={e => setCurrentPass(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">Nueva contraseña</label>
                <input type="password" value={newPass} required
                  onChange={e => setNewPass(e.target.value)} />
              </div>
              <div className="field">
                <label className="field-label">Confirmar nueva contraseña</label>
                <input type="password" value={confirmPass} required
                  onChange={e => setConfirmPass(e.target.value)} />
              </div>
              <button type="submit" className="btn btn-primary" disabled={passLoading}>
                {passLoading ? 'Guardando…' : 'Actualizar contraseña'}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  )
}
