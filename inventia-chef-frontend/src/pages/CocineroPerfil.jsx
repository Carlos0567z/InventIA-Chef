import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { getCocineroPerfil, getCocineroRecetas } from '../services/communityApi';
import { showToast } from '../utils/toast';
import {
  FaChevronLeft,
  FaUser,
  FaHeart,
  FaStar,
  FaUtensils,
  FaClock,
  FaAward,
  FaCrown,
  FaCalendarAlt,
  FaCommentAlt,
} from 'react-icons/fa';
import '../styles/Recetas.css';
import '../styles/profileUser.css';

export default function CocineroPerfil() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [cocineroData, setCocineroData] = useState(null);
  const [recetas, setRecetas] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setCargando(true);
        const [perfilRes, recetasRes] = await Promise.all([
          getCocineroPerfil(id),
          getCocineroRecetas(id),
        ]);

        if (cancelled) return;
        setCocineroData(perfilRes);
        setRecetas(Array.isArray(recetasRes) ? recetasRes : []);
      } catch (err) {
        if (!cancelled) {
          showToast(err.message || 'No se pudo cargar el perfil del cocinero.', 'error');
        }
      } finally {
        if (!cancelled) setCargando(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id]);

  if (cargando) {
    return (
      <section className="view-section active cocinero-profile-view">
        <div style={{ textAlign: 'center', padding: '80px 20px', color: '#64748b' }}>
          <h2>Cargando perfil gastronómico...</h2>
        </div>
      </section>
    );
  }

  if (!cocineroData || !cocineroData.cocinero) {
    return (
      <section className="view-section active cocinero-profile-view">
        <button type="button" className="receta-detalle-back" onClick={() => navigate('/recetas-comunidad')}>
          <FaChevronLeft /> Volver a la comunidad
        </button>
        <div className="empty-state" style={{ padding: '60px 20px', textAlign: 'center' }}>
          <h2>Cocinero no encontrado</h2>
          <p>Este perfil no está disponible o el usuario no ha publicado contenido todavía.</p>
        </div>
      </section>
    );
  }

  const { cocinero, metricas = {}, insignias = [] } = cocineroData;
  const fechaRegistro = cocinero.fecha_registro
    ? new Date(cocinero.fecha_registro).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })
    : 'Miembro de la comunidad';

  return (
    <section className="view-section active cocinero-profile-view profile-shell">
      <button
        type="button"
        className="receta-detalle-back"
        onClick={() => navigate('/recetas-comunidad')}
        style={{ marginBottom: 16 }}
      >
        <FaChevronLeft /> Volver a la comunidad
      </button>

      <div className="chef-unified-container">
        {/* Banner Superior */}
        <div className="chef-banner">
          <div
            className="chef-banner-bg"
            style={{
              backgroundImage: cocinero.imagen_banner
                ? `url(${cocinero.imagen_banner})`
                : 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              backgroundColor: !cocinero.imagen_banner ? '#0f172a' : 'transparent',
            }}
          />
        </div>

        <div className="chef-content-wrapper">
          {/* Cabecera del Cocinero */}
          <div className="chef-header-section" style={{ borderBottom: '1px solid #f1f5f9', paddingBottom: 28, marginBottom: 28 }}>
            <div className="chef-avatar-wrapper" style={{ position: 'relative' }}>
              <div className="chef-avatar" style={{ width: 100, height: 100, borderRadius: '50%', overflow: 'hidden', border: '4px solid white', boxShadow: '0 8px 24px -4px rgba(0,0,0,0.15)' }}>
                {cocinero.imagen_perfil ? (
                  <img src={cocinero.imagen_perfil} alt={cocinero.nombre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f1f5f9', color: '#94a3b8', fontSize: '2.5rem' }}>
                    <FaUser />
                  </div>
                )}
              </div>
            </div>

            <div className="chef-info-grid">
              <div className="chef-info-left">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className="badge-premium" style={{ background: '#f43f5e', color: 'white' }}>
                    Chef Comunitario
                  </span>
                  {cocinero.rol === 'admin' && (
                    <span className="badge-premium" style={{ background: '#0f172a', color: '#f8fafc', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                      <FaCrown style={{ color: '#f59e0b' }} /> Staff / Admin
                    </span>
                  )}
                </div>

                <h1 className="chef-name" style={{ fontSize: '2.2rem', margin: '8px 0 4px', color: '#0f172a', fontWeight: 900 }}>
                  {cocinero.nombre}
                </h1>

                <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <FaCalendarAlt /> Cocinando desde {fechaRegistro}
                </p>

                {cocinero.biografia ? (
                  <p style={{ margin: 0, color: '#334155', fontSize: '1.02rem', lineHeight: 1.6, maxWidth: 650 }}>
                    {cocinero.biografia}
                  </p>
                ) : (
                  <p style={{ margin: 0, color: '#94a3b8', fontStyle: 'italic', fontSize: '0.95rem' }}>
                    Este cocinero deja que sus recetas hablen por él.
                  </p>
                )}
              </div>

              {/* Métricas destacadas */}
              <div className="chef-info-right">
                <div className="chef-stats-horizontal" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 20, padding: '16px 24px', display: 'flex', gap: 24, alignItems: 'center' }}>
                  <div className="chef-stat-item" style={{ textAlign: 'center' }}>
                    <span className="stat-value" style={{ display: 'block', fontSize: '1.6rem', fontWeight: 900, color: '#0f172a' }}>
                      {metricas.recetas_count || 0}
                    </span>
                    <span className="stat-label" style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Recetas
                    </span>
                  </div>

                  <div style={{ width: 1, height: 36, background: '#cbd5e1' }} />

                  <div className="chef-stat-item" style={{ textAlign: 'center' }}>
                    <span className="stat-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: '1.6rem', fontWeight: 900, color: '#f43f5e' }}>
                      <FaHeart style={{ fontSize: '1.2rem' }} /> {metricas.likes_totales || 0}
                    </span>
                    <span className="stat-label" style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Likes Totales
                    </span>
                  </div>

                  <div style={{ width: 1, height: 36, background: '#cbd5e1' }} />

                  <div className="chef-stat-item" style={{ textAlign: 'center' }}>
                    <span className="stat-value" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontSize: '1.6rem', fontWeight: 900, color: '#d97706' }}>
                      <FaStar style={{ fontSize: '1.2rem' }} /> {metricas.puntuacion_media > 0 ? metricas.puntuacion_media.toFixed(1) : '-'}
                    </span>
                    <span className="stat-label" style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700, textTransform: 'uppercase' }}>
                      Valoración
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Insignias Culinarias */}
          {insignias.length > 0 && (
            <div style={{ marginBottom: 36 }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FaAward style={{ color: '#f59e0b' }} /> Insignias Gastronómicas
              </h3>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {insignias.map((ins) => (
                  <span
                    key={ins.id}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                      background: '#fffbeb',
                      border: '1px solid #fde68a',
                      color: '#92400e',
                      padding: '8px 16px',
                      borderRadius: 999,
                      fontWeight: 700,
                      fontSize: '0.86rem',
                    }}
                  >
                    {ins.icono === 'crown' && <FaCrown style={{ color: '#d97706' }} />}
                    {ins.icono === 'star' && <FaStar style={{ color: '#d97706' }} />}
                    {ins.icono === 'heart' && <FaHeart style={{ color: '#f43f5e' }} />}
                    {ins.icono === 'award' && <FaAward style={{ color: '#0284c7' }} />}
                    {ins.icono === 'utensils' && <FaUtensils style={{ color: '#16a34a' }} />}
                    {ins.nombre}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Recetas publicadas por el cocinero */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, color: '#0f172a', margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
                <FaUtensils /> Recetas de {cocinero.nombre} ({recetas.length})
              </h2>
            </div>

            {recetas.length === 0 ? (
              <div className="empty-state" style={{ padding: '40px 20px', background: '#f8fafc', borderRadius: 24, textAlign: 'center' }}>
                <h3 style={{ margin: '0 0 8px', color: '#334155' }}>Aún no ha publicado recetas</h3>
                <p style={{ margin: 0, color: '#64748b' }}>
                  Este cocinero todavía está horneando sus primeras creaciones.
                </p>
              </div>
            ) : (
              <div className="recetas-grid">
                {recetas.map((r) => {
                  const rating = Number(r.puntuacion_media) || 0;
                  const likes = Number(r.numero_likes) || 0;
                  const comentariosCount = Number(r.numero_comentarios) || 0;
                  const tiempo = r.readyInMinutes || r.versiones?.[0]?.readyInMinutes || 25;

                  return (
                    <div
                      key={r._id || r.id_externo}
                      className="receta-card"
                      onClick={() => navigate(`/recetas-comunidad/${r._id || r.id_externo}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') navigate(`/recetas-comunidad/${r._id || r.id_externo}`);
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <img
                        src={r.image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=500'}
                        alt={r.title}
                        className="receta-image"
                        loading="lazy"
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=500';
                        }}
                      />
                      <h3>{r.title}</h3>
                      <div className="receta-card-stats-row">
                        <span className="stat-item"><FaClock className="stat-icon" /> {tiempo} min</span>
                        <span className="stat-divider">·</span>
                        <span className="stat-item" style={{ color: '#f43f5e' }}>
                          <FaHeart className="stat-icon" /> {likes}
                        </span>
                        {rating > 0 && (
                          <>
                            <span className="stat-divider">·</span>
                            <span className="stat-item" style={{ color: '#d97706' }}>
                              <FaStar className="stat-icon" /> {rating.toFixed(1)}
                            </span>
                          </>
                        )}
                        {comentariosCount > 0 && (
                          <>
                            <span className="stat-divider">·</span>
                            <span className="stat-item">
                              <FaCommentAlt className="stat-icon" /> {comentariosCount}
                            </span>
                          </>
                        )}
                      </div>
                      {r.description && (
                        <p style={{ margin: '8px 0 0', fontSize: '0.88rem', color: '#64748b', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {r.description}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
