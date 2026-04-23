import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import { useAuthRefresh } from './hooks/useAuthRefresh'
import { getToken, isAuthenticated, saveSession } from './services/auth'

const Home = lazy(() => import('./pages/Home'))
const Inventario = lazy(() => import('./pages/Inventario'))
const Escaner = lazy(() => import('./pages/Escaner'))
const Recetas = lazy(() => import('./pages/Recetas'))
const RecetasIA = lazy(() => import('./pages/RecetasIA'))
const RecetasComunidad = lazy(() => import('./pages/RecetasComunidad'))
const ContribuirRecetaComunidad = lazy(() => import('./pages/ContribuirRecetaComunidad'))
const MisRecetasComunidad = lazy(() => import('./pages/MisRecetasComunidad'))
const RecetaComunidadDetalle = lazy(() => import('./pages/RecetaComunidadDetalle'))
const RecetaDetalle = lazy(() => import('./pages/RecetaDetalle'))
const Auth = lazy(() => import('./pages/Auth'))
const Usuario = lazy(() => import('./pages/Usuario'))
const Favoritas = lazy(() => import('./pages/Favoritas'))
const Compras = lazy(() => import('./pages/Compras'))
const RecetasPendientes = lazy(() => import('./pages/RecetasPendientes'))
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'))

function RouteFallback() {
  return <div className="route-loading">Cargando…</div>
}

function RequireAuth({ children }) {
  const location = useLocation()
  useAuthRefresh()

  if (!isAuthenticated()) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/auth?next=${next}`} replace />
  }

  return children
}

function RequireAdmin({ children }) {
  const location = useLocation()
  useAuthRefresh()
  const [adminOk, setAdminOk] = useState(null)

  useEffect(() => {
    if (!isAuthenticated()) {
      setAdminOk(false)
      return undefined
    }
    let cancelled = false
    ;(async () => {
      try {
        const token = getToken()
        const res = await fetch('/api/auth/me', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const data = res.ok ? await res.json() : null
        if (cancelled) return
        if (data?.user) saveSession({ user: data.user })
        setAdminOk(String(data?.user?.rol || '').toLowerCase() === 'admin')
      } catch {
        if (!cancelled) setAdminOk(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!isAuthenticated()) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`/auth?next=${next}`} replace />
  }

  if (adminOk === null) {
    return null
  }

  if (!adminOk) {
    return <Navigate to="/" replace />
  }

  return children
}

function App() {
  return (
    <BrowserRouter>
      <AppLayout />
    </BrowserRouter>
  )
}

function AppLayout() {
  useEffect(() => {
    if (!isAuthenticated()) return undefined
    let cancelled = false
    ;(async () => {
      try {
        const token = getToken()
        const res = await fetch('/api/auth/me', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!data?.user || cancelled) return
        saveSession({ user: data.user })
      } catch {
        /* sesion en localStorage */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">Saltar al contenido principal</a>
      <Sidebar />
      <main id="main-content" className="app-main" tabIndex={-1}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/despensa" element={<RequireAuth><Inventario /></RequireAuth>} />
            <Route path="/escaner" element={<RequireAuth><Escaner /></RequireAuth>} />
            <Route path="/recetas" element={<RequireAuth><Recetas /></RequireAuth>} />
            <Route
              path="/recetas/:id"
              element={<RequireAuth><RecetaDetalle apiBase="/api/recetas" backPath="/recetas" /></RequireAuth>}
            />
            <Route path="/recetas-ia" element={<RequireAuth><RecetasIA /></RequireAuth>} />
            <Route
              path="/recetas-ia/:id"
              element={<RequireAuth><RecetaDetalle apiBase="/api/recetas-ia" backPath="/recetas-ia" /></RequireAuth>}
            />
            <Route path="/recetas-comunidad" element={<RequireAuth><RecetasComunidad /></RequireAuth>} />
            <Route path="/recetas-comunidad/contribuir" element={<RequireAuth><ContribuirRecetaComunidad /></RequireAuth>} />
            <Route path="/recetas-comunidad/mis-recetas" element={<RequireAuth><MisRecetasComunidad /></RequireAuth>} />
            <Route
              path="/recetas-comunidad/:id"
              element={<RequireAuth><RecetaComunidadDetalle /></RequireAuth>}
            />
            <Route
              path="/favoritas"
              element={<RequireAuth><Favoritas /></RequireAuth>}
            />
            <Route
              path="/favoritas/:id"
              element={<RequireAuth><RecetaDetalle apiBase="/api/favoritos" backPath="/favoritas" /></RequireAuth>}
            />
            <Route
              path="/historial"
              element={<RequireAuth><Compras /></RequireAuth>}
            />
            <Route
              path="/compra-inteligente"
              element={<RequireAuth><Compras /></RequireAuth>}
            />
            <Route
              path="/recetas-pendientes"
              element={<RequireAuth><RecetasPendientes /></RequireAuth>}
            />
            <Route
              path="/perfil"
              element={<RequireAuth><Usuario /></RequireAuth>}
            />
            <Route
              path="/alergias"
              element={<Navigate to="/perfil" replace />}
            />
            <Route
              path="/admin"
              element={<RequireAdmin><AdminDashboard /></RequireAdmin>}
            />
            <Route path="/auth" element={<Auth />} />
          </Routes>
        </Suspense>
      </main>
    </div>
  )
}

export default App
