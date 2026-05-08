import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaDownload, FaTimes, FaTrash } from 'react-icons/fa';
import TicketModal from '../components/TicketModal';
import '../styles/Historial.css';
import '../styles/pageTabs.css';

const Historial = ({ embedded = false } = {}) => {
  const location = useLocation();
  const activeTab = location.pathname === '/historial' ? 'historial' : 'compra';
  const [tickets, setTickets] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [ticketActivo, setTicketActivo] = useState(null);
  const [borrandoHistorial, setBorrandoHistorial] = useState(false);

  useEffect(() => {
    const cargarHistorial = async () => {
      try {
        const response = await fetch('/api/historial');
        if (response.ok) {
          const data = await response.json();
          setTickets(data);
        }
      } catch (error) {
        console.error('Error al cargar el historial:', error);
      } finally {
        setCargando(false);
      }
    };

    cargarHistorial();
  }, []);

  const formatearFecha = (cadenaFecha) => {
    const opciones = { day: '2-digit', month: 'long', year: 'numeric' };
    return new Date(cadenaFecha).toLocaleDateString('es-ES', opciones);
  };

  const actualizarTicket = async (ticketActualizado) => {
    setTicketActivo(ticketActualizado);
    // actualizo la lista en memoria
    setTickets((prev) => prev.map((t) => t._id === ticketActualizado._id ? ticketActualizado : t));
    try {
      await fetch(`/api/historial/${ticketActualizado._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: ticketActualizado.titulo,
          articulos: ticketActualizado.articulos,
        }),
      });
    } catch (error) {
      console.error('Error al actualizar ticket:', error);
    }
  };

  const borrarHistorial = async () => {
    const confirmado = window.confirm('Vas a borrar todo el historial de compras. Esta acción no se puede deshacer.');
    if (!confirmado) return;

    setBorrandoHistorial(true);
    try {
      const response = await fetch('/api/historial', { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`);
      }

      setTickets([]);
      setTicketActivo(null);
    } catch (error) {
      console.error('Error al borrar historial:', error);
    } finally {
      setBorrandoHistorial(false);
    }
  };

  const historialShellClass = embedded ? 'historial-embed' : 'view-section active';
  const HistorialShell = embedded ? 'div' : 'section';

  if (cargando) {
    return (
      <HistorialShell className={historialShellClass}>
        <div className="card historial-loading-card">
          Cargando tus tickets...
        </div>
      </HistorialShell>
    );
  }

  return (
    <HistorialShell className={historialShellClass}>
      {!embedded && (
        <nav className="page-tabs" aria-label="Secciones de compras">
          <Link to="/compra-inteligente" className={activeTab === 'compra' ? 'page-tab active' : 'page-tab'}>
            <FaDownload />
            Lista de compra
          </Link>
          <Link to="/historial" className={activeTab === 'historial' ? 'page-tab active' : 'page-tab'}>
            <FaTrash />
            Historial
          </Link>
        </nav>
      )}

      <div className="view-header">
        <div className="view-title">
          <h1>Historial de Tickets</h1>
          <p>Registro de listas manuales y las que arma el planificador.</p>
        </div>
        {tickets.length > 0 && (
          <button
            type="button"
            className="historial-clear-btn"
            onClick={borrarHistorial}
            disabled={borrandoHistorial}
          >
            <FaTrash />
            {borrandoHistorial ? 'Borrando...' : 'Borrar historial'}
          </button>
        )}
      </div>

      <div className="historial-list">
        {tickets.length > 0 ? (
          tickets.map((ticket) => (
            <article key={ticket._id} className="card historial-ticket-card">
              <div className="historial-ticket-main">
                <h3 className="historial-ticket-title">
                  {ticket.titulo}
                </h3>
                <div className="historial-ticket-meta">
                  <span className="historial-ticket-date">
                    {formatearFecha(ticket.fecha)}
                  </span>
                  {ticket.tipo === 'ticket_ia' && (
                    <span className="historial-ticket-badge">
                      Lista sugerida
                    </span>
                  )}
                </div>
              </div>

              <div className="historial-ticket-side">
                {ticket.tipo === 'ticket_ia' ? (
                  <div className="historial-ticket-amount historial-ticket-items">
                    {(ticket.articulos || []).length} productos
                  </div>
                ) : (
                  <div className="historial-ticket-amount">
                    {Number(ticket.total || 0).toFixed(2)} EUR
                  </div>
                )}
                <button
                  className="historial-link-btn"
                  onClick={() => setTicketActivo(ticket)}
                  type="button"
                >
                  Ver ticket completo
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="historial-empty">
            <p>Todavia no hay tickets.</p>
          </div>
        )}
      </div>

      {ticketActivo && (
        <TicketModal
          ticket={ticketActivo}
          onClose={() => setTicketActivo(null)}
          onUpdateTicket={actualizarTicket}
          permitirEdicion={ticketActivo.tipo === 'ticket_ia'}
        />
      )}
    </HistorialShell>
  );
};

export default Historial;
