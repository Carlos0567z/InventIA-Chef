import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  getRecetaComunidad,
  toggleLikeReceta,
  getComentarios,
  crearComentario,
  responderComentario,
  eliminarComentario,
} from '../services/communityApi';
import { isAuthenticated, getSession } from '../services/auth';
import { showToast } from '../utils/toast';
import {
  FaChevronLeft,
  FaClock,
  FaUsers,
  FaAward,
  FaUser,
  FaPlus,
  FaHeart,
  FaRegHeart,
  FaStar,
  FaRegStar,
  FaCommentAlt,
  FaShareAlt,
  FaTrashAlt,
  FaReply,
  FaCheck,
  FaBookmark,
  FaRegBookmark,
  FaCalendarPlus,
  FaCalendarCheck,
} from 'react-icons/fa';
import '../styles/Recetas.css';
import '../styles/RecetaDetalle.css';

export default function RecetaComunidadDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [receta, setReceta] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [versionActiva, setVersionActiva] = useState(0);

  // Estados Sociales
  const [liked, setLiked] = useState(false);
  const [numeroLikes, setNumeroLikes] = useState(0);
  const [likeEnProgreso, setLikeEnProgreso] = useState(false);

  // Favoritos & Pendientes
  const [esFavorita, setEsFavorita] = useState(false);
  const [esPendiente, setEsPendiente] = useState(false);

  // Comentarios & Valoraciones
  const [comentarios, setComentarios] = useState([]);
  const [cargandoComentarios, setCargandoComentarios] = useState(false);
  const [puntuacionNueva, setPuntuacionNueva] = useState(5);
  const [hoverPuntuacion, setHoverPuntuacion] = useState(0);
  const [contenidoNuevo, setContenidoNuevo] = useState('');
  const [enviandoComentario, setEnviandoComentario] = useState(false);

  // Respuestas
  const [replyOpenMap, setReplyOpenMap] = useState({});
  const [replyTextMap, setReplyTextMap] = useState({});
  const [enviandoRespuestaMap, setEnviandoRespuestaMap] = useState({});

  // Checklist de ingredientes para cocinar interactivamente
  const [ingredientesMarcados, setIngredientesMarcados] = useState({});

  const currentUser = useMemo(() => {
    try {
      const s = getSession();
      return s?.user || null;
    } catch {
      return null;
    }
  }, []);

  // Cargar datos de la receta
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setCargando(true);
        const data = await getRecetaComunidad(id);
        if (cancelled) return;
        setReceta(data);
        setLiked(Boolean(data.has_liked));
        setNumeroLikes(Number(data.numero_likes) || 0);

        // Sincronizar estado de favorito y pendiente
        comprobarFavoritoYPendiente(data);
      } catch (error) {
        if (!cancelled) {
          showToast(error.message || 'No se pudo cargar la receta.', 'error');
        }
      } finally {
        if (!cancelled) setCargando(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Cargar comentarios
  useEffect(() => {
    if (!receta?._id && !id) return;
    let cancelled = false;
    (async () => {
      try {
        setCargandoComentarios(true);
        const list = await getComentarios(receta?._id || id);
        if (!cancelled) setComentarios(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setComentarios([]);
      } finally {
        if (!cancelled) setCargandoComentarios(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [receta?._id, id]);

  const comprobarFavoritoYPendiente = async (recetaData) => {
    if (!isAuthenticated()) return;
    const clave = String(recetaData?.id_externo || recetaData?._id || id);

    try {
      const [resFav, resPend] = await Promise.all([
        fetch('/api/favoritos', { credentials: 'same-origin' }),
        fetch('/api/recetas-pendientes', { credentials: 'same-origin' }),
      ]);

      if (resFav.ok) {
        const favs = await resFav.json();
        const found = favs.some((f) => String(f.id_externo) === clave || String(f._id) === clave);
        setEsFavorita(found);
      }

      if (resPend.ok) {
        const pends = await resPend.json();
        const found = pends.some((p) => String(p.id_externo) === clave || String(p._id) === clave);
        setEsPendiente(found);
      }
    } catch {
      // Ignorar fallos de sincronizacion silenciosos
    }
  };

  const handleToggleLike = async () => {
    if (!isAuthenticated()) {
      showToast('Inicia sesión para dar me gusta a esta receta.', 'info');
      navigate(`/auth?next=/recetas-comunidad/${id}`);
      return;
    }
    if (likeEnProgreso) return;

    setLikeEnProgreso(true);
    const nuevoEstado = !liked;
    setLiked(nuevoEstado);
    setNumeroLikes((prev) => (nuevoEstado ? prev + 1 : Math.max(0, prev - 1)));

    try {
      const res = await toggleLikeReceta(receta?._id || id);
      setLiked(res.liked);
      setNumeroLikes(res.numero_likes);
      showToast(res.liked ? '¡Te gusta esta receta!' : 'Has retirado tu me gusta', 'success');
    } catch (err) {
      // Rollback en caso de error
      setLiked(!nuevoEstado);
      setNumeroLikes((prev) => (!nuevoEstado ? prev + 1 : Math.max(0, prev - 1)));
      showToast(err.message || 'Error al procesar el like', 'error');
    } finally {
      setLikeEnProgreso(false);
    }
  };

  const handleToggleFavorito = async () => {
    if (!isAuthenticated()) {
      showToast('Inicia sesión para guardar recetas en favoritas.', 'info');
      navigate(`/auth?next=/recetas-comunidad/${id}`);
      return;
    }

    try {
      const clave = String(receta?.id_externo || receta?._id || id);
      if (esFavorita) {
        // Buscar id del favorito para eliminarlo
        const listRes = await fetch('/api/favoritos');
        if (listRes.ok) {
          const list = await listRes.json();
          const target = list.find((f) => String(f.id_externo) === clave);
          if (target?._id) {
            await fetch(`/api/favoritos/${target._id}`, { method: 'DELETE' });
            setEsFavorita(false);
            window.dispatchEvent(new Event('favoritos-updated'));
            showToast('Receta quitada de tus favoritas', 'info');
          }
        }
      } else {
        await fetch('/api/favoritos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_externo: clave,
            title: receta?.title,
            image: receta?.image,
            readyInMinutes: currentVersion.readyInMinutes,
            servings: currentVersion.numero_personas,
            tipo: 'Comunidad',
          }),
        });
        setEsFavorita(true);
        window.dispatchEvent(new Event('favoritos-updated'));
        showToast('¡Guardada en tus recetas favoritas!', 'success');
      }
    } catch {
      showToast('Error al actualizar favoritas', 'error');
    }
  };

  const handleTogglePendiente = async () => {
    if (!isAuthenticated()) {
      showToast('Inicia sesión para añadir recetas al plan.', 'info');
      navigate(`/auth?next=/recetas-comunidad/${id}`);
      return;
    }

    try {
      const clave = String(receta?.id_externo || receta?._id || id);
      if (esPendiente) {
        const listRes = await fetch('/api/recetas-pendientes');
        if (listRes.ok) {
          const list = await listRes.json();
          const target = list.find((p) => String(p.id_externo) === clave);
          if (target?._id) {
            await fetch(`/api/recetas-pendientes/${target._id}`, { method: 'DELETE' });
            setEsPendiente(false);
            window.dispatchEvent(new Event('pendientes-updated'));
            showToast('Receta quitada de pendientes', 'info');
          }
        }
      } else {
        await fetch('/api/recetas-pendientes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id_externo: clave,
            title: receta?.title,
            image: receta?.image,
            readyInMinutes: currentVersion.readyInMinutes,
            servings: currentVersion.numero_personas,
            extendedIngredients: currentVersion.extendedIngredients,
            analyzedInstructions: currentVersion.analyzedInstructions,
            tipo: 'Comunidad',
          }),
        });
        setEsPendiente(true);
        window.dispatchEvent(new Event('pendientes-updated'));
        showToast('¡Añadida al plan de recetas pendientes!', 'success');
      }
    } catch {
      showToast('Error al actualizar plan de recetas', 'error');
    }
  };

  const handleCompartir = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href);
        showToast('¡Enlace de la receta copiado al portapapeles!', 'success');
      } else {
        showToast(window.location.href, 'info');
      }
    } catch {
      showToast('No se pudo copiar el enlace', 'error');
    }
  };

  const handlePublicarComentario = async (e) => {
    e.preventDefault();
    if (!isAuthenticated()) {
      showToast('Inicia sesión para opinar sobre esta receta.', 'info');
      navigate(`/auth?next=/recetas-comunidad/${id}`);
      return;
    }

    const texto = String(contenidoNuevo || '').trim();
    if (!texto) {
      showToast('Escribe tu opinión antes de enviar.', 'error');
      return;
    }
    if (texto.length > 600) {
      showToast('El comentario no puede superar los 600 caracteres.', 'error');
      return;
    }

    try {
      setEnviandoComentario(true);
      const res = await crearComentario(receta?._id || id, {
        puntuacion: puntuacionNueva,
        contenido: texto,
      });

      setComentarios((prev) => [res.comentario, ...prev]);
      setReceta((prev) => ({
        ...prev,
        numero_comentarios: res.numero_comentarios,
        puntuacion_media: res.puntuacion_media,
      }));
      setContenidoNuevo('');
      setPuntuacionNueva(5);
      showToast('¡Gracias por tu valoración!', 'success');
    } catch (err) {
      showToast(err.message || 'Error al enviar valoración', 'error');
    } finally {
      setEnviandoComentario(false);
    }
  };

  const handleResponder = async (comentarioId) => {
    const texto = String(replyTextMap[comentarioId] || '').trim();
    if (!texto) return;

    try {
      setEnviandoRespuestaMap((prev) => ({ ...prev, [comentarioId]: true }));
      const actualizado = await responderComentario(receta?._id || id, comentarioId, texto);

      setComentarios((prev) =>
        prev.map((c) => (String(c._id) === String(comentarioId) ? actualizado : c))
      );
      setReplyTextMap((prev) => ({ ...prev, [comentarioId]: '' }));
      setReplyOpenMap((prev) => ({ ...prev, [comentarioId]: false }));
      showToast('Respuesta enviada', 'success');
    } catch (err) {
      showToast(err.message || 'Error al enviar respuesta', 'error');
    } finally {
      setEnviandoRespuestaMap((prev) => ({ ...prev, [comentarioId]: false }));
    }
  };

  const handleEliminarComentario = async (comentarioId) => {
    if (!window.confirm('¿Seguro que deseas eliminar este comentario?')) return;

    try {
      const res = await eliminarComentario(receta?._id || id, comentarioId);
      setComentarios((prev) => prev.filter((c) => String(c._id) !== String(comentarioId)));
      setReceta((prev) => ({
        ...prev,
        numero_comentarios: res.numero_comentarios,
        puntuacion_media: res.puntuacion_media,
      }));
      showToast('Comentario eliminado', 'info');
    } catch (err) {
      showToast(err.message || 'No se pudo eliminar el comentario', 'error');
    }
  };

  const toggleIngredienteCheck = (idx) => {
    setIngredientesMarcados((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  if (cargando) {
    return (
      <section className="view-section active receta-comunidad-detalle">
        <div className="receta-detalle-loading">
          <p>Cargando receta gourmet de la comunidad...</p>
        </div>
      </section>
    );
  }

  if (!receta) {
    return (
      <section className="view-section active receta-comunidad-detalle">
        <button type="button" className="receta-detalle-back" onClick={() => navigate('/recetas-comunidad')}>
          <FaChevronLeft /> Volver a la comunidad
        </button>
        <div className="empty-state">
          <h2>Receta no encontrada</h2>
          <p>La receta que buscas no existe o ha sido retirada por su autor.</p>
        </div>
      </section>
    );
  }

  const versiones = Array.isArray(receta.versiones) && receta.versiones.length
    ? receta.versiones
    : [{
      numero_personas: receta.servings || 2,
      readyInMinutes: receta.readyInMinutes || 25,
      extendedIngredients: receta.extendedIngredients || [],
      analyzedInstructions: receta.analyzedInstructions || [],
    }];

  const currentVersion = versiones[versionActiva] || versiones[0];
  const puntuacion = Number(receta.puntuacion_media) || 0;
  const numComentarios = Number(receta.numero_comentarios) || comentarios.length;

  return (
    <section className="view-section active receta-comunidad-detalle">
      <div className="receta-detalle-top-nav" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <button type="button" className="receta-detalle-back" onClick={() => navigate('/recetas-comunidad')}>
          <FaChevronLeft /> Volver a la comunidad
        </button>

        <div className="receta-detalle-quick-actions" style={{ display: 'flex', gap: 10 }}>
          <button
            type="button"
            className={`receta-detalle-back ${esFavorita ? 'active' : ''}`}
            onClick={handleToggleFavorito}
            title={esFavorita ? 'Quitar de favoritas' : 'Guardar en favoritas'}
            style={esFavorita ? { color: '#f43f5e', borderColor: '#fecdd3', background: '#fff1f2' } : {}}
          >
            {esFavorita ? <FaBookmark /> : <FaRegBookmark />}
            <span>{esFavorita ? 'Favorita' : 'Guardar'}</span>
          </button>

          <button
            type="button"
            className={`receta-detalle-back ${esPendiente ? 'active' : ''}`}
            onClick={handleTogglePendiente}
            title={esPendiente ? 'Quitar de pendientes' : 'Añadir a plan'}
            style={esPendiente ? { color: '#0284c7', borderColor: '#bae6fd', background: '#f0f9ff' } : {}}
          >
            {esPendiente ? <FaCalendarCheck /> : <FaCalendarPlus />}
            <span>{esPendiente ? 'En Plan' : 'Planificar'}</span>
          </button>

          <button
            type="button"
            className="receta-detalle-back"
            onClick={handleCompartir}
            title="Copiar enlace para compartir"
          >
            <FaShareAlt />
            <span>Compartir</span>
          </button>
        </div>
      </div>

      <div className="receta-detalle-container-premium">
        {/* Imagen Hero con Botón Flotante de Likes */}
        <div className="receta-detalle-hero-image-wrapper" style={{ position: 'relative' }}>
          <img
            src={receta.image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=500'}
            alt={receta.title}
            className="receta-detalle-hero-img"
            onError={(e) => {
              e.target.onerror = null;
              e.target.src = 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=500';
            }}
          />

          {/* Botón flotante de Like interactivo */}
          <button
            type="button"
            className={`like-fav-pills ${liked ? 'active' : ''}`}
            onClick={handleToggleLike}
            aria-label={liked ? 'Quitar me gusta' : 'Dar me gusta'}
            disabled={likeEnProgreso}
          >
            {liked ? <FaHeart /> : <FaRegHeart />}
            <span>{numeroLikes} {numeroLikes === 1 ? 'Me gusta' : 'Me gustas'}</span>
          </button>
        </div>

        {/* Tarjeta de Contenido Principal */}
        <div className="receta-detalle-card-premium">
          <header className="receta-header-main">
            <div className="header-badge">Comunidad InventIA Chef</div>
            <h1>{receta.title}</h1>
            <p className="description-text-premium">
              {receta.description || 'Una deliciosa receta compartida con la comunidad.'}
            </p>

            <div className="header-info-row">
              {/* Tarjeta de autor con enlace al perfil público de cocinero */}
              <Link
                to={`/cocinero/${receta.autor_id}`}
                className="author-info-premium"
                style={{ textDecoration: 'none', color: 'inherit' }}
                title={`Ver perfil del cocinero ${receta.autor_nombre}`}
              >
                <div className="author-avatar-wrapper">
                  {receta.autor_image ? (
                    <img src={receta.autor_image} alt={receta.autor_nombre} className="author-img-circle" />
                  ) : (
                    <div className="author-icon-placeholder"><FaUser /></div>
                  )}
                </div>
                <div className="author-text">
                  <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Creada por</span>
                  <strong style={{ display: 'block', fontSize: '1.05rem', color: '#0f172a' }}>
                    {receta.autor_nombre || 'Chef Anónimo'}
                  </strong>
                  <span style={{ fontSize: '0.75rem', color: '#f43f5e', fontWeight: 700 }}>Ver perfil de cocinero →</span>
                </div>
              </Link>

              {/* Estadísticas rápidas */}
              <div className="quick-stats-row">
                <div className="quick-stat" title="Tiempo estimado">
                  <FaClock /> {currentVersion.readyInMinutes} min
                </div>
                <div className="quick-stat" title="Raciones calculadas">
                  <FaUsers /> {currentVersion.numero_personas} pers.
                </div>
                <div className="quick-stat" title="Valoración media de la comunidad" style={{ color: '#d97706' }}>
                  <FaStar /> {puntuacion > 0 ? puntuacion.toFixed(1) : 'Nuevo'} ({numComentarios})
                </div>
              </div>
            </div>
          </header>

          {/* Sección de Elaboración e Ingredientes */}
          <section className="preparacion-section-premium">
            <div className="section-header-flex">
              <h2><FaAward /> Elaboración y Pasos</h2>
              <div className="rations-switcher-premium">
                <span>Raciones:</span>
                <div className="rations-pills">
                  {versiones.map((v, idx) => (
                    <button
                      key={`v-${idx}`}
                      type="button"
                      className={idx === versionActiva ? 'pill active' : 'pill'}
                      onClick={() => setVersionActiva(idx)}
                    >
                      {v.numero_personas}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="preparacion-grid-premium">
              {/* Columna de Ingredientes interactiva */}
              <div className="ingredients-col">
                <h3><FaPlus /> Ingredientes ({currentVersion.extendedIngredients?.length || 0})</h3>
                <p style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: 12 }}>
                  Marca los ingredientes a medida que los vayas preparando en tu cocina:
                </p>
                <ul className="ing-list-premium" style={{ listStyle: 'none', padding: 0 }}>
                  {(currentVersion.extendedIngredients || []).map((ing, i) => {
                    const marcado = Boolean(ingredientesMarcados[i]);
                    const texto = ing.original || `${ing.cantidad || ''} ${ing.unidad || ''} ${ing.name || ''}`.trim();
                    return (
                      <li
                        key={`i-${i}`}
                        onClick={() => toggleIngredienteCheck(i)}
                        style={{
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 12,
                          padding: '10px 14px',
                          borderRadius: 12,
                          background: marcado ? '#f0fdf4' : '#ffffff',
                          border: `1px solid ${marcado ? '#bbf7d0' : '#e2e8f0'}`,
                          marginBottom: 8,
                          transition: 'all 0.2s ease',
                          textDecoration: marcado ? 'line-through' : 'none',
                          color: marcado ? '#166534' : '#1e293b',
                        }}
                      >
                        <span
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 6,
                            border: `2px solid ${marcado ? '#22c55e' : '#cbd5e1'}`,
                            background: marcado ? '#22c55e' : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '0.75rem',
                            flexShrink: 0,
                          }}
                        >
                          {marcado && <FaCheck />}
                        </span>
                        <span>{texto}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Columna de Pasos */}
              <div className="steps-col">
                <h3><FaClock /> Pasos detallados</h3>
                <div className="steps-list-premium">
                  {(currentVersion.analyzedInstructions?.[0]?.steps || []).length > 0 ? (
                    (currentVersion.analyzedInstructions[0].steps).map((s, i) => (
                      <div key={`s-${i}`} className="step-item-premium">
                        <div className="step-number-circle">{s.number || i + 1}</div>
                        <div className="step-text-box">
                          <p>{s.step}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="step-item-premium">
                      <div className="step-number-circle">1</div>
                      <div className="step-text-box">
                        <p>Sigue las instrucciones tradicionales del autor para preparar este plato a fuego lento.</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* ============================================================ */}
          {/* SECCIÓN SOCIAL: VALORACIONES Y COMENTARIOS */}
          {/* ============================================================ */}
          <section className="valoraciones-section-premium">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, marginBottom: 30 }}>
              <div>
                <h2><FaCommentAlt /> Opiniones y Valoraciones</h2>
                <p style={{ color: '#64748b', margin: 0, fontSize: '0.95rem' }}>
                  {numComentarios === 0
                    ? 'Aún no hay comentarios. ¡Sé el primero en probarla!'
                    : `Basado en ${numComentarios} ${numComentarios === 1 ? 'opinión de la comunidad' : 'opiniones de la comunidad'}.`}
                </p>
              </div>

              {/* Score badge grande */}
              {puntuacion > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: '#fffbeb',
                    border: '1px solid #fef3c7',
                    padding: '12px 20px',
                    borderRadius: 20,
                  }}
                >
                  <div style={{ fontSize: '2.2rem', fontWeight: 900, color: '#d97706', lineHeight: 1 }}>
                    {puntuacion.toFixed(1)}
                  </div>
                  <div>
                    <div style={{ display: 'flex', gap: 3, color: '#f59e0b', fontSize: '1rem' }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span key={star}>
                          {puntuacion >= star ? <FaStar /> : <FaRegStar />}
                        </span>
                      ))}
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#92400e' }}>
                      Puntuación media
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Formulario para comentar y calificar con estrellas */}
            <form onSubmit={handlePublicarComentario} className="valorar-form-premium">
              <div className="valorar-form-header">
                <span>Tu valoración:</span>
                <div className="stars-selector-interactive" style={{ display: 'inline-flex', gap: 8 }}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setPuntuacionNueva(star)}
                      onMouseEnter={() => setHoverPuntuacion(star)}
                      onMouseLeave={() => setHoverPuntuacion(0)}
                      aria-label={`${star} estrellas`}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 2,
                        fontSize: '1.6rem',
                        color: (hoverPuntuacion || puntuacionNueva) >= star ? '#f59e0b' : '#cbd5e1',
                        transition: 'transform 0.15s ease, color 0.15s ease',
                      }}
                    >
                      <FaStar />
                    </button>
                  ))}
                  <span style={{ marginLeft: 8, fontSize: '0.9rem', fontWeight: 800, color: '#475569' }}>
                    {puntuacionNueva === 5
                      ? '5/5 — ¡Increíble!'
                      : puntuacionNueva === 4
                      ? '4/5 — Muy buena'
                      : puntuacionNueva === 3
                      ? '3/5 — Bien'
                      : puntuacionNueva === 2
                      ? '2/5 — Mejorable'
                      : '1/5 — No me convenció'}
                  </span>
                </div>
              </div>

              <div className="valorar-form-body">
                <textarea
                  value={contenidoNuevo}
                  onChange={(e) => setContenidoNuevo(e.target.value)}
                  placeholder="¿Cómo te ha quedado? Comparte tus trucos, si añadiste algún ingrediente extra o consejos para otros cocineros..."
                  maxLength={600}
                  required
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                    {contenidoNuevo.length} / 600 caracteres
                  </span>
                  <button
                    type="submit"
                    className="btn-publi"
                    disabled={enviandoComentario}
                  >
                    {enviandoComentario ? 'Publicando...' : 'Publicar valoración'}
                  </button>
                </div>
              </div>
            </form>

            {/* Listado de Comentarios */}
            <div className="comentarios-list-premium">
              {cargandoComentarios ? (
                <p style={{ textAlign: 'center', color: '#64748b' }}>Cargando opiniones...</p>
              ) : comentarios.length === 0 ? (
                <div className="empty-state" style={{ padding: '30px 20px', background: '#f8fafc', borderRadius: 24, textAlign: 'center' }}>
                  <h3 style={{ margin: '0 0 8px', color: '#334155' }}>Aún no hay opiniones</h3>
                  <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>
                    ¿Has preparado esta receta? Sé la primera persona en compartir cómo te quedó y puntuarla con estrellas.
                  </p>
                </div>
              ) : (
                comentarios.map((c) => {
                  const esMio = currentUser && String(currentUser.id) === String(c.autor_id);
                  const esAdmin = currentUser && currentUser.rol === 'admin';
                  const puedeBorrar = esMio || esAdmin;
                  const replyOpen = Boolean(replyOpenMap[c._id]);
                  const replyText = replyTextMap[c._id] || '';
                  const enviandoResp = Boolean(enviandoRespuestaMap[c._id]);
                  const fechaStr = c.fecha ? new Date(c.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

                  return (
                    <article key={c._id} className="comentario-item-premium">
                      <div className="comentario-header-p">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <Link
                            to={`/cocinero/${c.autor_id}`}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}
                            title={`Ver perfil de ${c.autor_nombre}`}
                          >
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: '50%',
                                overflow: 'hidden',
                                background: '#f1f5f9',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                border: '2px solid #e2e8f0',
                                color: '#94a3b8',
                              }}
                            >
                              {c.autor_imagen ? (
                                <img src={c.autor_imagen} alt={c.autor_nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                <FaUser />
                              )}
                            </div>
                            <div>
                              <strong>{c.autor_nombre}</strong>
                              <div className="comentario-date-p" style={{ marginTop: 2 }}>{fechaStr}</div>
                            </div>
                          </Link>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div className="comentario-stars-p">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <span key={s} style={{ color: (c.puntuacion || 5) >= s ? '#f59e0b' : '#cbd5e1' }}>
                                ★
                              </span>
                            ))}
                          </div>

                          {puedeBorrar && (
                            <button
                              type="button"
                              onClick={() => handleEliminarComentario(c._id)}
                              style={{
                                background: 'none',
                                border: 'none',
                                color: '#94a3b8',
                                cursor: 'pointer',
                                padding: '6px 10px',
                                borderRadius: 8,
                                transition: 'all 0.2s',
                              }}
                              title="Eliminar este comentario"
                            >
                              <FaTrashAlt />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="comentario-body-p">
                        {c.contenido}
                      </div>

                      <div className="comentario-footer-p">
                        <button
                          type="button"
                          className="reply-to-user-btn"
                          onClick={() => setReplyOpenMap((prev) => ({ ...prev, [c._id]: !prev[c._id] }))}
                        >
                          <FaReply /> {replyOpen ? 'Cancelar respuesta' : 'Responder'}
                        </button>
                      </div>

                      {/* Caja de respuesta rápida */}
                      {replyOpen && (
                        <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
                          <input
                            type="text"
                            value={replyText}
                            onChange={(e) => setReplyTextMap((prev) => ({ ...prev, [c._id]: e.target.value }))}
                            placeholder={`Responder a ${c.autor_nombre}...`}
                            maxLength={400}
                            style={{
                              flex: 1,
                              padding: '10px 16px',
                              borderRadius: 12,
                              border: '1px solid #e2e8f0',
                              fontSize: '0.95rem',
                            }}
                          />
                          <button
                            type="button"
                            className="btn-ok-resp"
                            onClick={() => handleResponder(c._id)}
                            disabled={enviandoResp}
                          >
                            {enviandoResp ? '...' : 'Enviar'}
                          </button>
                        </div>
                      )}

                      {/* Respuestas anidadas */}
                      {Array.isArray(c.respuestas) && c.respuestas.length > 0 && (
                        <div className="respuestas-list-wrapper-p">
                          {c.respuestas.map((r, rIdx) => {
                            const esAutorReceta = String(r.autor_id) === String(receta.autor_id);
                            const rFechaStr = r.fecha ? new Date(r.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) : '';
                            return (
                              <div
                                key={r._id || rIdx}
                                className={`respuesta-item-p ${esAutorReceta ? 'is-author' : ''}`}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                                  <Link
                                    to={`/cocinero/${r.autor_id}`}
                                    style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: 'inherit' }}
                                  >
                                    <strong style={{ fontSize: '0.9rem', color: '#0f172a' }}>
                                      {r.autor_nombre}
                                    </strong>
                                    {esAutorReceta && (
                                      <span
                                        style={{
                                          fontSize: '0.68rem',
                                          fontWeight: 800,
                                          background: '#f43f5e',
                                          color: 'white',
                                          padding: '2px 6px',
                                          borderRadius: 999,
                                        }}
                                      >
                                        Chef Creador
                                      </span>
                                    )}
                                  </Link>
                                  <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{rFechaStr}</span>
                                </div>
                                <p style={{ margin: 0, fontSize: '0.92rem', color: '#334155' }}>
                                  {r.texto}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
