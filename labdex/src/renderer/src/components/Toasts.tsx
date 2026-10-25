import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'

type Kind = 'ok' | 'error' | 'info'
interface Toast {
  id: number
  kind: Kind
  title: string
  detail?: string
}

const Ctx = createContext<(kind: Kind, title: string, detail?: string) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((kind: Kind, title: string, detail?: string) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, kind, title, detail }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' ? 6000 : 3200)
  }, [])

  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast toast-${t.kind}`}>
            <span className="toast-perf" />
            {t.kind === 'ok' ? <CheckCircle2 size={16} /> : t.kind === 'error' ? <AlertTriangle size={16} /> : <Info size={16} />}
            <div>
              <strong>{t.title}</strong>
              {t.detail && <p>{t.detail}</p>}
            </div>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
