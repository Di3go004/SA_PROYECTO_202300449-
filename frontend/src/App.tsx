// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import LoginPage      from './pages/LoginPage'
import CatalogPage    from './pages/CatalogPage'
import PlayerPage     from './pages/PlayerPage'
import AssignmentsPage from './pages/AssignmentsPage'
import SettingsPage   from './pages/SettingsPage'
import AdminPage      from './pages/AdminPage'
import { useAuth }    from './hooks/useAuth'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth()
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />
}

function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (user?.role !== 'administrador') return <Navigate to="/catalog" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/catalog" element={
          <PrivateRoute><CatalogPage /></PrivateRoute>
        } />
        <Route path="/player/:videoId" element={
          <PrivateRoute><PlayerPage /></PrivateRoute>
        } />
        <Route path="/assignments" element={
          <PrivateRoute><AssignmentsPage /></PrivateRoute>
        } />
        <Route path="/settings" element={
          <PrivateRoute><SettingsPage /></PrivateRoute>
        } />
        <Route path="/admin" element={
          <AdminRoute><AdminPage /></AdminRoute>
        } />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
