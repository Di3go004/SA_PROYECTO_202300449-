// src/components/Toast.tsx
// Avisos no bloqueantes. Reemplazan a los alert() nativos que usaba el panel:
// un alert() congela la pestaña y no distingue éxito de error, y en la carga
// masiva hacía falta poder mostrar el resultado sin interrumpir la pantalla.
import { createContext, useCallback, useContext, useState, ReactNode } from 'react'

type ToastKind = 'success' | 'error' | 'info'
interface ToastItem { id: number; kind: ToastKind; message: string }

interface ToastApi {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const ToastContext = createContext<ToastApi | null>(null)

let nextId = 1

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId++
    setItems(current => [...current, { id, kind, message }])
    // Los errores se quedan más tiempo: suelen traer el mensaje del SP y hay
    // que alcanzar a leerlo.
    setTimeout(() => setItems(c => c.filter(t => t.id !== id)), kind === 'error' ? 6000 : 3500)
  }, [])

  const api: ToastApi = {
    success: useCallback((m: string) => push('success', m), [push]),
    error:   useCallback((m: string) => push('error', m), [push]),
    info:    useCallback((m: string) => push('info', m), [push]),
  }

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="toast-stack">
        {items.map(t => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span>{t.kind === 'success' ? '✓' : t.kind === 'error' ? '⚠' : 'ℹ'}</span>
            <span>{t.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast debe usarse dentro de <ToastProvider>')
  return ctx
}
