import { useEffect, useRef } from 'react'

interface GoogleId {
  initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void
}
declare global { interface Window { google?: { accounts: { id: GoogleId } } } }

const SRC = 'https://accounts.google.com/gsi/client'

function loadScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`)
    const s = existing ?? Object.assign(document.createElement('script'), { src: SRC, async: true })
    s.addEventListener('load', () => resolve(), { once: true })
    s.addEventListener('error', () => reject(new Error('Could not load Google sign-in')), { once: true })
    if (!existing) document.head.appendChild(s)
  })
}

/** Official "Sign in with Google" button. The credential it returns is verified by our backend, never trusted here. */
export default function GoogleButton({ clientId, onCredential, onError }: {
  clientId: string; onCredential: (credential: string) => void; onError: (message: string) => void
}) {
  const box = useRef<HTMLDivElement>(null)
  const cb = useRef(onCredential)
  cb.current = onCredential

  useEffect(() => {
    let alive = true
    loadScript().then(() => {
      if (!alive || !box.current || !window.google) return
      window.google.accounts.id.initialize({ client_id: clientId, callback: (r) => cb.current(r.credential) })
      window.google.accounts.id.renderButton(box.current, { theme: 'outline', size: 'large', text: 'continue_with', width: 320 })
    }).catch((e: Error) => onError(e.message))
    return () => { alive = false }
  }, [clientId, onError])

  return <div ref={box} className="flex min-h-11 justify-center" />
}
