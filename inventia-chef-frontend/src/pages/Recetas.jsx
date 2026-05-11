import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaHeart,
  FaRegHeart,
  FaCalendarPlus,
  FaCalendarCheck,
  FaSearch,
  FaCheckCircle,
  FaExclamationCircle,
} from 'react-icons/fa';
import '../styles/inventarioHome.css';
import '../styles/Recetas.css';
import PageHeader from '../components/PageHeader';
import CustomSelect from '../components/CustomSelect';
import FilterBar from '../components/FilterBar';
import RecetasClasicasChefToggle from '../components/RecetasClasicasChefToggle';

export default function Recetas() {
  const navigate = useNavigate();
  const [recetas, setRecetas] = useState([]);
  const [favoritos, setFavoritos] = useState({});
  const [pendientes, setPendientes] = useState({});
  const [cargando, setCargando] = useState(true);
  const [despensaVacia, setDespensaVacia] = useState(false);
  const [sinResultados, setSinResultados] = useState(false);
  const [errorServicio, setErrorServicio] = useState(false);
  const [mensajeError, setMensajeError] = useState('');
  const [detalleError, setDetalleError] = useState('');
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTiempo, setFiltroTiempo] = useState(0); // 0 = sin tocar el slider hasta tener maxTime
  const [filtroFaltan, setFiltroFaltan] = useState('');
  const [filtroTienes, setFiltroTienes] = useState('');
  const [orden, setOrden] = useState('relevancia');
  const filtrosAnchorRef = useRef(null);
  const filtrosPanelRef = useRef(null);
  const [filtrosFijos, setFiltrosFijos] = useState(false);
  const [filtrosCompactos, setFiltrosCompactos] = useState(false);
  const [filtrosHeight, setFiltrosHeight] = useState(0);
  const [filtrosFixedStyle, setFiltrosFixedStyle] = useState({});

  const normalizarTipoFavorito = (tipo) => {
    const t = String(tipo || '').trim().toLowerCase();
    if (t === 'ia') return 'IA';
    return 'Spoonacular';
  };

  const sincronizarFavoritos = async () => {
    // pedimos los favoritos al backend
    try {
      const response = await fetch('/api/favoritos');
      if (!response.ok) return;

      const data = await response.json();
      const mapa = {};
      data
        .filter((fav) => normalizarTipoFavorito(fav.tipo) === 'Spoonacular')
        .forEach((fav) => {
          const key = String(fav.id_externo || '');
          if (key) mapa[key] = fav._id;
        });
      setFavoritos(mapa);
    } catch (error) {
      console.error('Error al sincronizar favoritos:', error);
    }
  };

  const extraerTextoReceta = (receta) => {
    const ingredientes = [
      ...(Array.isArray(receta?.usedIngredients) ? receta.usedIngredients : []),
      ...(Array.isArray(receta?.missedIngredients) ? receta.missedIngredients : []),
    ]
      .map((ingrediente) => String(ingrediente?.name || '').trim())
      .filter(Boolean)
      .join(' ');

    return `${receta?.title || ''} ${ingredientes}`.toLowerCase();
  };

  const getCantidadTienes = (receta) => (
    Array.isArray(receta?.usedIngredients)
      ? receta.usedIngredients.length
      : Number(receta?.usedIngredientCount) || 0
  );

  const normalizarTextoIngrediente = (texto) => String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const esIngredienteOpcional = (ingrediente) => {
    const texto = String(
      ingrediente?.original
      || ingrediente?.originalName
      || ingrediente?.name
      || ingrediente
      || ''
    ).trim().toLowerCase();
    return /^opcional\s*:/.test(texto);
  };

  const getResumenFaltantes = (receta) => {
    const missed = Array.isArray(receta?.missedIngredients) ? receta.missedIngredients : [];

    if (missed.length === 0) {
      return { necesarios: 0, opcionales: 0 };
    }

    const opcionalesTexto = new Set(
      (Array.isArray(receta?.extendedIngredients) ? receta.extendedIngredients : [])
        .map((item) => String(item?.original || item?.name || '').trim())
        .filter((texto) => /^opcional\s*:/i.test(texto))
        .map((texto) => normalizarTextoIngrediente(texto.replace(/^opcional\s*:/i, '').trim()))
        .filter(Boolean)
    );

    let opcionales = 0;
    let necesarios = 0;

    missed.forEach((ingrediente) => {
      const textoCrudo = String(ingrediente?.name || ingrediente?.original || '').trim();
      const texto = normalizarTextoIngrediente(textoCrudo);
      const esOpcionalDirecto = esIngredienteOpcional(ingrediente);
      const esOpcionalPorMatch = texto && [...opcionalesTexto].some((op) => texto.includes(op) || op.includes(texto));

      if (esOpcionalDirecto || esOpcionalPorMatch) {
        opcionales += 1;
      } else {
        necesarios += 1;
      }
    });

    return { necesarios, opcionales };
  };

  const getCantidadFaltan = (receta) => (
    getResumenFaltantes(receta).necesarios
  );

  const getTiempo = (receta) => {
    const t = Number(receta?.readyInMinutes || receta?.minutes || 0);
    // Si no tiene tiempo definido (común en búsqueda por ingredientes de Spoonacular), 
    // le asignamos un tiempo por defecto para que el filtro no sea ignorado (0 siempre pasa el filtro).
    return t > 0 ? t : 30; 
  };

  const { minTime, maxTime } = useMemo(() => {
    if (!recetas.length) return { minTime: 0, maxTime: 120 };
    const times = recetas.map(r => getTiempo(r)).filter(t => t > 0);
    if (!times.length) return { minTime: 0, maxTime: 120 };
    return { minTime: Math.min(...times), maxTime: Math.max(...times) };
  }, [recetas]);

  // si no hay filtro de tiempo aun, pongo el maximo de la lista
  useEffect(() => {
    if (filtroTiempo === 0 && maxTime > 0) {
      setFiltroTiempo(maxTime);
    }
  }, [maxTime]);

  // Al final quite useMemo del filtrado porque me liaba con los cambios de la despensa,
  // asi que recalculo la lista en un effect (mas simple de seguir).
  const [recetasFiltradas, setRecetasFiltradas] = useState([]);
  const totalFiltradas = recetasFiltradas.length;

  useEffect(() => {
    let filtradas = [...recetas];
    const texto = busqueda.trim().toLowerCase();

    // Filtro por nombre
    if (texto !== '') {
      filtradas = filtradas.filter(r => 
        r.title.toLowerCase().includes(texto) || 
        (r.summary && r.summary.toLowerCase().includes(texto))
      );
    }

    // Filtro por tiempo
    if (filtroTiempo > 0) {
      filtradas = filtradas.filter(r => getTiempo(r) <= filtroTiempo);
    }

    // Filtro por ingredientes que faltan
    if (filtroFaltan !== '') {
      filtradas = filtradas.filter(r => getCantidadFaltan(r) <= Number(filtroFaltan));
    }

    // Ordenar resultados
    if (orden === 'rapidez') {
      filtradas.sort((a, b) => getTiempo(a) - getTiempo(b));
    } else if (orden === 'menos-faltan') {
      filtradas.sort((a, b) => getCantidadFaltan(a) - getCantidadFaltan(b));
    } else if (orden === 'mas-completas') {
      filtradas.sort((a, b) => getCantidadTienes(b) - getCantidadTienes(a));
    }

    setRecetasFiltradas(filtradas);
  }, [busqueda, filtroTiempo, filtroFaltan, filtroTienes, orden, recetas]);

  useEffect(() => {
    const fetchRecetas = async () => {
      // cargando en true mientras pedimos a la api
      try {
        setErrorServicio(false);
        setMensajeError('');
        setDetalleError('');
        setSinResultados(false);
        setDespensaVacia(false);
        setCargando(true);

        const response = await fetch('/api/recetas/sugerencias');
        if (!response.ok) {
          let detalle = null;
          try {
            detalle = await response.json();
          } catch {
            detalle = null;
          }

          if (detalle?.codigo === 'SPOONACULAR_NOT_CONFIGURED') {
            setMensajeError('Spoonacular no esta configurado en el backend.');
          } else if (detalle?.codigo === 'SPOONACULAR_QUOTA_EXCEEDED') {
            setMensajeError('Limite diario de Spoonacular alcanzado.');
          } else if (detalle?.codigo === 'SPOONACULAR_FORCED_FAILED') {
            setMensajeError('Fallo Spoonacular en modo forzado. Cambia a auto o fallback.');
          } else {
            setMensajeError('Spoonacular no esta disponible temporalmente.');
          }

          setDetalleError(detalle?.codigo || `HTTP_${response.status}`);
          throw new Error(`Spoonacular HTTP ${response.status}`);
        }

        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          setRecetas(data);
          setCargando(false);
          return;
        }

        const inventarioResponse = await fetch('/api/alimentos');
        if (!inventarioResponse.ok) {
          throw new Error(`Error HTTP ${inventarioResponse.status}`);
        }

        const inventario = await inventarioResponse.json();
        if (inventario.length === 0) {
          setDespensaVacia(true);
        } else {
          setSinResultados(true);
        }
      } catch (error) {
        console.error('Error al cargar recetas:', error);
        setErrorServicio(true);
      }

      setCargando(false);
    };

    fetchRecetas();
  }, [refreshSeed]);

  useEffect(() => {
    sincronizarFavoritos();
  }, []);

  useEffect(() => {
    const actualizarFavoritos = () => {
      sincronizarFavoritos();
    };

    window.addEventListener('favoritos-updated', actualizarFavoritos);
    return () => window.removeEventListener('favoritos-updated', actualizarFavoritos);
  }, []);

  useEffect(() => {
    const cargarPendientes = async () => {
      try {
        const response = await fetch('/api/recetas-pendientes');
        if (!response.ok) return;

        const data = await response.json();
        const mapa = {};
        data.forEach((pendiente) => {
          const key = String(pendiente.id_externo || '');
          if (key) mapa[key] = pendiente._id;
        });
        setPendientes(mapa);
      } catch (error) {
        console.error('Error al cargar pendientes:', error);
      }
    };

    cargarPendientes();
  }, []);

  useEffect(() => {
    const sincronizarPendientes = async () => {
      try {
        const response = await fetch('/api/recetas-pendientes');
        if (!response.ok) return;

        const data = await response.json();
        const mapa = {};
        data.forEach((pendiente) => {
          const key = String(pendiente.id_externo || '');
          if (key) mapa[key] = pendiente._id;
        });
        setPendientes(mapa);
      } catch (error) {
        console.error('Error al sincronizar pendientes:', error);
      }
    };

    window.addEventListener('pendientes-updated', sincronizarPendientes);
    return () => window.removeEventListener('pendientes-updated', sincronizarPendientes);
  }, []);

  useEffect(() => {
    const appMain = document.querySelector('.app-main');

    const getHeaderOffset = () => {
      const header = document.querySelector('.top-header');
      const headerHeight = header?.getBoundingClientRect().height || 74;
      return headerHeight + 8;
    };

    const updateFiltroBar = () => {
      const anchor = filtrosAnchorRef.current;
      const panel = filtrosPanelRef.current;
      if (!anchor || !panel) return;

      const anchorRect = anchor.getBoundingClientRect();
      const topOffset = getHeaderOffset();
      const shouldFix = anchorRect.top <= topOffset;

      setFiltrosFijos((prev) => (prev === shouldFix ? prev : shouldFix));
      setFiltrosCompactos((prev) => (prev === shouldFix ? prev : shouldFix));
      setFiltrosHeight((prev) => {
        const next = panel.offsetHeight;
        return prev === next ? prev : next;
      });

      if (!shouldFix) {
        setFiltrosFixedStyle((prev) => (Object.keys(prev).length === 0 ? prev : {}));
        return;
      }

      const nextStyle = {
        top: `${Math.round(topOffset)}px`,
        left: `${Math.round(anchorRect.left)}px`,
        width: `${Math.max(280, Math.round(anchorRect.width))}px`,
      };

      setFiltrosFixedStyle((prev) => {
        if (prev.top === nextStyle.top && prev.left === nextStyle.left && prev.width === nextStyle.width) {
          return prev;
        }

        return nextStyle;
      });
    };

    updateFiltroBar();
    window.addEventListener('scroll', updateFiltroBar, { passive: true });
    window.addEventListener('resize', updateFiltroBar);
    if (appMain) {
      appMain.addEventListener('scroll', updateFiltroBar, { passive: true });
    }

    return () => {
      window.removeEventListener('scroll', updateFiltroBar);
      window.removeEventListener('resize', updateFiltroBar);
      if (appMain) {
        appMain.removeEventListener('scroll', updateFiltroBar);
      }
    };
  }, []);

  const toggleFavoritoCard = async (event, receta) => {
    event.stopPropagation();
    event.preventDefault();

    const key = String(receta.id || '');
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
        window.dispatchEvent(new Event('favoritos-updated'));
      } else {
        const payload = {
          id_externo: key,
          title: receta.title,
          image: receta.image,
          readyInMinutes: receta.readyInMinutes,
          servings: receta.servings,
          extendedIngredients: receta.extendedIngredients || [],
          analyzedInstructions: receta.analyzedInstructions || [],
          tipo: 'Spoonacular',
        };

        const response = await fetch('/api/favoritos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) throw new Error(`Error HTTP ${response.status}`);

        const guardado = await response.json();
        setFavoritos((prev) => ({ ...prev, [key]: guardado._id }));
        window.dispatchEvent(new Event('favoritos-updated'));
      }
    } catch (error) {
      console.error('Error al alternar favorito:', error);
    }
  };

  const addToPendientes = async (event, receta) => {
    event.stopPropagation();
    event.preventDefault();

    const key = String(receta.id || '');
    if (!key) return;

    const pendienteId = pendientes[key];

    try {
      if (pendienteId) {
        const deleteResponse = await fetch(`/api/recetas-pendientes/${pendienteId}`, {
          method: 'DELETE',
        });
        if (!deleteResponse.ok) throw new Error(`Error HTTP ${deleteResponse.status}`);

        setPendientes((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        window.dispatchEvent(new Event('pendientes-updated'));
        return;
      }

      const payload = {
        id_externo: key,
        title: receta.title,
        image: receta.image,
        readyInMinutes: receta.readyInMinutes,
        servings: receta.servings,
        extendedIngredients: receta.extendedIngredients || [],
        analyzedInstructions: receta.analyzedInstructions || [],
        tipo: 'Spoonacular',
      };

      const response = await fetch('/api/recetas-pendientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.mensaje && error.mensaje.includes('duplicate')) {
          console.warn('Receta ya esta en pendientes');
          return;
        }
        throw new Error(error.mensaje || `Error HTTP ${response.status}`);
      }

      const saved = await response.json();
      setPendientes((prev) => ({ ...prev, [key]: saved._id }));
      window.dispatchEvent(new Event('pendientes-updated'));
    } catch (error) {
      console.error('Error al alternar pendientes:', error);
    }
  };

  const obtenerImagenFallback = (receta) => {
    const titulo = String(receta?.title || 'Receta').trim();
    const etiqueta = titulo.length > 42 ? `${titulo.slice(0, 39)}...` : titulo;
    return `https://placehold.co/1200x800/F7F3EA/5A3E2B?text=${encodeURIComponent(etiqueta)}&font=montserrat`;
  };

  const renderHero = () => (
    <PageHeader
      kicker="Recetas clasicas"
      title="Recetas sugeridas"
      description="Recetas del catalogo principal con opciones para ajustar a tu despensa."
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

  const resetFiltros = () => {
    setBusqueda('');
    setFiltroTiempo('');
    setFiltroFaltan('');
    setFiltroTienes('');
    setOrden('relevancia');
  };

  const renderFiltros = () => (
    <div
      className="inventario-filters-anchor recetas-filtros-anchor-chef"
      ref={filtrosAnchorRef}
      style={filtrosFijos ? { minHeight: `${filtrosHeight}px` } : undefined}
    >
      <FilterBar
        idPrefix="recetas"
        searchValue={busqueda}
        onSearchChange={setBusqueda}
        sliders={[{
          id: 'recetas-tiempo-slider',
          label: 'Tiempo máximo',
          min: minTime,
          max: maxTime,
          value: filtroTiempo || maxTime,
          onChange: setFiltroTiempo,
          unit: 'min'
        }]}
        selects={[
          {
            id: 'recetas-faltan',
            value: filtroFaltan,
            onChange: setFiltroFaltan,
            label: 'Faltan',
            options: [
              { value: '', label: 'Faltan: cualquiera' },
              { value: '0', label: 'Faltan: ninguna' },
              { value: '2', label: 'Faltan: hasta 2' },
              { value: '5', label: 'Faltan: hasta 5' },
              { value: '10', label: 'Faltan: hasta 10' }
            ]
          },
          {
            id: 'recetas-tienes',
            value: filtroTienes,
            onChange: setFiltroTienes,
            label: 'Tienes',
            options: [
              { value: '', label: 'Tienes: cualquiera' },
              { value: '1', label: 'Tienes: al menos 1' },
              { value: '3', label: 'Tienes: al menos 3' },
              { value: '5', label: 'Tienes: al menos 5' },
              { value: '8', label: 'Tienes: al menos 8' }
            ]
          },
          {
            id: 'recetas-orden',
            value: orden,
            onChange: setOrden,
            label: 'Orden',
            neutralValue: 'relevancia',
            options: [
              { value: 'relevancia', label: 'Orden: relevancia' },
              { value: 'rapidez', label: 'Orden: más rápidas' },
              { value: 'menos-faltan', label: 'Orden: menos faltantes' },
              { value: 'mas-completas', label: 'Orden: más completas' }
            ]
          }
        ]}
      />
    </div>
  );

  if (cargando) {
    return (
      <section className="view-section active recetas-container">
        <RecetasClasicasChefToggle />
        {renderHero()}
        {renderFiltros()}
        <div className="loading">
          <h2>Buscando recetas para tu despensa...</h2>
          <p>Un momento y te mostramos opciones</p>
        </div>
      </section>
    );
  }

  if (errorServicio) {
    return (
      <section className="view-section active recetas-container">
        <RecetasClasicasChefToggle />
        {renderHero()}
        {renderFiltros()}
        <div className="empty-state">
          <h2>No se pudieron cargar las recetas</h2>
          <p>{mensajeError || 'El servicio está tardando más de lo normal. Inténtalo de nuevo en unos segundos.'}</p>
          {detalleError && <p style={{ marginTop: '10px', fontSize: '0.85rem', color: '#64748b' }}>Codigo: {detalleError}</p>}
          <button
            type="button"
            className="action-btn"
            onClick={() => setRefreshSeed((prev) => prev + 1)}
            style={{ marginTop: '14px' }}
          >
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  if (sinResultados) {
    return (
      <section className="view-section active recetas-container">
        <RecetasClasicasChefToggle />
        {renderHero()}
        {renderFiltros()}
        <div className="empty-state">
          <h2>No encontramos recetas con tu despensa actual</h2>
          <p>Prueba a añadir más ingredientes para mejorar las sugerencias.</p>
        </div>
      </section>
    );
  }

  if (despensaVacia || recetas.length === 0) {
    return (
      <section className="view-section active recetas-container">
        <RecetasClasicasChefToggle />
        {renderHero()}
        {renderFiltros()}
        <div className="empty-state">
          <h2>Despensa vacia</h2>
          <p>Agrega algunos ingredientes para obtener sugerencias de recetas</p>
        </div>
      </section>
    );
  }

  return (
    <section className="view-section active recetas-container">
      <RecetasClasicasChefToggle />
      {renderHero()}
      {renderFiltros()}

      {totalFiltradas === 0 ? (
        <div className="empty-state recetas-filters-empty">
          <h2>No hay recetas con esos filtros</h2>
          <p>Prueba a ampliar el tiempo, dejar mas faltantes o buscar por otro ingrediente.</p>
          <button
            type="button"
            className="action-btn"
            onClick={resetFiltros}
            style={{ marginTop: '14px' }}
          >
            Restablecer filtros
          </button>
        </div>
      ) : (
        <div className="recetas-grid">
          {recetasFiltradas.map((receta) => (
            <div
              key={receta.id}
              className="receta-card"
              onClick={() => navigate(`/recetas/${receta.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(`/recetas/${receta.id}`);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Ver detalle de ${receta.title}`}
            >
              <button
                type="button"
                className={favoritos[String(receta.id || '')] ? 'favorite-btn active' : 'favorite-btn'}
                onClick={(event) => toggleFavoritoCard(event, receta)}
                aria-label={favoritos[String(receta.id || '')] ? 'Quitar de favoritos' : 'Guardar en favoritos'}
              >
                {favoritos[String(receta.id || '')] ? <FaHeart /> : <FaRegHeart />}
              </button>
              <img
                src={receta.image}
                alt={receta.title}
                className="receta-image"
                loading="lazy"
                onError={(event) => {
                  const target = event.currentTarget;
                  if (target.dataset.fallbackApplied === '1') return;
                  target.dataset.fallbackApplied = '1';
                  target.src = obtenerImagenFallback(receta);
                }}
              />
              <h3>{receta.title}</h3>
              {(() => {
                const faltantes = getResumenFaltantes(receta);
                const tieneOpcionales = faltantes.opcionales > 0;
                const soloOpcionales = faltantes.necesarios === 0 && faltantes.opcionales > 0;
                return (
                  <div className="ingredientes-block" aria-label="Resumen de ingredientes">
                    <p className="ingredientes-heading">Ingredientes</p>
                    <div className="ingredientes-summary">
                      <span className="ingrediente-pill disponible" title="Ingredientes que ya tienes">
                        <FaCheckCircle aria-hidden="true" />
                        <span>En casa</span>
                        <strong>{getCantidadTienes(receta)}</strong>
                      </span>
                      <span
                        className={`ingrediente-pill ${soloOpcionales ? 'opcionales' : 'pendientes'}`}
                        title={soloOpcionales ? 'Ingredientes opcionales que no tienes' : 'Ingredientes necesarios que faltan'}
                      >
                        <FaExclamationCircle aria-hidden="true" />
                        <span>{soloOpcionales ? 'Opcionales' : 'Faltan'}</span>
                        <strong>{soloOpcionales ? faltantes.opcionales : faltantes.necesarios}</strong>
                      </span>
                    </div>
                    {tieneOpcionales && (
                      <p className="ingredientes-note">
                        {soloOpcionales
                          ? `Puedes hacerla ya. Te faltan ${faltantes.opcionales} ingrediente(s) opcional(es).`
                          : `Ademas, hay ${faltantes.opcionales} ingrediente(s) opcional(es).`}
                      </p>
                    )}
                  </div>
                );
              })()}
              <div className="receta-card-actions">
                <button
                  type="button"
                  className={pendientes[String(receta.id || '')] ? 'plan-inline-btn active' : 'plan-inline-btn'}
                  onClick={(event) => addToPendientes(event, receta)}
                  aria-label={pendientes[String(receta.id || '')] ? 'Quitar de pendientes' : 'Añadir a pendientes'}
                >
                  {pendientes[String(receta.id || '')] ? <FaCalendarCheck /> : <FaCalendarPlus />}
                  <span>{pendientes[String(receta.id || '')] ? 'Quitar de pendientes' : 'Añadir a pendientes'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
