import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { FaHeart, FaRegHeart, FaClock, FaUserFriends, FaArrowLeft } from 'react-icons/fa';
import '../styles/RecetaDetalle.css';

const RecetaDetalle = ({ apiBase = '/api/recetas', backPath = '/recetas' }) => {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [receta, setReceta] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [procesandoPendiente, setProcesandoPendiente] = useState(false);
  const [procesandoFavorito, setProcesandoFavorito] = useState(false);
  const [esFavorito, setEsFavorito] = useState(false);
  const [favoritoId, setFavoritoId] = useState(null);
  const [esPendiente, setEsPendiente] = useState(false);
  const [pendienteId, setPendienteId] = useState(null);
  const [inventarioNombres, setInventarioNombres] = useState([]);

  const tipoReceta = apiBase.includes('/api/recetas-ia')
    ? 'IA'
    : apiBase.includes('/api/recetas-comunidad')
      ? 'Comunidad'
      : 'Spoonacular';
  const backDestino = location.state?.backPath || backPath;
  const HECHAS_KEY = 'inventia_recetas_hechas';

  const normalizarTipoFavorito = (tipo) => {
    const t = String(tipo || '').trim().toLowerCase();
    if (t === 'ia') return 'IA';
    if (t === 'comunidad') return 'Comunidad';
    return 'Spoonacular';
  };

  const normalizarTitulo = (titulo) => String(titulo || '').trim().toLowerCase();

  const normalizarTextoIngrediente = (texto) => String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const obtenerClaveReceta = (item) => String(item?.id_externo || item?.id || '');

  const obtenerRecetaLocalHecha = () => {
    try {
      const guardado = localStorage.getItem(HECHAS_KEY);
      if (!guardado) return null;

      const hechas = JSON.parse(guardado);
      if (!Array.isArray(hechas)) return null;

      const encontrada = hechas.find((item) => String(item.id_externo || '') === String(id || ''));
      return encontrada || null;
    } catch {
      return null;
    }
  };

  // plurales tipo tomate/tomates: quito sufijo y comparo
  const quitarPlural = (texto) => {
    if (!texto) return '';
    if (texto.endsWith('es')) return texto.slice(0, -2);
    if (texto.endsWith('s')) return texto.slice(0, -1);
    return texto;
  };

  const ingredienteEnDespensa = (ingredienteTexto) => {
    const texto = normalizarTextoIngrediente(ingredienteTexto);
    if (!texto || inventarioNombres.length === 0) return false;

    const textoSingular = quitarPlural(texto);

    return inventarioNombres.some((item) => {
      if (!item) return false;
      const itemSingular = quitarPlural(item);
      
      // Caso 1: Coincidencia de raices (ej: tomate / tomates)
      if (texto.includes(itemSingular) || item.includes(textoSingular)) return true;
      
      // Caso 2: Diccionario basico bilingue
      const variaciones = {
        'tomate': 'tomato',
        'cebolla': 'onion',
        'huevo': 'egg',
        'patata': 'potato',
        'leche': 'milk',
        'pan': 'bread',
        'ajo': 'garlic'
      };
      
      const v = variaciones[itemSingular] || variaciones[item];
      if (v && (texto.includes(v) || v.includes(textoSingular))) return true;
      
      return false;
    });
  };

  const actualizarEstadosRelacionados = async (data) => {
    const favoritosResponse = await fetch('/api/favoritos');
    if (favoritosResponse.ok) {
      const favoritos = await favoritosResponse.json();

      let match = null;
      if (apiBase === '/api/favoritos') {
        match = favoritos.find((fav) => fav._id === data._id);
      } else {
        const claveActual = obtenerClaveReceta(data);
          const tituloActual = normalizarTitulo(data?.title);
        match = favoritos.find(
            (fav) => {
              const mismoTipo = normalizarTipoFavorito(fav.tipo) === normalizarTipoFavorito(tipoReceta);
              if (!mismoTipo) return false;

              const coincideId = String(fav.id_externo || '') === claveActual;
              const coincideTitulo = normalizarTitulo(fav.title) === tituloActual;
              return coincideId || coincideTitulo;
            }
        );
      }

      if (match) {
        setEsFavorito(true);
        setFavoritoId(match._id);
      } else {
        setEsFavorito(false);
        setFavoritoId(null);
      }
    }

    const pendientesResponse = await fetch('/api/recetas-pendientes');
    if (pendientesResponse.ok) {
      const pendientes = await pendientesResponse.json();
      const claveActual = obtenerClaveReceta(data);
      const tituloActual = normalizarTitulo(data?.title);
      const tipoActual = apiBase === '/api/favoritos' ? String(data?.tipo || tipoReceta) : tipoReceta;

      const pendiente = pendientes.find(
        (p) => {
          const mismoTipo = normalizarTipoFavorito(p.tipo) === normalizarTipoFavorito(tipoActual);
          if (!mismoTipo) return false;

          const coincideId = String(p.id_externo || '') === claveActual;
          const coincideTitulo = normalizarTitulo(p.title) === tituloActual;
          return coincideId || coincideTitulo;
        }
      );

      if (pendiente) {
        setEsPendiente(true);
        setPendienteId(pendiente._id);
      } else {
        setEsPendiente(false);
        setPendienteId(null);
      }
    }
  };

  useEffect(() => {
    const fetchDetalle = async () => {
      try {
        setErrorCarga(null);
        setCargando(true);
        const recetaDesdeEstado = location.state?.receta || null;

        if (recetaDesdeEstado) {
          setReceta(recetaDesdeEstado);
          await actualizarEstadosRelacionados(recetaDesdeEstado);
        } else {
          const response = await fetch(`${apiBase}/${id}`);

          if (!response.ok) {
            let detalle = null;
            try {
              detalle = await response.json();
            } catch {
              detalle = null;
            }

            if (response.status === 404) {
              const recetaLocal = obtenerRecetaLocalHecha();
              if (recetaLocal) {
                setReceta(recetaLocal);
                await actualizarEstadosRelacionados(recetaLocal);
                return;
              }
            }

            throw new Error(detalle?.mensaje || `Error HTTP ${response.status}`);
          }

          const data = await response.json();
          setReceta(data);
          await actualizarEstadosRelacionados(data);
        }
      } catch (error) {
        console.error('Error al obtener los detalles:', error);
        setErrorCarga(error?.message || 'No se pudo cargar el detalle de la receta.');
      } finally {
        setCargando(false);
      }
    };

    fetchDetalle();
  }, [id, apiBase, tipoReceta, location.state]);

  useEffect(() => {
    const cargarInventario = async () => {
      try {
        const response = await fetch('/api/alimentos');
        if (!response.ok) return;
        const data = await response.json();
        const nombres = Array.isArray(data)
          ? data.map((item) => normalizarTextoIngrediente(item?.nombre || '')).filter(Boolean)
          : [];
        setInventarioNombres(nombres);
      } catch {
        // Si falla inventario, seguimos mostrando la receta
      }
    };

    cargarInventario();
  }, []);

  useEffect(() => {
    const actualizarPendientes = () => {
      const recargar = async () => {
        try {
          const pendientesResponse = await fetch('/api/recetas-pendientes');
          if (!pendientesResponse.ok) return;

          const pendientesData = await pendientesResponse.json();
          const key = obtenerClaveReceta(receta || { id });
          const titulo = normalizarTitulo(receta?.title);
          const pendiente = pendientesData.find((item) => {
            const coincideId = String(item.id_externo || '') === String(key || '');
            const coincideTitulo = normalizarTitulo(item.title) === titulo;
            return coincideId || coincideTitulo;
          });
          setEsPendiente(Boolean(pendiente));
          setPendienteId(pendiente?._id || null);
        } catch {
          // idem
        }
      };

      if (receta) {
        recargar();
      }
    };

    window.addEventListener('pendientes-updated', actualizarPendientes);
    return () => window.removeEventListener('pendientes-updated', actualizarPendientes);
  }, [receta, id]);

  const togglePendiente = async () => {
    if (!receta) return;

    setProcesandoPendiente(true);
    try {
      if (esPendiente && pendienteId) {
        const deleteResponse = await fetch(`/api/recetas-pendientes/${pendienteId}`, {
          method: 'DELETE',
        });

        if (!deleteResponse.ok) {
          throw new Error(`Error HTTP ${deleteResponse.status}`);
        }

        setEsPendiente(false);
        setPendienteId(null);
        window.dispatchEvent(new Event('pendientes-updated'));
      } else {
        const payload = {
          id_externo: obtenerClaveReceta(receta),
          title: receta.title,
          image: receta.image,
          readyInMinutes: receta.readyInMinutes,
          servings: receta.servings,
          extendedIngredients: receta.extendedIngredients || [],
          analyzedInstructions: receta.analyzedInstructions || [],
          tipo: apiBase === '/api/favoritos' ? String(receta?.tipo || tipoReceta) : tipoReceta,
        };

        const response = await fetch('/api/recetas-pendientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status}`);
        }

        const guardada = await response.json();
        setEsPendiente(true);
        setPendienteId(guardada._id);
        window.dispatchEvent(new Event('pendientes-updated'));
      }
    } catch (error) {
      console.error('Error al alternar pendientes:', error);
      alert('No se pudo actualizar pendientes.');
    } finally {
      setProcesandoPendiente(false);
    }
  };

  const toggleFavorito = async () => {
    if (!receta) return;

    setProcesandoFavorito(true);
    try {
      if (esFavorito && favoritoId) {
        const deleteResponse = await fetch(`/api/favoritos/${favoritoId}`, {
          method: 'DELETE',
        });

        if (!deleteResponse.ok) {
          throw new Error(`Error HTTP ${deleteResponse.status}`);
        }

        setEsFavorito(false);
        setFavoritoId(null);
        window.dispatchEvent(new Event('favoritos-updated'));
        alert('Quitada de favoritos');
      } else {
        const payload = {
          id_externo: obtenerClaveReceta(receta),
          title: receta.title,
          image: receta.image,
          readyInMinutes: receta.readyInMinutes,
          servings: receta.servings,
          extendedIngredients: receta.extendedIngredients || [],
          analyzedInstructions: receta.analyzedInstructions || [],
          tipo: apiBase === '/api/favoritos' ? String(receta?.tipo || tipoReceta) : tipoReceta,
        };

        const response = await fetch('/api/favoritos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          throw new Error(`Error HTTP ${response.status}`);
        }

        const guardado = await response.json();
        setEsFavorito(true);
        setFavoritoId(guardado._id);
        window.dispatchEvent(new Event('favoritos-updated'));
        alert('Guardada en favoritos');
      }
    } catch (error) {
      console.error('Error al alternar favorito:', error);
      alert('No se pudo actualizar favoritos.');
    } finally {
      setProcesandoFavorito(false);
    }
  };

  if (cargando) {
    return <div className="receta-detalle-loading">Cargando receta...</div>;
  }

  if (errorCarga) {
    return (
      <section className="view-section active receta-detalle-page">
        <button
          type="button"
          className="receta-detalle-back"
          onClick={() => navigate(backDestino)}
        >
          <FaArrowLeft aria-hidden="true" />
          <span>Volver</span>
        </button>

        <div className="card receta-detalle-error-card">
          <h2>No se pudo cargar el detalle</h2>
          <p>{errorCarga}</p>
          <div className="receta-detalle-error-actions">
            <button
              type="button"
              className="action-btn"
              onClick={() => window.location.reload()}
            >
              Reintentar
            </button>
            <button
              type="button"
              className="action-btn receta-detalle-dark-btn"
              onClick={() => navigate(backDestino)}
            >
              Volver al listado
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (!receta) {
    return <div className="receta-detalle-loading">No se encontro la receta.</div>;
  }

  const backLabel = backDestino === '/recetas-pendientes'
    ? 'Volver al plan de pendientes'
    : 'Volver a recetas sugeridas';
  const ingredientes = Array.isArray(receta.extendedIngredients) ? receta.extendedIngredients : [];
  const pasos = receta.analyzedInstructions?.[0]?.steps || [];
  const ingredientesConEstado = ingredientes.map((ingrediente, index) => {
    const textoOriginal = String(ingrediente.original || ingrediente.name || '').trim();
    const nombreBase = String(ingrediente.name || '').trim();
    
    const esOpcional = /^opcional\s*:/i.test(textoOriginal);
    const textoNormalizado = esOpcional ? textoOriginal.replace(/^opcional\s*:/i, '').trim() : textoOriginal;
    
    // Comparar ingrediente con despensa: mejor usar name, si no original (trae numeros y texto raro)
    const enDespensa = ingredienteEnDespensa(nombreBase) || ingredienteEnDespensa(textoNormalizado);

    return {
      key: `${textoOriginal}-${index}`,
      texto: textoNormalizado,
      esOpcional,
      enDespensa,
    };
  });
  const ingredientesNecesarios = ingredientesConEstado.filter((item) => !item.esOpcional);
  const totalNecesarios = ingredientesNecesarios.length;
  const totalNecesariosEnDespensa = ingredientesNecesarios.filter((item) => item.enDespensa).length;
  const totalNecesariosFaltan = totalNecesarios - totalNecesariosEnDespensa;
  const totalOpcionalesSin = ingredientesConEstado.filter((item) => item.esOpcional && !item.enDespensa).length;
  const recetaListaParaCocinar = totalNecesariosFaltan === 0;

  return (
    <section className="view-section active receta-detalle-page">
      <button
        type="button"
        className="receta-detalle-back"
        onClick={() => navigate(backDestino)}
      >
        <FaArrowLeft aria-hidden="true" />
        <span>{backLabel}</span>
      </button>

      <div className="card receta-detalle-card">
        <div className="receta-detalle-head">
          <div className="receta-detalle-title-wrap">
            <span className="receta-detalle-kicker">{tipoReceta === 'IA' ? 'Receta sugerida' : 'Detalle de receta'}</span>
            <h1>{receta.title}</h1>
            <div className="receta-detalle-meta">
              <span className="receta-detalle-meta-chip"><FaClock aria-hidden="true" /> {receta.readyInMinutes} minutos</span>
              <span className="receta-detalle-meta-chip"><FaUserFriends aria-hidden="true" /> {receta.servings} raciones</span>
            </div>
          </div>
          <button
            type="button"
            className={esFavorito ? 'receta-fav-btn active' : 'receta-fav-btn'}
            onClick={toggleFavorito}
            disabled={procesandoFavorito}
            aria-label={esFavorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}
            title={esFavorito ? 'Quitar de favoritos' : 'Guardar en favoritos'}
          >
            {esFavorito ? <FaHeart /> : <FaRegHeart />}
          </button>
        </div>

        {receta.source_url && (
          <div className="receta-detalle-source">
            <a
              href={receta.source_url}
              target="_blank"
              rel="noreferrer"
            >
              Ver receta original
            </a>
          </div>
        )}

        <img
          src={receta.image}
          alt={receta.title}
          loading="lazy"
          className="receta-detalle-image"
        />

        <section className="receta-detalle-section">
          <div className="receta-detalle-section-head">
            <div className="receta-detalle-section-title">
              <h3>Ingredientes necesarios</h3>
              <p className="receta-detalle-section-subtitle">
                <span className="ok">{totalNecesariosEnDespensa}/{totalNecesarios} necesarios en despensa</span>
                <span className="sep">•</span>
                <span className="missing">{totalNecesariosFaltan} necesarios por comprar</span>
              </p>
            </div>
            <div className="receta-detalle-section-actions">
              <button
                type="button"
                onClick={togglePendiente}
                disabled={procesandoPendiente}
                className={esPendiente ? 'receta-chip-btn active' : 'receta-chip-btn'}
              >
                {procesandoPendiente
                  ? 'Actualizando...'
                  : esPendiente
                    ? 'Quitar de pendientes'
                    : 'Añadir a pendientes'}
              </button>
              <button
                type="button"
                onClick={() => navigate('/compra-inteligente')}
                className="receta-chip-btn info"
              >
                Ir a la lista de compra
              </button>
            </div>
          </div>

          {recetaListaParaCocinar && totalOpcionalesSin > 0 && (
            <p className="receta-detalle-note ok">
              Puedes cocinar esta receta ya. Te faltan {totalOpcionalesSin} ingrediente(s) opcional(es).
            </p>
          )}

          <ul className="receta-detalle-list">
            {ingredientesConEstado.map((ingrediente) => {
              const claseEstado = ingrediente.esOpcional
                ? 'optional'
                : ingrediente.enDespensa
                  ? 'has'
                  : 'missing';
              const textoEstado = ingrediente.esOpcional
                ? ingrediente.enDespensa
                  ? 'Opcional (lo tienes)'
                  : 'Opcional'
                : ingrediente.enDespensa
                  ? 'En despensa'
                  : 'Necesario';
              return (
                <li
                  key={ingrediente.key}
                  className={`receta-ingrediente-row ${claseEstado}`}
                >
                  <span className="receta-ingrediente-main">
                    {ingrediente.esOpcional && <span className="receta-ingrediente-optional">Opcional</span>}
                    <span className="receta-ingrediente-text">{ingrediente.texto}</span>
                  </span>
                  <span className="receta-ingrediente-status">{textoEstado}</span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="receta-detalle-section">
          <div className="receta-detalle-section-head">
            <h3>Instrucciones paso a paso</h3>
          </div>
          {pasos.length > 0 ? (
            <ol className="receta-detalle-steps">
              {pasos.map((paso) => (
                <li key={paso.number}>
                {paso.step}
              </li>
            ))}
          </ol>
        ) : (
            <p className="receta-detalle-empty">No hay instrucciones detalladas para esta receta.</p>
          )}
        </section>
      </div>
    </section>
  );
};

export default RecetaDetalle;
