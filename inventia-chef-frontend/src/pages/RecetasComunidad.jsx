import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaHeart,
  FaRegHeart,
  FaCalendarPlus,
  FaCalendarCheck,
  FaPlus,
  FaClock,
  FaCheckCircle,
  FaExclamationCircle,
} from 'react-icons/fa';
import '../styles/Recetas.css';
import FilterBar from '../components/FilterBar';
import PageHeader from '../components/PageHeader';
import { isAuthenticated } from '../services/auth';
import { listRecetasComunidad } from '../services/communityApi';

export default function RecetasComunidad() {
  const navigate = useNavigate();
  const [recetas, setRecetas] = useState([]);
  const [favoritos, setFavoritos] = useState({});
  const [pendientes, setPendientes] = useState({});
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTiempo, setFiltroTiempo] = useState(0);
  const [orden, setOrden] = useState('mejor-match');
  const [inventarioNombres, setInventarioNombres] = useState([]);
  // la barra de filtros ya trae el ancla y lo del sticky

  const normalizarTipo = (tipo) => {
    const t = String(tipo || '').trim().toLowerCase();
    if (t === 'ia') return 'IA';
    if (t === 'comunidad') return 'Comunidad';
    return 'Spoonacular';
  };

  const obtenerClaveReceta = (receta) => String(receta?.id_externo || receta?.id || receta?._id || '');

  const cargarRecetas = async () => {
    try {
      const data = await listRecetasComunidad();
      setRecetas(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error al cargar recetas de comunidad:', error);
      setRecetas([]);
    } finally {
      setCargando(false);
    }
  };

  const cargarInventario = async () => {
    try {
      const response = await fetch('/api/alimentos');
      if (response.ok) {
        const data = await response.json();
        const nombres = data.map((item) => normalizarTextoIngrediente(item.nombre)).filter(Boolean);
        setInventarioNombres(nombres);
      }
    } catch (error) {
      console.error('Error al cargar inventario para comunidad:', error);
    }
  };

  const sincronizarFavoritos = async () => {
    try {
      const response = await fetch('/api/favoritos');
      if (!response.ok) return;

      const data = await response.json();
      const mapa = {};
      data
        .filter((fav) => normalizarTipo(fav.tipo) === 'Comunidad')
        .forEach((fav) => {
          const key = String(fav.id_externo || '');
          if (key) mapa[key] = fav._id;
        });
      setFavoritos(mapa);
    } catch (error) {
      console.error('Error al sincronizar favoritos comunidad:', error);
    }
  };

  const sincronizarPendientes = async () => {
    try {
      const response = await fetch('/api/recetas-pendientes');
      if (!response.ok) return;

      const data = await response.json();
      const mapa = {};
      data
        .filter((p) => normalizarTipo(p.tipo) === 'Comunidad')
        .forEach((pendiente) => {
          const key = String(pendiente.id_externo || '');
          if (key) mapa[key] = pendiente._id;
        });
      setPendientes(mapa);
    } catch (error) {
      console.error('Error al sincronizar pendientes comunidad:', error);
    }
  };

  useEffect(() => {
    cargarRecetas();
    cargarInventario();
    sincronizarFavoritos();
    sincronizarPendientes();
  }, []);

  useEffect(() => {
    const actualizarFavoritos = () => sincronizarFavoritos();
    window.addEventListener('favoritos-updated', actualizarFavoritos);
    return () => window.removeEventListener('favoritos-updated', actualizarFavoritos);
  }, []);

  useEffect(() => {
    const actualizarPendientes = () => sincronizarPendientes();
    window.addEventListener('pendientes-updated', actualizarPendientes);
    return () => window.removeEventListener('pendientes-updated', actualizarPendientes);
  }, []);

  // el panel fijo al hacer scroll lo gestiona la misma barra de filtros

  const normalizarTextoIngrediente = (texto) => String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const extraerTextoReceta = (receta) => {
    const ingredientes = (Array.isArray(receta?.extendedIngredients) ? receta.extendedIngredients : [])
      .map((ing) => String(ing?.original || ing?.name || '').trim())
      .filter(Boolean)
      .join(' ');

    return `${receta?.title || ''} ${ingredientes}`.toLowerCase();
  };

  const calcularEstadisticasIngredientes = (receta) => {
    const ingredientes = Array.isArray(receta.extendedIngredients) ? receta.extendedIngredients : [];
    let tienes = 0;
    let faltan = 0;

    ingredientes.forEach((ing) => {
      const texto = normalizarTextoIngrediente(ing.original || ing.name || '');
      if (!texto) return;

      const esOpcional = /^opcional\s*:/i.test(texto);
      const textoLimpio = esOpcional ? texto.replace(/^opcional\s*:/i, '').trim() : texto;

      const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const enDespensa = inventarioNombres.some((item) => {
        if (!item || !textoLimpio) return false;
        const itemRe = new RegExp(`\\b${escapeRegExp(item)}\\b`, 'i');
        const textoRe = new RegExp(`\\b${escapeRegExp(textoLimpio)}\\b`, 'i');
        return itemRe.test(textoLimpio) || textoRe.test(item);
      });

      if (enDespensa) {
        tienes++;
      } else if (!esOpcional) {
        faltan++;
      }
    });

    return { tienes, faltan };
  };

  const getTiempo = (receta) => Number(receta?.readyInMinutes) || 0;

  const { minTime, maxTime } = useMemo(() => {
    if (!recetas.length) return { minTime: 0, maxTime: 120 };
    const times = recetas.map(r => getTiempo(r)).filter(t => t > 0);
    if (!times.length) return { minTime: 0, maxTime: 120 };
    return { minTime: Math.min(...times), maxTime: Math.max(...times) };
  }, [recetas]);

  // tiempo max por defecto
  useEffect(() => {
    if (filtroTiempo === 0 && maxTime > 0) {
      setFiltroTiempo(maxTime);
    }
  }, [maxTime]);

  const recetasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    let filtradas = recetas.filter((receta) => {
      const tiempo = getTiempo(receta);

      if (texto && !extraerTextoReceta(receta).includes(texto)) return false;
      if (filtroTiempo > 0 && tiempo > filtroTiempo) return false;

      return true;
    });

    if (orden === 'mejor-match') {
      filtradas = [...filtradas].sort((a, b) => {
        const statsA = calcularEstadisticasIngredientes(a);
        const statsB = calcularEstadisticasIngredientes(b);
        
        // Priorizar mayor cantidad de ingredientes que "tenemos"
        if (statsB.tienes !== statsA.tienes) {
          return statsB.tienes - statsA.tienes;
        }
        // A igual cantidad de "tienes", priorizar menos "faltantes"
        return statsA.faltan - statsB.faltan;
      });
    } else if (orden === 'rapidez') {
      filtradas = [...filtradas].sort((a, b) => getTiempo(a) - getTiempo(b));
    } else if (orden === 'relevancia') {
      filtradas = [...filtradas].sort((a, b) => new Date(b.fecha_publicacion) - new Date(a.fecha_publicacion));
    }

    return filtradas;
  }, [recetas, busqueda, filtroTiempo, orden]);

  const resetFiltros = () => {
    setBusqueda('');
    setFiltroTiempo('');
    setOrden('relevancia');
  };

  const toggleFavorito = async (event, receta) => {
    event.stopPropagation();
    event.preventDefault();

    const key = obtenerClaveReceta(receta);
    if (!key) return;

    const favoritoId = favoritos[key];

    try {
      if (favoritoId) {
        const deleteResponse = await fetch(`/api/favoritos/${favoritoId}`, { method: 'DELETE' });
        if (!deleteResponse.ok) throw new Error(`Error HTTP ${deleteResponse.status}`);

        setFavoritos((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } else {
        const payload = {
          id_externo: key,
          title: receta.title,
          image: receta.image,
          readyInMinutes: receta.readyInMinutes,
          servings: receta.servings,
          extendedIngredients: receta.extendedIngredients || [],
          analyzedInstructions: receta.analyzedInstructions || [],
          tipo: 'Comunidad',
        };

        const response = await fetch('/api/favoritos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`Error HTTP ${response.status}`);

        const guardado = await response.json();
        setFavoritos((prev) => ({ ...prev, [key]: guardado._id }));
      }

      window.dispatchEvent(new Event('favoritos-updated'));
    } catch (error) {
      console.error('Error al alternar favorito comunidad:', error);
      alert(error.message || 'No se pudo actualizar favoritos.');
    }
  };

  const togglePendiente = async (event, receta) => {
    event.stopPropagation();
    event.preventDefault();

    const key = obtenerClaveReceta(receta);
    if (!key) return;

    const pendienteId = pendientes[key];

    try {
      if (pendienteId) {
        const deleteResponse = await fetch(`/api/recetas-pendientes/${pendienteId}`, { method: 'DELETE' });
        if (!deleteResponse.ok) throw new Error(`Error HTTP ${deleteResponse.status}`);

        setPendientes((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
      } else {
        const payload = {
          id_externo: key,
          title: receta.title,
          image: receta.image,
          readyInMinutes: receta.readyInMinutes,
          servings: receta.servings,
          extendedIngredients: receta.extendedIngredients || [],
          analyzedInstructions: receta.analyzedInstructions || [],
          tipo: 'Comunidad',
        };

        const response = await fetch('/api/recetas-pendientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          if (error.mensaje && error.mensaje.includes('duplicate')) {
            window.dispatchEvent(new Event('pendientes-updated'));
            return;
          }
          throw new Error(error.mensaje || `Error HTTP ${response.status}`);
        }

        const saved = await response.json();
        setPendientes((prev) => ({ ...prev, [key]: saved._id }));
      }

      window.dispatchEvent(new Event('pendientes-updated'));
    } catch (error) {
      console.error('Error al alternar pendiente comunidad:', error);
      alert(error.message || 'No se pudo actualizar pendientes.');
    }
  };

  const renderHero = () => (
    <PageHeader
      kicker="Recetas Comunidad"
      title="Recetas de la comunidad"
      description="Recetas hechas por otros usuarios. Descubre ideas nuevas, guarda las que te gusten y prueba algo distinto."
    >
      <div className="page-hero-stats">
        <div>
          <strong>{recetas.length}</strong>
          <span>Sugerencias</span>
        </div>
        <div>
          <strong>{Object.keys(pendientes).length}</strong>
          <span>Pendientes</span>
        </div>
        <div>
          <strong>{Object.keys(favoritos).length}</strong>
          <span>Favoritas</span>
        </div>
      </div>
    </PageHeader>
  );

  const renderActionsBar = () => (
    <div className="recetas-actions-bar recetas-actions-bar-community">
      <button
        type="button"
        className="action-btn contribute-btn"
        onClick={() => {
          if (isAuthenticated()) {
            navigate('/recetas-comunidad/contribuir');
          } else {
            navigate('/auth?next=/recetas-comunidad/contribuir');
          }
        }}
      >
        <FaPlus /> Publicar receta
      </button>
    </div>
  );

  const renderFiltros = () => (
    <FilterBar
      idPrefix="recetas-comunidad"
      searchValue={busqueda}
      onSearchChange={setBusqueda}
      placeholder="Buscar recetas..."
      sliders={[{
        id: 'recetas-comunidad-tiempo-slider',
        label: 'Tiempo máximo',
        min: minTime,
        max: maxTime,
        value: filtroTiempo || maxTime,
        onChange: setFiltroTiempo,
        unit: 'min',
      }]}
      selects={[{
        id: 'recetas-comunidad-orden',
        value: orden,
        onChange: (v) => setOrden(v),
        srLabel: 'Ordenar por',
        neutralValue: 'mejor-match',
        options: [
          { value: 'mejor-match', label: 'Orden: mejor match (Ingredientes)' },
          { value: 'relevancia', label: 'Orden: más recientes' },
          { value: 'rapidez', label: 'Orden: más rápidas' },
        ],
      }]}
      ariaLabel="Filtros de comunidad"
    />
  );

  if (cargando) {
    return (
      <section className="view-section active recetas-container">
        {renderHero()}
        {renderActionsBar()}
        {renderFiltros()}
        <div className="loading">
          <h2>Cargando aportaciones de la comunidad...</h2>
        </div>
      </section>
    );
  }

  return (
    <section className="view-section active recetas-container">
      {renderHero()}
      {renderActionsBar()}
      {renderFiltros()}

      {recetasFiltradas.length === 0 && recetas.length > 0 ? (
            <div className="empty-state recetas-filters-empty">
              <h2>No hay recetas con esos filtros</h2>
              <p>Prueba a ampliar el tiempo o buscar por otro ingrediente.</p>
              <button
                type="button"
                className="action-btn"
                onClick={resetFiltros}
                style={{ marginTop: '14px' }}
              >
                Reestablecer filtros
              </button>
            </div>
          ) : recetas.length === 0 ? (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <h2>Aun no hay recetas de la comunidad</h2>
              <p>Se la primera persona en publicar una receta.</p>
            </div>
          ) : (
            <div className="recetas-grid">
              {recetasFiltradas.map((receta) => {
                const key = obtenerClaveReceta(receta);
                const detalleId = String(receta?._id || key);
                const esFav = Boolean(favoritos[key]);
                const esPend = Boolean(pendientes[key]);

                return (
                  <div
                    key={key || receta.title}
                    className="receta-card"
                    onClick={() => navigate(`/recetas-comunidad/${detalleId}`, { state: { receta, backPath: '/recetas-comunidad' } })}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        navigate(`/recetas-comunidad/${detalleId}`, { state: { receta, backPath: '/recetas-comunidad' } });
                      }
                    }}
                    aria-label={`Ver detalle de ${receta.title}`}
                  >
                    <button
                      type="button"
                      className={esFav ? 'favorite-btn active' : 'favorite-btn'}
                      onClick={(event) => toggleFavorito(event, receta)}
                      aria-label={esFav ? 'Quitar de favoritos' : 'Guardar en favoritos'}
                    >
                      {esFav ? <FaHeart /> : <FaRegHeart />}
                    </button>

                    <img 
                      src={receta.image} 
                      alt={receta.title} 
                      className="receta-image" 
                      loading="lazy" 
                      onError={(e) => {
                        e.target.onerror = null; 
                        e.target.src = 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=500';
                      }}
                    />
                    <h3>{receta.title}</h3>
                    <div className="receta-card-stats-row">
                      <span className="stat-item"><FaClock className="stat-icon" /> {getTiempo(receta)} min</span>
                      {receta.autor_nombre ? (
                        <>
                          <span className="stat-divider">·</span>
                          <span className="stat-item">{receta.autor_nombre}</span>
                        </>
                      ) : null}
                    </div>
                    <div className="ingredientes-block">
                      <p className="ingredientes-heading">Ingredientes</p>
                      {(() => {
                        const stats = calcularEstadisticasIngredientes(receta);
                        return (
                          <div className="ingredientes-summary">
                            <span className="ingrediente-pill disponible" title="Ingredientes que ya tienes">
                              <FaCheckCircle aria-hidden="true" />
                              <span>En casa</span>
                              <strong>{stats.tienes}</strong>
                            </span>
                            <span className="ingrediente-pill pendientes" title="Ingredientes que faltan">
                              <FaExclamationCircle aria-hidden="true" />
                              <span>Faltan</span>
                              <strong>{stats.faltan}</strong>
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="receta-card-actions">
                      <button
                        type="button"
                        className={esPend ? 'plan-inline-btn active' : 'plan-inline-btn'}
                        onClick={(event) => togglePendiente(event, receta)}
                        aria-label={esPend ? 'Quitar de pendientes' : 'Añadir a pendientes'}
                      >
                        {esPend ? <FaCalendarCheck /> : <FaCalendarPlus />}
                        <span>{esPend ? 'Quitar de pendientes' : 'Añadir a pendientes'}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
    </section>
  );
}
