import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FaSync, FaTrash, FaClock, FaUsers } from 'react-icons/fa';
import TicketModal from '../components/TicketModal';
import '../styles/Recetas.css';
import '../styles/CompraInteligente.css';
import '../styles/pageTabs.css';

const SECCIONES_ESTANDAR = [
  'Fruteria y Verduleria',
  'Carniceria',
  'Pescaderia',
  'Lacteos y Huevos',
  'Panaderia',
  'Despensa y Conservas',
  'Congelados',
  'Bebidas',
  'Otros',
];

export default function CompraInteligente({ embedded = false } = {}) {
  const [pendientes, setPendientes] = useState([]);
  const [activeTicket, setActiveTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState(null);
  const location = useLocation();
  const activeTab = location.pathname === '/historial' ? 'historial' : 'compra';

  useEffect(() => {
    // Si venimos de un navigate con un ticket, lo abrimos.
    if (location.state?.ticketId && location.state?.lista) {
      const articulosFlat = (location.state.lista || []).flatMap((bloque) => {
        return (bloque.productos || []).map((p) => ({
          nombre: String(p.nombre || ''),
          cantidad: String(p.cantidad_aproximada || '1 unidad'),
          categoria: bloque.categoria || 'Otros',
          emoji: String(p.emoji || ''),
        }));
      });

      setActiveTicket({
        _id: location.state.ticketId,
        titulo: `Lista compra - ${pendientes.length} receta${pendientes.length !== 1 ? 's' : ''}`,
        fecha: new Date().toISOString(),
        articulos: articulosFlat,
      });
      setError(null);
    }
    fetchPendientes();
  }, [location.state, pendientes.length]);

  const fetchPendientes = async () => {
    try {
      const res = await fetch('/api/recetas-pendientes');
      const data = await res.json();
      setPendientes(data);
    } catch (error) {
      console.error('Error al cargar pendientes:', error);
    } finally {
      setLoading(false);
    }
  };

  const removePendiente = async (id) => {
    try {
      await fetch(`/api/recetas-pendientes/${id}`, { method: 'DELETE' });
      setPendientes(pendientes.filter(p => p._id !== id));
      window.dispatchEvent(new Event('pendientes-updated'));
    } catch (error) {
      console.error('Error al eliminar del plan:', error);
    }
  };

  const generarLista = async () => {
    setGenerando(true);
    setError(null);
    try {
      const res = await fetch('/api/compra-inteligente/generar', { method: 'POST' });
      const data = await res.json();
      
      if (data.mensaje) {
        setError(data.mensaje);
        setActiveTicket(null);
      } else {
        const lista = Array.isArray(data) ? data : (Array.isArray(data.lista) ? data.lista : []);
        
        const articulosFlat = lista.flatMap((bloque) => {
          return (bloque.productos || []).map((p) => ({
            nombre: String(p.nombre || ''),
            cantidad: String(p.cantidad_aproximada || '1 unidad'),
            categoria: bloque.categoria || 'Otros',
            emoji: String(p.emoji || ''),
          }));
        });

        setActiveTicket({
          _id: data.ticketId,
          titulo: `Lista compra - ${pendientes.length} receta${pendientes.length !== 1 ? 's' : ''}`,
          fecha: new Date().toISOString(),
          articulos: articulosFlat,
        });
      }
    } catch (error) {
      console.error('Error al generar la lista de compra:', error);
      setError('No se pudo preparar la lista');
    } finally {
      setGenerando(false);
    }
  };

  const actualizarTicket = async (ticketActualizado) => {
    setActiveTicket(ticketActualizado);
    if (!ticketActualizado._id) return;
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

  if (loading) {
    return <div className="compra-loading">Cargando...</div>;
  }

  return (
    <div className="compra-page">
      {!embedded && (
        <nav className="page-tabs" aria-label="Secciones de compras">
          <Link to="/compra-inteligente" className={activeTab === 'compra' ? 'page-tab active' : 'page-tab'}>
            Lista de compra
          </Link>
          <Link to="/historial" className={activeTab === 'historial' ? 'page-tab active' : 'page-tab'}>
            Historial
          </Link>
        </nav>
      )}

      <h1 className="compra-title">Gestión de compras</h1>
      <p className="compra-subtitle">
        Usa las pestanas para alternar entre la lista y el historial de tickets.
      </p>

      <section className="compra-section">
        <h2 className="compra-section-title">
          Recetas Seleccionadas
        </h2>

        {pendientes.length === 0 ? (
          <div className="compra-empty-state">
            <p className="compra-empty-title">
              Todavia no tienes recetas seleccionadas
            </p>
            <p className="compra-empty-text">
              Ve a "Recetas sugeridas" y usa la acción de añadir para traerlas aquí
            </p>
          </div>
        ) : (
          <div className="recetas-grid">
            {pendientes.map((receta) => {
              const imagen = receta.image || 'https://via.placeholder.com/600x400?text=Receta';
              return (
              <div key={receta._id} className="receta-card compra-pendiente-card">
                <button
                  onClick={() => removePendiente(receta._id)}
                  className="compra-remove-btn"
                  title="Quitar de la lista"
                  type="button"
                >
                  <FaTrash size={12} />
                </button>
                <img src={imagen} alt={receta.title} className="receta-image" />
                <h3>{receta.title}</h3>
                <div className="compra-card-meta">
                  {receta.readyInMinutes && <p><FaClock /> {receta.readyInMinutes} min</p>}
                  {receta.servings && <p><FaUsers /> {receta.servings} porciones</p>}
                </div>
              </div>
              );
            })}
          </div>
        )}

        {pendientes.length > 0 && (
          <div className="compra-action-bar">
            <span>
              <strong>{pendientes.length}</strong> receta{pendientes.length !== 1 ? 's' : ''} para cocinar
            </span>
            <button
              onClick={generarLista}
              disabled={generando}
              className="compra-generate-btn"
              type="button"
            >
              <FaSync size={14} className={generando ? 'spin' : ''} />
              {generando ? 'Generando...' : 'Generar lista de compra'}
            </button>
          </div>
        )}

      </section>

      {error && (
        <div className="compra-error">
          {error}
        </div>
      )}

      {activeTicket && (
        <TicketModal
          ticket={activeTicket}
          onClose={() => setActiveTicket(null)}
          onUpdateTicket={actualizarTicket}
          permitirEdicion={true}
        />
      )}
    </div>
  );
}
