import { Link, useLocation } from 'react-router-dom';
import CompraInteligente from './CompraInteligente';
import Historial from './Historial';
import '../styles/pageTabs.css';

const Compras = () => {
  const location = useLocation();
  const activeTab = location.pathname === '/historial' ? 'historial' : 'compra';

  return (
    <div className="view-section active compras-shell">
      <nav className="page-tabs" aria-label="Secciones de compras">
        <Link to="/compra-inteligente" className={activeTab === 'compra' ? 'page-tab active' : 'page-tab'}>
          Lista de compra
        </Link>
        <Link to="/historial" className={activeTab === 'historial' ? 'page-tab active' : 'page-tab'}>
          Historial
        </Link>
      </nav>

      {activeTab === 'compra' ? <CompraInteligente embedded /> : <Historial embedded />}
    </div>
  );
};

export default Compras;
