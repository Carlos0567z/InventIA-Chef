import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTrash, FaCheckCircle, FaRegCircle, FaUtensilSpoon, FaTrophy, FaShoppingCart } from 'react-icons/fa';
import '../styles/RecetasPendientes.css';
import PageHeader from '../components/PageHeader';
import TicketModal from '../components/TicketModal';

const HECHAS_KEY = 'inventia_recetas_hechas';

const RecetasPendientes = () => {
  const [pendientes, setPendientes] = useState([]);
  const [recetasHechas, setRecetasHechas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [generandoCompra, setGenerandoCompra] = useState(false);
  const [activeTicket, setActiveTicket] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const guardado = localStorage.getItem(HECHAS_KEY);
      if (guardado) {
        const parsed = JSON.parse(guardado);
        setRecetasHechas(Array.isArray(parsed) ? parsed : []);
      }
    } catch (error) {
      console.error('Error al leer recetas hechas:', error);
    }

    const cargarPendientes = async () => {
      try {
        const response = await fetch('/api/recetas-pendientes');
        if (response.ok) {
          const data = await response.json();
          setPendientes(data);
        }
      } catch (error) {
        console.error('Error al cargar pendientes:', error);
      } finally {
        setCargando(false);
      }
    };

    cargarPendientes();
  }, []);

  const guardarRecetasHechas = (next) => {
    setRecetasHechas(next);
    try {
      localStorage.setItem(HECHAS_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('Error al guardar recetas hechas:', error);
    }
  };

  const estaHecha = (idExterno) => recetasHechas.some((receta) => String(receta.id_externo || '') === String(idExterno || ''));

  const eliminarDePendientes = async (id, e) => {
    e.stopPropagation();
    try {
      const response = await fetch(`/api/recetas-pendientes/${id}`, { method: 'DELETE' });
      if (response.ok) {
        setPendientes((prev) => prev.filter((p) => p._id !== id));
        window.dispatchEvent(new Event('pendientes-updated'));
      }
    } catch (error) {
      console.error('Error al eliminar:', error);
    }
  };

  const marcarComoHecha = async (receta, e) => {
    e.stopPropagation();

    const yaHecha = estaHecha(receta.id_externo);
    if (yaHecha) return;

    try {
      const response = await fetch(`/api/recetas-pendientes/${receta._id}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`);
      }

      setPendientes((prev) => prev.filter((p) => p._id !== receta._id));

      const siguiente = [
        {
          ...receta,
          hecha: true,
          fecha_hecha: new Date().toISOString(),
        },
        ...recetasHechas.filter((item) => String(item.id_externo || '') !== String(receta.id_externo || '')),
      ];

      guardarRecetasHechas(siguiente);
      window.dispatchEvent(new Event('pendientes-updated'));
    } catch (error) {
      console.error('Error al marcar como hecha:', error);
    }
  };

  const abrirDetallePendiente = (receta) => {
    const idExterno = String(receta?.id_externo || '');
    if (!idExterno) return;

    const tipo = String(receta?.tipo || '').toLowerCase();
    const destino = tipo === 'ia'
      ? `/recetas-ia/${idExterno}`
      : tipo === 'comunidad'
        ? `/recetas-comunidad/${idExterno}`
        : `/recetas/${idExterno}`;

    navigate(destino, {
      state: {
        receta,
        backPath: '/recetas-pendientes',
      },
    });
  };

  const construirPayloadPendiente = (receta) => ({
    id_externo: String(receta?.id_externo || receta?.id || ''),
    title: receta?.title,
    image: receta?.image,
    readyInMinutes: receta?.readyInMinutes,
    servings: receta?.servings,
    extendedIngredients: receta?.extendedIngredients || [],
    analyzedInstructions: receta?.analyzedInstructions || [],
    tipo: receta?.tipo || 'Spoonacular',
  });

  const volverAPendientes = async (receta, e) => {
    e.stopPropagation();

    try {
      const response = await fetch('/api/recetas-pendientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(construirPayloadPendiente(receta)),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.mensaje || `Error HTTP ${response.status}`);
      }

      const guardada = await response.json();
      setPendientes((prev) => [...prev, guardada]);

      const next = recetasHechas.filter((item) => String(item.id_externo || '') !== String(receta.id_externo || ''));
      guardarRecetasHechas(next);
      window.dispatchEvent(new Event('pendientes-updated'));
    } catch (error) {
      console.error('Error al devolver a pendientes:', error);
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

  const generarCompraInteligente = async () => {
    setGenerandoCompra(true);
    try {
      const response = await fetch('/api/compra-inteligente/generar', { method: 'POST' });
      if (response.ok) {
        const listaOptimizada = await response.json();

        // Armo el objeto ticket como lo espera el modal de la lista
        const articulosFlat = (listaOptimizada.lista || []).flatMap((bloque) => {
          return (bloque.productos || []).map((p) => ({
            nombre: String(p.nombre || ''),
            cantidad: String(p.cantidad_aproximada || '1 unidad'),
            categoria: bloque.categoria || 'Otros',
            emoji: String(p.emoji || ''),
          }));
        });

        const newTicket = {
          _id: listaOptimizada.ticketId,
          titulo: `Lista compra - ${pendientes.length} receta${pendientes.length !== 1 ? 's' : ''}`,
          fecha: new Date().toISOString(),
          articulos: articulosFlat,
        };

        setActiveTicket(newTicket);
      }
    } catch (error) {
      console.error('Error generando compra:', error);
      alert('No pudimos generar la lista ahora.');
    } finally {
      setGenerandoCompra(false);
    }
  };

  if (cargando) {
    return (
      <div className="recetas-pendientes-container">
        <div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>Cargando tus recetas pendientes...</div>
      </div>
    );
  }

  return (
    <div className="recetas-pendientes-container">
      <PageHeader
        kicker="Guardadas"
        title="Recetas Pendientes"
        description="Recetas que te gustaron y quieres tener a mano para cocinar cuando te apetezca."
      >
        {pendientes.length > 0 && (
            <button
              onClick={generarCompraInteligente}
              disabled={generandoCompra}
              className="recetas-pendientes-action recetas-pendientes-generate-btn"
            >
              {generandoCompra ? (
                <>
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>⏳</span>
                  Calculando...
                </>
              ) : (
                <>
                  <FaShoppingCart />
                  Generar lista de compra
                </>
              )}
            </button>
        )}
      </PageHeader>

      <div className="recetas-pendientes-grid">
        {pendientes.length > 0 ? (
          pendientes.map((receta) => (
            <div
              key={receta._id}
              className="recetas-pendientes-card"
              onClick={() => abrirDetallePendiente(receta)}
            >
              <img
                src={receta.image}
                alt={receta.title}
                className="recetas-pendientes-card-image"
              />
              <div className="recetas-pendientes-card-content">
                <h3 className="recetas-pendientes-card-title">{receta.title}</h3>
                
                <div className="recetas-pendientes-card-actions">
                  <button
                    onClick={(e) => marcarComoHecha(receta, e)}
                    type="button"
                    className="btn-card-action btn-hecha"
                  >
                    <FaCheckCircle size={14} />
                    Hecha
                  </button>
                  <button
                    onClick={(e) => eliminarDePendientes(receta._id, e)}
                    type="button"
                    aria-label="Eliminar de pendientes"
                    className="btn-card-action btn-delete-pending"
                  >
                    <FaTrash />
                  </button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="recetas-pendientes-empty">
            <FaUtensilSpoon className="recetas-pendientes-empty-icon" />
            <p className="recetas-pendientes-empty-text">Todavia no tienes recetas pendientes.</p>
            <p className="recetas-pendientes-empty-hint">Anade recetas desde el catalogo para tenerlas listas cuando te apetezca cocinar.</p>
          </div>
        )}
      </div>

      <div className="recetas-pendientes-done-section">
        <div className="recetas-pendientes-done-header">
          <h2>Recetas hechas</h2>
          <p>Recetas que ya cocinaste y quedan guardadas como referencia.</p>
        </div>

        {recetasHechas.length > 0 ? (
          <div className="recetas-pendientes-grid">
            {recetasHechas.map((receta) => (
              <div
                key={`${receta.id_externo}-hecha`}
                className="recetas-pendientes-card hecha"
                onClick={() => abrirDetallePendiente(receta)}
              >
                <div className="recetas-pendientes-card-hecha-overlay" />

                <img
                  src={receta.image}
                  alt={receta.title}
                  className="recetas-pendientes-card-image"
                />
                <div className="recetas-pendientes-card-content">
                  <h3 className="recetas-pendientes-card-title">{receta.title}</h3>
                  <p className="recetas-pendientes-card-meta">
                    Cocinada el {new Date(receta.fecha_hecha || receta.fecha_planificada || Date.now()).toLocaleDateString('es-ES')}
                  </p>
                  
                  <div className="recetas-pendientes-card-actions hechas">
                    <button
                      type="button"
                      onClick={(e) => volverAPendientes(receta, e)}
                      className="btn-card-action btn-undo-pending"
                      title="Volver a pendientes"
                    >
                      <FaRegCircle size={14} />
                      Volver a pendientes
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="recetas-pendientes-empty">
            <FaTrophy className="recetas-pendientes-empty-icon" />
            <p className="recetas-pendientes-empty-text">Todavía no has marcado ninguna receta como hecha.</p>
            <p className="recetas-pendientes-empty-hint">Cuando termines de cocinar una receta, marca la como hecha para guardarla en tu historial.</p>
          </div>
        )}
      </div>

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
};

export default RecetasPendientes;