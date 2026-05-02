import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FiShoppingCart, FiHeart, FiUser, FiHome, FiBox, FiCamera, FiLayout, FiUsers } from 'react-icons/fi';
import '../styles/navigation.css';
import { useAuthRefresh } from '../hooks/useAuthRefresh';
import { isAdmin } from '../services/auth';

const Sidebar = () => {
  useAuthRefresh();
  const location = useLocation();
  const rutaActual = location.pathname;
  const admin = isAdmin();
  const mostrarDetalleRecetas = admin;
  const [menuRecetasAbierto, setMenuRecetasAbierto] = useState(false);
  const menuRecetasRef = useRef(null);

  const recetasItems = [
    { nombre: 'Recetas clásicas', ruta: '/recetas', descripcion: 'Recetas del catálogo principal' },
    { nombre: 'Chef IA', ruta: '/recetas-ia', descripcion: 'Ideas con IA a partir de tu despensa' },
    { nombre: 'Comunidad', ruta: '/recetas-comunidad', descripcion: 'Recetas publicadas por otros usuarios' },
    { nombre: 'Pendientes', ruta: '/recetas-pendientes', descripcion: 'Recetas guardadas para cocinar después' },
  ];

  const comprasItems = [
    { nombre: 'Lista de compra', ruta: '/compra-inteligente', icono: 'fa-shopping-cart' },
    { nombre: 'Historial de Compras', ruta: '/historial', icono: 'fa-receipt' },
  ];

  const perfilItem = { nombre: 'Perfil', ruta: '/perfil', icono: 'fa-user' };

  const despensaItems = [
    { nombre: 'Despensa', ruta: '/despensa' },
    { nombre: 'Escanear', ruta: '/escaner' },
  ];
  const favoritosItem = { nombre: 'Mis Favoritas', ruta: '/favoritas' };

  const isActive = (ruta) => {
    // comprobamos la ruta para poner la clase active en el menu
    if (ruta === '/' && rutaActual === '/') return true;
    if (ruta !== '/' && rutaActual.startsWith(ruta)) return true;
    return false;
  };

  const isExactActive = (ruta) => rutaActual === ruta;

  const tieneRecetaActiva = recetasItems.some((item) => isExactActive(item.ruta));

  // en movil /recetas-comunidad no debe marcar como activa la pestaña Recetas del bottom bar
  const isMobileRecetasTabActive =
    rutaActual.startsWith('/recetas') && !rutaActual.startsWith('/recetas-comunidad');

  useEffect(() => {
    // cerramos el menu si cambia la ruta
    setMenuRecetasAbierto(false);
  }, [rutaActual]);

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!menuRecetasRef.current) return;
      if (!menuRecetasRef.current.contains(event.target)) {
        setMenuRecetasAbierto(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMenuRecetasAbierto(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  return (
    <>
      <header className="top-header">
        <div className="top-header-inner">
          <Link to="/" className="top-brand" aria-label="Ir al inicio de InventIA Chef">
            <i className="fa-solid fa-kitchen-set" />
            <div>
              <strong>InventIA Chef</strong>
              <span>Despensa y recetas</span>
            </div>
          </Link>

          <div className="top-left-group">
            <nav className="top-nav" aria-label="Navegación principal">
              {despensaItems.map((item) => {
                const activo = isActive(item.ruta);
                return (
                  <Link
                    key={item.ruta}
                    to={item.ruta}
                    className={activo ? 'menu-title nav-link active' : 'menu-title nav-link'}
                    aria-current={activo ? 'page' : undefined}
                  >
                    {item.nombre}
                  </Link>
                );
              })}

              {recetasItems.length > 0 && (
                <div ref={menuRecetasRef} className={menuRecetasAbierto ? 'menu-section open' : 'menu-section'}>
                  <button
                    type="button"
                    className={tieneRecetaActiva ? 'menu-title recipes-trigger active' : 'menu-title recipes-trigger'}
                    aria-haspopup="true"
                    aria-expanded={menuRecetasAbierto}
                    aria-controls="menu-recetas-dropdown"
                    onClick={() => setMenuRecetasAbierto((prev) => !prev)}
                  >
                    Recetas
                    <i className="fa-solid fa-chevron-down" />
                  </button>

                  <div id="menu-recetas-dropdown" className="menu-dropdown recipes-dropdown" role="menu" aria-label="Submenu de recetas">
                    {mostrarDetalleRecetas && (
                      <div className="recipes-dropdown-header">
                        <p className="recipes-dropdown-title">Explorar recetas</p>
                        <p className="recipes-dropdown-subtitle">Elige la fuente que quieres consultar</p>
                      </div>
                    )}
                    {recetasItems.map((item) => {
                      const activo = isExactActive(item.ruta);
                      return (
                        <Link
                          key={item.ruta}
                          to={item.ruta}
                          onClick={() => setMenuRecetasAbierto(false)}
                          className={activo ? 'dropdown-link active' : 'dropdown-link'}
                          aria-current={activo ? 'page' : undefined}
                          role="menuitem"
                        >
                          <span className="dropdown-link-title">{item.nombre}</span>
                          {mostrarDetalleRecetas && (
                            <span className="dropdown-link-subtitle">{item.descripcion}</span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {admin && (
                <Link
                  to="/admin"
                  className={isActive('/admin') ? 'menu-title nav-link active' : 'menu-title nav-link'}
                  aria-current={isActive('/admin') ? 'page' : undefined}
                >
                  Administración
                </Link>
              )}
            </nav>
          </div>

          <div className="top-right-group" aria-label="Accesos rápidos">
            <Link
              to={comprasItems[0].ruta}
              className={isActive('/compra-inteligente') || isActive('/historial') ? 'menu-title icon-only nav-icon-link active' : 'menu-title icon-only nav-icon-link'}
              aria-label="Compras"
            >
              <FiShoppingCart size={18} strokeWidth={2.5} />
            </Link>

            <Link
              to={favoritosItem.ruta}
              className={isActive(favoritosItem.ruta) ? 'menu-title icon-only nav-icon-link active' : 'menu-title icon-only nav-icon-link'}
              aria-label={favoritosItem.nombre}
            >
              <FiHeart size={18} strokeWidth={2.5} />
            </Link>

            <Link
              to={perfilItem.ruta}
              className={isActive(perfilItem.ruta) ? 'menu-title icon-only nav-icon-link active' : 'menu-title icon-only nav-icon-link'}
              aria-label={perfilItem.nombre}
            >
              <FiUser size={18} strokeWidth={2.5} />
            </Link>
          </div>
        </div>
      </header>

      {/* Barra de Navegacion Inferior para Movil (Estilo App) */}
      <nav className="mobile-tab-bar" aria-label="Navegación móvil">
        <Link to="/" className={isActive('/') && rutaActual === '/' ? 'tab-item active' : 'tab-item'}>
          <FiHome />
          <span>Inicio</span>
        </Link>
        <Link to="/despensa" className={isActive('/despensa') ? 'tab-item active' : 'tab-item'}>
          <FiBox />
          <span>Despensa</span>
        </Link>
        <Link to="/escaner" className={isActive('/escaner') ? 'tab-item scanner-btn active' : 'tab-item scanner-btn'}>
          <FiCamera />
          <span>Escanear</span>
        </Link>
        <Link to="/recetas" className={isMobileRecetasTabActive ? 'tab-item active' : 'tab-item'}>
          <FiLayout />
          <span>Recetas</span>
        </Link>
        <Link to="/recetas-comunidad" className={isActive('/recetas-comunidad') ? 'tab-item active' : 'tab-item'}>
          <FiUsers />
          <span>Chef Hub</span>
        </Link>
      </nav>
    </>
  );
};

export default Sidebar;
