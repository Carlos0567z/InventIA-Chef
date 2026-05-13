import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaHeart, FaRegHeart, FaCalendarPlus, FaCalendarCheck, FaSearch, FaCheckCircle, FaExclamationCircle } from 'react-icons/fa';
import '../styles/inventarioHome.css';
import '../styles/Recetas.css';
import PageHeader from '../components/PageHeader';
import CustomSelect from '../components/CustomSelect';
import FilterBar from '../components/FilterBar';
import RecetasClasicasChefToggle from '../components/RecetasClasicasChefToggle';

export default function RecetasIA() {
  const navigate = useNavigate();
  const [recetas, setRecetas] = useState([]);
  const [favoritos, setFavoritos] = useState({});
  const [favoritosPorTitulo, setFavoritosPorTitulo] = useState({});
  const [pendientes, setPendientes] = useState({});
  const [pendientesPorTitulo, setPendientesPorTitulo] = useState({});
  const [cargando, setCargando] = useState(true);
  const [despensaVacia, setDespensaVacia] = useState(false);
  const [sinResultados, setSinResultados] = useState(false);
  const [errorServicio, setErrorServicio] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTiempo, setFiltroTiempo] = useState(0);
  const [filtroFaltan, setFiltroFaltan] = useState('');
  const [filtroTienes, setFiltroTienes] = useState('');
  const [orden, setOrden] = useState('relevancia');
  const filtrosAnchorRef = useRef(null);
  const filtrosPanelRef = useRef(null);
  const [filtrosFijos, setFiltrosFijos] = useState(false);
  const [filtrosCompactos, setFiltrosCompactos] = useState(false);
  const [filtrosHeight, setFiltrosHeight] = useState(0);
  const [filtrosFixedStyle, setFiltrosFixedStyle] = useState({});

  // Tipo de favorito: 'IA' o 'Spoonacular'
  const normalizarTipoFavorito = (tipo) => {
    const t = String(tipo || '').trim().toLowerCase();
    if (t === 'ia') return 'IA';
    return 'Spoonacular';
  };

  const normalizarTitulo = (titulo) => String(titulo || '').trim().toLowerCase();

  const obtenerFavoritoIdReceta = (receta) => {
    const key = String(receta?.id || '');
    const keyTitulo = normalizarTitulo(receta?.title);
    return favoritos[key] || favoritosPorTitulo[keyTitulo] || null;
  };

  const obtenerPendienteIdReceta = (receta) => {
    const key = String(receta?.id || '');
    const keyTitulo = normalizarTitulo(receta?.title);
    return pendientes[key] || pendientesPorTitulo[keyTitulo] || null;
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

  const getCantidadFaltan = (receta) => (
    getResumenFaltantes(receta).necesarios
  );

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

  const obtenerImagenFallback = (receta) => {
    const titulo = String(receta?.title || 'Receta Inventia').trim();
    const etiqueta = titulo.length > 42 ? `${titulo.slice(0, 39)}...` : titulo;
    return `https://placehold.co/1200x800/F7F3EA/5A3E2B?text=${encodeURIComponent(etiqueta)}&font=montserrat`;
  };

  const recetasFiltradas = useMemo(() => {
    const texto = busqueda.trim().toLowerCase();

    const filtradas = recetas.filter((receta) => {
      const tiempo = getTiempo(receta);
      const tienes = getCantidadTienes(receta);
      const faltan = getCantidadFaltan(receta);

      if (texto && !receta.title?.toLowerCase().includes(texto)) return false;
      if (filtroTiempo > 0 && tiempo > filtroTiempo) return false;
      if (filtroFaltan && faltan > Number(filtroFaltan)) return false;
      if (filtroTienes && tienes < Number(filtroTienes)) return false;

      return Boolean(receta?.title);
    });

    const ordenadas = [...filtradas];

    if (orden === 'rapidez') {
      ordenadas.sort((a, b) => getTiempo(a) - getTiempo(b));
    } else if (orden === 'menos-faltan') {
      ordenadas.sort((a, b) => getCantidadFaltan(a) - getCantidadFaltan(b) || getTiempo(a) - getTiempo(b));
    } else if (orden === 'mas-completas') {
      ordenadas.sort((a, b) => getCantidadTienes(b) - getCantidadTienes(a) || getCantidadFaltan(a) - getCantidadFaltan(b));
    }

    return ordenadas;
  }, [busqueda, filtroTiempo, filtroFaltan, filtroTienes, orden, recetas]);

  const sincronizarFavoritos = async () => {
    try {
      const response = await fetch('/api/favoritos');
      if (!response.ok) return;

      const data = await response.json();
      const mapa = {};
      const mapaTitulo = {};
      data
        .filter((fav) => normalizarTipoFavorito(fav.tipo) === 'IA')
        .forEach((fav) => {
          const key = String(fav.id_externo || '');
          if (key) mapa[key] = fav._id;

          const keyTitulo = normalizarTitulo(fav.title);
          if (keyTitulo) mapaTitulo[keyTitulo] = fav._id;
        });
      setFavoritos(mapa);
      setFavoritosPorTitulo(mapaTitulo);
    } catch (error) {
      console.error('Error sincronizando favoritos:', error);
    }
  };

  useEffect(() => {
    const fetchRecetas = async () => {
      try {
        setErrorServicio(false);
        setSinResultados(false);
        setDespensaVacia(false);
        setCargando(true);

        const response = await fetch('/api/recetas-ia/sugerencias');
        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status}`);
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
        console.error('Error al cargar recetas sugeridas:', error);
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
        const mapaTitulo = {};
        data.forEach((pendiente) => {
          const key = String(pendiente.id_externo || '');
          if (key) mapa[key] = pendiente._id;

          const keyTitulo = normalizarTitulo(pendiente.title);
          if (keyTitulo) mapaTitulo[keyTitulo] = pendiente._id;
        });
        setPendientes(mapa);
        setPendientesPorTitulo(mapaTitulo);
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
        const mapaTitulo = {};
        data.forEach((pendiente) => {
          const key = String(pendiente.id_externo || '');
          if (key) mapa[key] = pendiente._id;

          const keyTitulo = normalizarTitulo(pendiente.title);
          if (keyTitulo) mapaTitulo[keyTitulo] = pendiente._id;
        });
        setPendientes(mapa);
        setPendientesPorTitulo(mapaTitulo);
      } catch (error) {
        console.error('Error al sincronizar pendientes chef:', error);
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

    const favoritoId = obtenerFavoritoIdReceta(receta);

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
          tipo: 'IA',
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
      console.error('Error al alternar favorito chef:', error);
    }
  };

  const addToPendientes = async (event, receta) => {
    event.stopPropagation();
    event.preventDefault();

    const key = String(receta.id || '');
    if (!key) return;

    const pendienteId = obtenerPendienteIdReceta(receta);
    const keyTitulo = normalizarTitulo(receta?.title);

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
        setPendientesPorTitulo((prev) => {
          const next = { ...prev };
          if (keyTitulo) delete next[keyTitulo];
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
        tipo: 'IA',
      };

      const response = await fetch('/api/recetas-pendientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.mensaje && error.mensaje.includes('duplicate')) {
          console.warn('Receta ya está en el plan');
          return;
        }
        throw new Error(error.mensaje || `Error HTTP ${response.status}`);
      }

      const saved = await response.json();
      setPendientes((prev) => ({ ...prev, [key]: saved._id }));
      if (keyTitulo) {
        setPendientesPorTitulo((prev) => ({ ...prev, [keyTitulo]: saved._id }));
      }
      window.dispatchEvent(new Event('pendientes-updated'));
    } catch (error) {
      console.error('Error al alternar pendientes chef:', error);
    }
  };

  const pendientesCount = Object.keys(pendientes).length;
  const totalSugerencias = recetas.length;
  const totalFavoritasSugerencias = Object.keys(favoritos).length;
  const totalFiltradas = recetasFiltradas.length;

  const resetFiltros = () => {
    setBusqueda('');
    setFiltroTiempo('');
    setFiltroFaltan('');
    setFiltroTienes('');
    setOrden('relevancia');
  };

  const renderHero = () => (
    <PageHeader
      kicker="Chef IA"
      title="Recetas sugeridas"
      description="Ideas a partir de tus ingredientes para encontrar combinaciones utiles y guardar solo lo que te interesa."
    >
      <div className="page-hero-stats">
        <div>
          <strong>{totalSugerencias}</strong>
          <span>Sugerencias</span>
        </div>
        <div>
          <strong>{pendientesCount}</strong>
          <span>Pendientes</span>
        </div>
        <div>
          <strong>{totalFavoritasSugerencias}</strong>
          <span>Favoritas</span>
        </div>
      </div>
    </PageHeader>
  );

  const renderFiltros = () => (
    <div
      className="inventario-filters-anchor recetas-filtros-anchor-chef"
      ref={filtrosAnchorRef}
      style={filtrosFijos ? { minHeight: `${filtrosHeight}px` } : undefined}
    >
      <FilterBar
        idPrefix="recetas-chef"
        searchValue={busqueda}
        onSearchChange={setBusqueda}
        sliders={[{
          id: 'recetas-chef-tiempo-slider',
          label: 'Tiempo máximo',
          min: minTime,
          max: maxTime,
          value: filtroTiempo || maxTime,
          onChange: setFiltroTiempo,
          unit: 'min'
        }]}
        selects={[
          {
            id: 'recetas-chef-faltan',
            value: filtroFaltan,
            onChange: setFiltroFaltan,
            label: 'Faltan',
            options: [
              { value: '', label: 'Faltan: sin límite' },
              { value: '0', label: 'Faltan: 0' },
              { value: '1', label: 'Faltan: hasta 1' },
              { value: '2', label: 'Faltan: hasta 2' },
              { value: '3', label: 'Faltan: hasta 3' }
            ]
          },
          {
            id: 'recetas-chef-tienes',
            value: filtroTienes,
            onChange: setFiltroTienes,
            label: 'Tienes',
            options: [
              { value: '', label: 'Tienes: sin mínimo' },
              { value: '1', label: 'Tienes: al menos 1' },
              { value: '3', label: 'Tienes: al menos 3' },
              { value: '5', label: 'Tienes: al menos 5' }
            ]
          },
          {
            id: 'recetas-chef-orden',
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
        <div className="loading">
          <h2>Estamos preparando ideas nuevas...</h2>
          <p>Buscando combinaciones para tu despensa</p>
        </div>
      </section>
    );
  }

  if (errorServicio) {
    return (
      <section className="view-section active recetas-container">
        <RecetasClasicasChefToggle />
        {renderHero()}
        <div className="empty-state">
          <h2>No se pudieron cargar las recetas</h2>
          <p>Intentalo de nuevo en unos segundos.</p>
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
        <div className="empty-state">
          <h2>No encontramos combinaciones aun</h2>
          <p>Prueba a añadir más ingredientes en tu inventario.</p>
        </div>
      </section>
    );
  }

  if (despensaVacia || recetas.length === 0) {
    return (
      <section className="view-section active recetas-container">
        <RecetasClasicasChefToggle />
        {renderHero()}
        <div className="empty-state">
          <h2>Despensa vacia</h2>
          <p>Agrega ingredientes para generar recetas.</p>
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
          <p>Prueba a ampliar el tiempo, dejar más faltantes o buscar por otro ingrediente.</p>
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
              onClick={() => navigate(`/recetas-ia/${receta.id}`)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(`/recetas-ia/${receta.id}`);
                }
              }}
              role="button"
              tabIndex={0}
              aria-label={`Ver detalle de ${receta.title}`}
            >
              <button
                type="button"
                className={obtenerFavoritoIdReceta(receta) ? 'favorite-btn active' : 'favorite-btn'}
                onClick={(event) => toggleFavoritoCard(event, receta)}
                aria-label={obtenerFavoritoIdReceta(receta) ? 'Quitar de favoritos' : 'Guardar en favoritos'}
              >
                {obtenerFavoritoIdReceta(receta) ? <FaHeart /> : <FaRegHeart />}
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
                  className={obtenerPendienteIdReceta(receta) ? 'plan-inline-btn active' : 'plan-inline-btn'}
                  onClick={(event) => addToPendientes(event, receta)}
                  aria-label={obtenerPendienteIdReceta(receta) ? 'Quitar de pendientes' : 'Añadir a pendientes'}
                >
                  {obtenerPendienteIdReceta(receta) ? <FaCalendarCheck /> : <FaCalendarPlus />}
                  <span>{obtenerPendienteIdReceta(receta) ? 'Quitar de pendientes' : 'Añadir a pendientes'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
