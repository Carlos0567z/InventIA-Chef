import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import '@fortawesome/fontawesome-free/css/all.min.css'
import { clearSession, getToken } from './services/auth'

document.documentElement.lang = 'es'

const rawFetch = window.fetch.bind(window)

const API_BASE = String(import.meta.env.VITE_API_URL || '').replace(/\/$/, '')

if (import.meta.env.PROD && !API_BASE) {
  console.warn(
    'VITE_API_URL no definida: /api se llama al mismo host que la web. Si el front esta en un hosting estatico, hay que poner aqui la URL del backend o servir el dist desde Express (SERVIR_FRONTEND=1).'
  )
}

function resolverApiUrl(input) {
  if (!API_BASE) return input
  if (typeof input === 'string' && input.startsWith('/api/')) {
    return `${API_BASE}${input}`
  }
  if (typeof Request !== 'undefined' && input instanceof Request) {
    const u = input.url
    if (typeof u === 'string' && u.startsWith('/api/')) {
      return new Request(`${API_BASE}${u}`, input)
    }
  }
  return input
}

function pathDeUrl(urlStr) {
  if (!urlStr) return ''
  if (urlStr.startsWith('/')) {
    const q = urlStr.indexOf('?')
    return q === -1 ? urlStr : urlStr.slice(0, q)
  }
  try {
    return new URL(urlStr).pathname
  } catch {
    return ''
  }
}

window.fetch = (input, init = {}) => {
  const resuelto = resolverApiUrl(input)
  const urlStr = typeof resuelto === 'string' ? resuelto : String(resuelto?.url || '')
  const path = pathDeUrl(urlStr)
  const isApi = path.startsWith('/api/')
  const isAuthEndpoint = path.startsWith('/api/auth')

  if (!isApi || isAuthEndpoint) {
    return rawFetch(resuelto, init)
  }

  const token = getToken()
  if (!token) {
    return rawFetch(resuelto, init)
  }

  const headers = new Headers(init?.headers || (typeof resuelto !== 'string' ? resuelto.headers : undefined))
  if (!headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const nextInit = {
    ...init,
    headers,
  }

  return rawFetch(resuelto, nextInit).then((response) => {
    if (response.status === 401) {
      clearSession()
      const next = encodeURIComponent(window.location.pathname + window.location.search)
      if (!window.location.pathname.startsWith('/auth')) {
        window.location.assign(`/auth?next=${next}`)
      }
    }
    return response
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
