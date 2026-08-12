// src/pages/admin/UsersSection.tsx
// Gestión de usuarios y docentes. Cambiar roles y bloquear son operaciones
// exclusivas del administrador: catedrático y auxiliar ven la tabla en modo
// lectura (el backend responde 403 igual, esto solo evita ofrecer el botón).
import { useEffect, useState } from 'react'
import { usersApi } from '../../services/api'
import { useToast } from '../../components/Toast'
import ConfirmDialog from '../../components/ConfirmDialog'

interface User {
  id: number
  email: string
  full_name: string
  role_name: string
  is_active: boolean
  is_blocked: boolean
}

const ROLE_IDS: Record<string, number> = {
  administrador: 1, estudiante: 2, catedratico: 3, auxiliar: 4,
}

const ROLE_BADGE: Record<string, string> = {
  administrador: 'badge-primary',
  catedratico:   'badge-success',
  auxiliar:      'badge-info',
  estudiante:    'badge-neutral',
}

type Filter = 'todos' | 'administrador' | 'catedratico' | 'auxiliar' | 'estudiante'

export default function UsersSection({ canManage, onlyTeachers = false }: {
  canManage: boolean
  onlyTeachers?: boolean
}) {
  const toast = useToast()
  const [users, setUsers]     = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState<Filter>('todos')
  const [target, setTarget]   = useState<User | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setUsers((await usersApi.getAll()).data)
    } catch {
      toast.error('No se pudo cargar los usuarios')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [])

  const changeRole = async (user: User, role: string) => {
    setSaving(true)
    try {
      await usersApi.assignRole(user.id, ROLE_IDS[role])
      toast.success(`${user.full_name} ahora es ${role}`)
      await load()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo cambiar el rol')
    } finally {
      setSaving(false)
    }
  }

  const toggleBlock = async () => {
    if (!target) return
    setSaving(true)
    try {
      await usersApi.toggleBlock(target.id, !target.is_blocked)
      toast.success(target.is_blocked ? 'Usuario reactivado' : 'Usuario bloqueado')
      setTarget(null)
      await load()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'No se pudo cambiar el estado')
    } finally {
      setSaving(false)
    }
  }

  // La vista "Docentes" es la misma tabla acotada a los roles que dan clase.
  const base = onlyTeachers
    ? users.filter(u => u.role_name === 'catedratico' || u.role_name === 'auxiliar')
    : users

  const visible = base.filter(u => {
    const byRole = filter === 'todos' || u.role_name === filter
    const term = search.trim().toLowerCase()
    const bySearch = !term ||
      u.email.toLowerCase().includes(term) ||
      (u.full_name || '').toLowerCase().includes(term)
    return byRole && bySearch
  })

  return (
    <>
      <div className="toolbar">
        <div>
          <div className="card-title">{onlyTeachers ? 'Docentes' : 'Usuarios'}</div>
          <div className="subtitle">
            {visible.length} de {base.length} registro(s)
            {!canManage && ' · solo lectura'}
          </div>
        </div>
        <div className="toolbar-spacer" />
        <input className="grow" placeholder="Buscar por nombre o correo…"
          value={search} onChange={e => setSearch(e.target.value)} />
        {!onlyTeachers && (
          <div className="segmented">
            {(['todos', 'administrador', 'catedratico', 'auxiliar', 'estudiante'] as Filter[]).map(r => (
              <button key={r} className={filter === r ? 'is-active' : ''} onClick={() => setFilter(r)}>
                {r}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="table-wrap">
        {loading ? (
          <div className="loading-block"><span className="spinner" /> Cargando usuarios…</div>
        ) : visible.length === 0 ? (
          <div className="empty-state"><span className="empty-icon">👥</span>No se encontraron usuarios</div>
        ) : (
          <div className="table-scroll">
            <table className="data">
              <thead>
                <tr>
                  <th>Nombre</th><th>Correo</th><th>Rol</th><th>Estado</th>
                  {canManage && <th style={{ textAlign: 'right' }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map(u => (
                  <tr key={u.id}>
                    <td className="cell-strong">{u.full_name || '—'}</td>
                    <td className="muted">{u.email}</td>
                    <td>
                      <span className={`badge ${ROLE_BADGE[u.role_name] || 'badge-neutral'}`}>
                        {u.role_name}
                      </span>
                    </td>
                    <td>
                      {u.is_blocked
                        ? <span className="badge badge-danger">Bloqueado</span>
                        : <span className="badge badge-success">Activo</span>}
                    </td>
                    {canManage && (
                      <td>
                        <div className="cell-actions">
                          <select
                            value={u.role_name}
                            disabled={saving}
                            style={{ width: 'auto', minWidth: 130 }}
                            onChange={e => changeRole(u, e.target.value)}
                          >
                            <option value="administrador">Administrador</option>
                            <option value="catedratico">Catedrático</option>
                            <option value="auxiliar">Auxiliar</option>
                            <option value="estudiante">Estudiante</option>
                          </select>
                          <button
                            className={`btn btn-sm ${u.is_blocked ? 'btn-secondary' : 'btn-danger'}`}
                            onClick={() => setTarget(u)}
                            disabled={saving}
                          >
                            {u.is_blocked ? 'Activar' : 'Bloquear'}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!target}
        title={target?.is_blocked ? 'Reactivar usuario' : 'Bloquear usuario'}
        message={target?.is_blocked
          ? `¿Reactivar el acceso de ${target?.full_name}?`
          : `¿Bloquear el acceso de ${target?.full_name}? No podrá iniciar sesión hasta que se reactive.`}
        confirmLabel={target?.is_blocked ? 'Reactivar' : 'Bloquear'}
        busy={saving}
        onConfirm={toggleBlock}
        onCancel={() => setTarget(null)}
      />
    </>
  )
}
