import { api } from '../api/client'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type AppRole = 'farmer' | 'buyer' | 'admin'
export interface AuthUser { id: string; email: string; name: string; picture: string | null; role: AppRole }
export type SelfRole = 'farmer' | 'buyer'

interface AuthState {
  user: AuthUser | null
  loading: boolean
  googleClientId: string | null
  signInWithGoogle: (credential: string, role: SelfRole) => Promise<AuthUser>
  register: (email: string, password: string, name: string, role: SelfRole) => Promise<AuthUser>
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [googleClientId, setGoogleClientId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    // Backend unreachable (for example frontend-only mode): stay signed out, never crash.
    Promise.allSettled([api<AuthUser>('/api/auth/me'), api<{ googleClientId: string | null }>('/api/config')]).then(([me, cfg]) => {
      if (!alive) return
      if (me.status === 'fulfilled') setUser(me.value)
      if (cfg.status === 'fulfilled') setGoogleClientId(cfg.value.googleClientId)
      setLoading(false)
    })
    return () => { alive = false }
  }, [])

  const post = useCallback(async (path: string, body: unknown) => {
    const u = await api<AuthUser>(path, { method: 'POST', body: JSON.stringify(body) })
    setUser(u)
    return u
  }, [])

  const value = useMemo<AuthState>(() => ({
    user, loading, googleClientId,
    signInWithGoogle: (credential, role) => post('/api/auth/google', { credential, role }),
    register: (email, password, name, role) => post('/api/auth/register', { email, password, name, role }),
    login: (email, password) => post('/api/auth/login', { email, password }),
    logout: async () => { await api('/api/auth/logout', { method: 'POST' }).catch(() => undefined); setUser(null) },
  }), [user, loading, googleClientId, post])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
