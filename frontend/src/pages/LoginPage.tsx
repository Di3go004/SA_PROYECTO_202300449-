// src/pages/LoginPage.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { authApi } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../components/Toast'

const ADMIN_ROLES = ['administrador', 'catedratico', 'auxiliar']

export default function LoginPage() {
  const navigate  = useNavigate()
  const { login } = useAuth()
  const toast     = useToast()

  const [tab,      setTab]      = useState<'login' | 'register'>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.login(email, password)
      login({ token: res.data.token, email, role: res.data.role })
      // Los roles administrativos entran directo al panel; el resto al catálogo.
      navigate(ADMIN_ROLES.includes(res.data.role) ? '/admin' : '/catalog')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Correo o contraseña incorrectos')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await authApi.register(email, password, fullName)
      setTab('login')
      toast.success('Registro exitoso, ya podés iniciar sesión')
    } catch (err: any) {
      setError(err.response?.data?.message || 'No se pudo completar el registro')
    } finally {
      setLoading(false)
    }
  }

  const switchTab = (next: 'login' | 'register') => { setTab(next); setError('') }

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo">Yo</div>
          <h1>YoUSAC</h1>
          <p className="subtitle">Plataforma de video académico · USAC</p>
        </div>

        <div className="auth-tabs">
          <button className={tab === 'login' ? 'is-active' : ''} onClick={() => switchTab('login')}>
            Iniciar sesión
          </button>
          <button className={tab === 'register' ? 'is-active' : ''} onClick={() => switchTab('register')}>
            Registrarse
          </button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 14 }}>{error}</div>}

        <form onSubmit={tab === 'login' ? handleLogin : handleRegister}>
          {tab === 'register' && (
            <div className="field">
              <label className="field-label">Nombre completo</label>
              <input value={fullName} onChange={e => setFullName(e.target.value)}
                placeholder="Diego González" required />
            </div>
          )}

          <div className="field">
            <label className="field-label">Correo institucional</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="usuario@ingenieria.usac.edu.gt" required />
          </div>

          <div className="field">
            <label className="field-label">Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: 4 }}
            disabled={loading}>
            {loading
              ? <><span className="spinner" /> Procesando…</>
              : tab === 'login' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        {tab === 'register' && (
          <p className="subtitle text-center" style={{ marginTop: 14, fontSize: 12 }}>
            Solo se admiten correos de los dominios
            <br />
            <strong>@ingenieria.usac.edu.gt</strong> y <strong>@ing.usac.edu.gt</strong>
          </p>
        )}
      </div>
    </div>
  )
}
