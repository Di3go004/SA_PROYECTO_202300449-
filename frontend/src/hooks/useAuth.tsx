// src/hooks/useAuth.tsx
import { useState, useEffect, useContext, createContext, ReactNode } from 'react'

interface User {
  email: string
  role: string
  token: string
}

interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  login: (data: { token: string; email: string; role: string }) => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)

  useEffect(() => {
    const token = localStorage.getItem('token')
    const email = localStorage.getItem('email')
    const role  = localStorage.getItem('role')
    if (token && email && role) {
      setUser({ token, email, role })
    }
  }, [])

  const login = (data: { token: string; email: string; role: string }) => {
    localStorage.setItem('token', data.token)
    localStorage.setItem('email', data.email)
    localStorage.setItem('role',  data.role)
    setUser(data)
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('email')
    localStorage.removeItem('role')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}
