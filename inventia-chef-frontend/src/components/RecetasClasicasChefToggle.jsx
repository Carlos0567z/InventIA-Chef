import { Link, useLocation } from 'react-router-dom';
import { FaBook, FaUtensils, FaUsers, FaBookmark } from 'react-icons/fa';
import '../styles/pageTabs.css';

export default function RecetasClasicasChefToggle() {
  const { pathname } = useLocation();

  const isClasicas =
    pathname === '/recetas' ||
    (pathname.startsWith('/recetas/') &&
      !pathname.startsWith('/recetas-ia') &&
      !pathname.startsWith('/recetas-comunidad') &&
      !pathname.startsWith('/recetas-pendientes'));

  const isChefIa = pathname.startsWith('/recetas-ia');
  const isComunidad = pathname.startsWith('/recetas-comunidad') || pathname.startsWith('/cocinero');
  const isPendientes = pathname.startsWith('/recetas-pendientes');

  const tabs = [
    { to: '/recetas', label: 'Recetas clásicas', icon: <FaBook />, active: isClasicas },
    { to: '/recetas-ia', label: 'Chef IA', icon: <FaUtensils />, active: isChefIa },
    { to: '/recetas-comunidad', label: 'Comunidad', icon: <FaUsers />, active: isComunidad },
    { to: '/recetas-pendientes', label: 'Guardadas / Pendientes', icon: <FaBookmark />, active: isPendientes },
  ];

  return (
    <nav
      className="page-tabs recetas-chef-toggle"
      aria-label="Navegación de secciones de recetas"
    >
      {tabs.map((tab) => (
        <Link
          key={tab.to}
          to={tab.to}
          className={`page-tab ${tab.active ? 'active' : ''}`}
          aria-current={tab.active ? 'page' : undefined}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
