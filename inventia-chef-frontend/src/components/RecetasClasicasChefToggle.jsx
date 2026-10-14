import { Link, useLocation } from 'react-router-dom';
import '../styles/pageTabs.css';

export default function RecetasClasicasChefToggle() {
  const { pathname } = useLocation();
  if (pathname.includes('/recetas-comunidad')) return null;

  const esChefIa = pathname.startsWith('/recetas-ia');

  return (
    <nav
      className="page-tabs recetas-chef-toggle"
      aria-label="Ver recetas clásicas o Chef IA"
    >
      <Link to="/recetas" className={!esChefIa ? 'page-tab active' : 'page-tab'}>
        Recetas clásicas
      </Link>
      <Link to="/recetas-ia" className={esChefIa ? 'page-tab active' : 'page-tab'}>
        Chef IA
      </Link>
    </nav>
  );
}
