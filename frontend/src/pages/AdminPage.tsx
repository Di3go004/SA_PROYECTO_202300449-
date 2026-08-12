// src/pages/AdminPage.tsx
// Panel de administración (Práctica 3).
//
// Accesible para administrador, catedrático y auxiliar. La diferencia entre
// ellos es la gestión de usuarios, reservada al administrador: acá solo se
// oculta la opción, la barrera real la aplican el gateway (403) y los guards
// gRPC de cada microservicio.
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { authApi } from '../services/api'

import DashboardSection from './admin/DashboardSection'
import SemestersSection from './admin/SemestersSection'
import SchoolsSection   from './admin/SchoolsSection'
import CoursesSection   from './admin/CoursesSection'
import UsersSection     from './admin/UsersSection'
import ImportSection    from './admin/ImportSection'

type Section = 'dashboard' | 'semesters' | 'schools' | 'courses' | 'teachers' | 'users' | 'import'

const TITLES: Record<Section, { title: string; sub: string }> = {
  dashboard: { title: 'Panel de administración', sub: 'Resumen del catálogo académico' },
  semesters: { title: 'Semestres',        sub: 'Alta, edición y baja de periodos académicos' },
  schools:   { title: 'Escuelas y Áreas', sub: 'Unidades académicas de la facultad' },
  courses:   { title: 'Cursos',           sub: 'Cursos y asignación de docentes' },
  teachers:  { title: 'Docentes',         sub: 'Catedráticos y auxiliares registrados' },
  users:     { title: 'Usuarios',         sub: 'Roles y estado de las cuentas' },
  import:    { title: 'Carga masiva',     sub: 'Importación de clases desde archivos CSV' },
}

const ROLE_LABEL: Record<string, string> = {
  administrador: 'Administrador', catedratico: 'Catedrático', auxiliar: 'Auxiliar',
}

export default function AdminPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [section, setSection] = useState<Section>('dashboard')

  const isAdmin = user?.role === 'administrador'

  const handleLogout = async () => {
    try { await authApi.logout() } catch { /* la sesión local se limpia igual */ }
    logout()
    navigate('/login')
  }

  const nav: { key: Section; icon: string; label: string; adminOnly?: boolean }[] = [
    { key: 'dashboard', icon: '▤', label: 'Resumen' },
    { key: 'semesters', icon: '◷', label: 'Semestres' },
    { key: 'schools',   icon: '⛨', label: 'Escuelas' },
    { key: 'courses',   icon: '❑', label: 'Cursos' },
    { key: 'teachers',  icon: '✎', label: 'Docentes' },
    { key: 'users',     icon: '☰', label: 'Usuarios', adminOnly: true },
    { key: 'import',    icon: '⇪', label: 'Carga CSV' },
  ]

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-logo">Yo</span>
          <span>YoUSAC</span>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-group">Gestión</div>
          {nav.filter(i => !i.adminOnly || isAdmin).map(item => (
            <button
              key={item.key}
              className={`sidebar-item${section === item.key ? ' is-active' : ''}`}
              onClick={() => setSection(item.key)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}

          <div className="sidebar-group">Plataforma</div>
          <button className="sidebar-item" onClick={() => navigate('/catalog')}>
            <span className="nav-icon">▷</span><span>Ver catálogo</span>
          </button>
        </nav>

        <div className="sidebar-foot">
          <div className="sidebar-user">{ROLE_LABEL[user?.role || ''] || user?.role}</div>
          <div className="sidebar-mail">{user?.email}</div>
          <button className="btn btn-secondary btn-sm" style={{ width: '100%', color: '#fff', borderColor: 'rgba(255,255,255,.45)' }}
            onClick={handleLogout}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="admin-main">
        <header className="topbar">
          <div>
            <div className="topbar-title">{TITLES[section].title}</div>
            <div className="topbar-sub">{TITLES[section].sub}</div>
          </div>
          <span className="badge badge-primary">{ROLE_LABEL[user?.role || ''] || user?.role}</span>
        </header>

        <div className="admin-content">
          {section === 'dashboard' && <DashboardSection onGo={s => setSection(s as Section)} />}
          {section === 'semesters' && <SemestersSection />}
          {section === 'schools'   && <SchoolsSection />}
          {section === 'courses'   && <CoursesSection />}
          {section === 'teachers'  && <UsersSection canManage={isAdmin} onlyTeachers />}
          {section === 'users'     && isAdmin && <UsersSection canManage />}
          {section === 'import'    && <ImportSection />}
        </div>
      </main>
    </div>
  )
}
