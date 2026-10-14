import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FaArrowRight,
  FaUtensils,
  FaCamera,
  FaShoppingBasket,
  FaUsers,
  FaBook,
  FaClock,
  FaBoxOpen,
  FaHeart,
  FaStar,
  FaExclamationTriangle,
  FaCheckCircle,
  FaMagic,
  FaBarcode,
  FaShieldAlt,
} from 'react-icons/fa';
import '../styles/home.css';
import { isAuthenticated, getCurrentUser } from '../services/auth';

export default function Home() {
  const navigate = useNavigate();
  const loggedIn = isAuthenticated();
  const currentUser = useMemo(() => getCurrentUser(), [loggedIn]);
  const userFirstName = currentUser?.nombre ? currentUser.nombre.split(' ')[0] : '';

  const [sugerenciaChef, setSugerenciaChef] = useState(null);
  const [sugerenciaComunidad, setSugerenciaComunidad] = useState(null);
  const [sugerenciaClasica, setSugerenciaClasica] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [totalAlimentos, setTotalAlimentos] = useState(0);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!loggedIn) return;

    const cargarDatosInicio = async () => {
      setCargando(true);
      try {
        // 1. Sugerencia Chef IA
        const resChef = await fetch('/api/recetas-ia/sugerencias?total=1');
        if (resChef.ok) {
          const dataChef = await resChef.json();
          if (dataChef && dataChef[0]) setSugerenciaChef(dataChef[0]);
        }

        // 2. Sugerencia destacada Comunidad
        const resCom = await fetch('/api/recetas-comunidad');
        if (resCom.ok) {
          const dataCom = await resCom.json();
          if (Array.isArray(dataCom) && dataCom[0]) setSugerenciaComunidad(dataCom[0]);
        }

        // 3. Sugerencia receta clasica
        const resCla = await fetch('/api/recetas/sugerencias');
        if (resCla.ok) {
          const dataCla = await resCla.json();
          if (Array.isArray(dataCla) && dataCla[0]) setSugerenciaClasica(dataCla[0]);
        }

        // 4. Inventario y alertas de caducidad
        const resInv = await fetch('/api/alimentos');
        if (resInv.ok) {
          const dataInv = await resInv.json();
          if (Array.isArray(dataInv)) {
            setTotalAlimentos(dataInv.length);
            const urgentes = dataInv.filter((item) => {
              const est = String(item.estado_alerta || '').toLowerCase();
              return est === 'urgente' || est === 'caducado';
            });
            setAlertas(urgentes);
          }
        }
      } catch (error) {
        console.error('Error cargando datos del inicio:', error);
      } finally {
        setCargando(false);
      }
    };

    cargarDatosInicio();
  }, [loggedIn]);

  return (
    <main className="home-layout">
      {loggedIn ? (
        /* ====================================================================
           PANEL GASTRONÓMICO PRINCIPAL (USUARIO CONECTADO)
           ==================================================================== */
        <div className="home-cockpit">
          {/* Cabecera y Bienvenida de la Cocina */}
          <header className="cockpit-hud-header">
            <div className="cockpit-status-bar">
              <span className="status-badge-live">
                <span className="live-dot"></span>
                Despensa sincronizada
              </span>
              <span className="status-item">
                <strong>{totalAlimentos}</strong> {totalAlimentos === 1 ? 'alimento registrado' : 'alimentos registrados'}
              </span>
              {alertas.length > 0 ? (
                <span className="status-item badge-urgent">
                  <FaExclamationTriangle /> {alertas.length} por caducar pronto
                </span>
              ) : (
                <span className="status-item badge-fresh">
                  <FaCheckCircle /> Todo en fecha óptima
                </span>
              )}
            </div>

            <div className="cockpit-title-row">
              <div className="cockpit-title-content">
                <h1 className="cockpit-main-title">
                  {userFirstName ? `Hola, Chef ${userFirstName}` : 'Tu Cocina Inteligente'}
                </h1>
                <p className="cockpit-sub-title">
                  Aprovechamiento integral de ingredientes, recetas sugeridas por IA y control preventivo de caducidades.
                </p>
              </div>

              <div className="cockpit-quick-triggers">
                <button
                  type="button"
                  className="hud-trigger-btn btn-scan"
                  onClick={() => navigate('/escaner')}
                  title="Escanear alimento o código de barras"
                >
                  <FaBarcode />
                  <span>Escanear alimento</span>
                </button>
                <button
                  type="button"
                  className="hud-trigger-btn btn-ai"
                  onClick={() => navigate('/recetas-ia')}
                  title="Crear recetas con el Chef IA"
                >
                  <FaMagic />
                  <span>Chef IA</span>
                </button>
              </div>
            </div>
          </header>

          {/* Bento Grid Gastronómico */}
          <section className="cockpit-bento-grid" aria-label="Panel gastronómico">
            {/* CELDA 1 (GRANDE): Sugerencia destacada Chef IA */}
            <article
              className="bento-card bento-hero-ai"
              onClick={() => {
                if (sugerenciaChef?.id) {
                  navigate(`/recetas-ia/${sugerenciaChef.id}`, { state: { receta: sugerenciaChef } });
                } else {
                  navigate('/recetas-ia');
                }
              }}
            >
              <div className="bento-card-header">
                <span className="bento-section-tag">
                  <FaMagic /> Sugerencia de hoy
                </span>
                <span className="bento-match-badge">
                  95% compatible con tu despensa
                </span>
              </div>

              {sugerenciaChef ? (
                <div className="hero-ai-content">
                  <div className="hero-ai-image-backdrop">
                    <img src={sugerenciaChef.image} alt={sugerenciaChef.title} loading="lazy" />
                    <div className="hero-ai-gradient-overlay"></div>
                  </div>

                  <div className="hero-ai-details">
                    <span className="hero-ai-kicker">Recomendado según tus existencias</span>
                    <h2 className="hero-ai-title">{sugerenciaChef.title}</h2>
                    <div className="hero-ai-telemetry">
                      <span className="telemetry-chip">
                        <FaClock /> {sugerenciaChef.readyInMinutes || 25} min
                      </span>
                      <span className="telemetry-chip">
                        <FaBoxOpen /> {sugerenciaChef.usedIngredientCount || 0} en tu despensa
                      </span>
                    </div>
                    <div className="hero-ai-cta-row">
                      <span className="hero-ai-action-btn">
                        Ver receta y cocinar <FaArrowRight />
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="hero-ai-empty">
                  <div className="empty-ai-icon-circle">
                    <FaMagic />
                  </div>
                  <h3>Chef IA preparado</h3>
                  <p>{cargando ? 'Consultando los ingredientes de tu despensa...' : 'Genera una receta gourmet a la medida exacta de lo que tienes en casa.'}</p>
                  <span className="hero-ai-action-btn">
                    Explorar Chef IA <FaArrowRight />
                  </span>
                </div>
              )}
            </article>

            {/* CELDA 2: Despensa en Tiempo Real */}
            <article className="bento-card bento-pantry" onClick={() => navigate('/despensa')}>
              <div className="bento-card-header">
                <span className="bento-section-tag">
                  <FaBoxOpen /> Tu Despensa
                </span>
                <span className="bento-chip-pill">Activa</span>
              </div>

              <div className="pantry-stat-display">
                <div className="pantry-big-number">{totalAlimentos}</div>
                <div className="pantry-number-label">
                  <strong>Ingredientes listos</strong>
                  <span>disponibles para cocinar</span>
                </div>
              </div>

              <div className="pantry-meter-wrapper">
                <div className="pantry-meter-header">
                  <span>Aprovechamiento</span>
                  <strong>{totalAlimentos > 0 ? 'Excelente' : 'Despensa vacía'}</strong>
                </div>
                <div className="pantry-meter-track">
                  <div
                    className="pantry-meter-fill"
                    style={{ width: `${Math.min(100, Math.max(15, totalAlimentos * 10))}%` }}
                  ></div>
                </div>
              </div>

              <div className="bento-card-footer">
                <button
                  type="button"
                  className="bento-inline-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/escaner');
                  }}
                >
                  <FaCamera /> Escanear
                </button>
                <span className="bento-link-arrow">
                  Gestionar <FaArrowRight />
                </span>
              </div>
            </article>

            {/* CELDA 3: Radar de Caducidades */}
            <article
              className={`bento-card bento-radar ${alertas.length > 0 ? 'radar-alert-active' : 'radar-nominal'}`}
              onClick={() => navigate('/despensa')}
            >
              <div className="bento-card-header">
                <span className="bento-section-tag">
                  <FaShieldAlt /> Caducidades
                </span>
                {alertas.length > 0 ? (
                  <span className="hud-badge-urgent">
                    <FaExclamationTriangle /> {alertas.length} urgentes
                  </span>
                ) : (
                  <span className="hud-badge-ok">
                    <FaCheckCircle /> 100% fresco
                  </span>
                )}
              </div>

              {alertas.length > 0 ? (
                <div className="radar-alerts-list">
                  <p className="radar-warning-text">Consúmelos pronto para evitar desperdicio:</p>
                  <div className="radar-items-scroll">
                    {alertas.slice(0, 3).map((alerta) => {
                      const esCaducado = String(alerta.estado_alerta || '').toLowerCase() === 'caducado';
                      return (
                        <div key={alerta._id} className={`radar-item-row ${esCaducado ? 'is-expired' : 'is-urgent'}`}>
                          <span className="radar-item-name">{alerta.nombre}</span>
                          <span className="radar-item-pill">
                            {esCaducado ? 'Caducado' : 'Consumir pronto'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="radar-nominal-content">
                  <div className="radar-sweep-icon">
                    <FaCheckCircle />
                  </div>
                  <h4>Todo en fecha óptima</h4>
                  <p>Ningún alimento en riesgo de caducar en los próximos días.</p>
                </div>
              )}

              <div className="bento-card-footer">
                <span className="bento-link-arrow">
                  Revisar despensa <FaArrowRight />
                </span>
              </div>
            </article>

            {/* CELDA 4: Comunidad Gourmet */}
            <article
              className="bento-card bento-community"
              onClick={() => {
                if (sugerenciaComunidad?._id) {
                  navigate(`/recetas-comunidad/${sugerenciaComunidad._id}`);
                } else {
                  navigate('/recetas-comunidad');
                }
              }}
            >
              <div className="bento-card-header">
                <span className="bento-section-tag">
                  <FaUsers /> Comunidad de Chefs
                </span>
                <span className="bento-chip-pill">Destacada</span>
              </div>

              {sugerenciaComunidad ? (
                <div className="community-card-inner">
                  {sugerenciaComunidad.image && (
                    <div className="community-thumb-wrap">
                      <img src={sugerenciaComunidad.image} alt={sugerenciaComunidad.title} loading="lazy" />
                    </div>
                  )}
                  <div className="community-info">
                    <span className="community-author-tag">
                      Por <strong>{sugerenciaComunidad.autor_nombre || 'Chef de la Comunidad'}</strong>
                    </span>
                    <h3 className="community-title">{sugerenciaComunidad.title}</h3>
                    <div className="community-metrics">
                      <span>
                        <FaHeart style={{ color: '#ff3366' }} /> {sugerenciaComunidad.numero_likes || 0}
                      </span>
                      <span>
                        <FaStar style={{ color: '#f59e0b' }} /> {Number(sugerenciaComunidad.puntuacion_media || 5).toFixed(1)}
                      </span>
                      <span>
                        <FaClock /> {sugerenciaComunidad.readyInMinutes || 30}m
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="community-card-empty">
                  <p>Descubre platos publicados por otros miembros, vota y guarda ideas originales.</p>
                </div>
              )}

              <div className="bento-card-footer">
                <span className="bento-link-arrow">
                  Explorar comunidad <FaArrowRight />
                </span>
              </div>
            </article>

            {/* CELDA 5: Logística de Compras */}
            <article className="bento-card bento-shopping" onClick={() => navigate('/compra-inteligente')}>
              <div className="bento-card-header">
                <span className="bento-section-tag">
                  <FaShoppingBasket /> Lista de Compra
                </span>
                <span className="bento-chip-pill">Automática</span>
              </div>

              <div className="shopping-card-body">
                <div className="shopping-icon-box">
                  <FaShoppingBasket />
                </div>
                <div className="shopping-info">
                  <h3>Ingredientes que te faltan</h3>
                  <p>Añade con un clic los ingredientes necesarios para cocinar tus recetas pendientes.</p>
                </div>
              </div>

              <div className="bento-card-footer">
                <span className="bento-link-arrow">
                  Abrir lista de compras <FaArrowRight />
                </span>
              </div>
            </article>

            {/* CELDA 6: Catálogo Clásico */}
            <article
              className="bento-card bento-classic"
              onClick={() => {
                if (sugerenciaClasica?.id) {
                  navigate(`/recetas/${sugerenciaClasica.id}`);
                } else {
                  navigate('/recetas');
                }
              }}
            >
              <div className="bento-card-header">
                <span className="bento-section-tag">
                  <FaBook /> Recetario Clásico
                </span>
                <span className="bento-chip-pill">Tradicional</span>
              </div>

              <div className="classic-card-body">
                <div className="classic-icon-box">
                  <FaBook />
                </div>
                <div className="classic-info">
                  <h3>{sugerenciaClasica?.title || 'Recetas de Siempre'}</h3>
                  <p>Cientos de recetas tradicionales listas para cocinar con tus existencias.</p>
                </div>
              </div>

              <div className="bento-card-footer">
                <span className="bento-link-arrow">
                  Ver recetario clásico <FaArrowRight />
                </span>
              </div>
            </article>
          </section>
        </div>
      ) : (
        /* ====================================================================
           LANDING DE AUTOR PARA INVITADOS (EDITORIAL GOURMET & TECNOLOGÍA)
           ==================================================================== */
        <div className="home-guest-futuristic">
          <section className="guest-futuristic-hero">
            <div className="guest-hero-glass-card">
              <div className="guest-eyebrow-badge">
                <span className="eyebrow-spark">✨</span>
                <span>COCINA INTELIGENTE Y SOSTENIBLE</span>
              </div>

              <h1 className="guest-futuristic-title">
                Cocina como un chef <br />
                <span className="text-gradient">con lo que tienes en casa.</span>
              </h1>

              <p className="guest-futuristic-desc">
                InventIA Chef analiza los ingredientes de tu despensa, anticipa caducidades y crea recetas excepcionales a tu medida para ahorrar tiempo y no tirar comida jamás.
              </p>

              <div className="guest-cta-row">
                <Link to="/auth" className="btn-futuristic-primary">
                  <span>Empezar gratis</span>
                  <FaArrowRight />
                </Link>
                <Link to="/auth" className="btn-futuristic-secondary">
                  <span>Iniciar sesión</span>
                </Link>
              </div>

              <div className="guest-tech-metrics">
                <div className="tech-metric-box">
                  <span className="metric-figure">0%</span>
                  <span className="metric-tag">Desperdicio</span>
                </div>
                <div className="tech-metric-divider"></div>
                <div className="tech-metric-box">
                  <span className="metric-figure">100%</span>
                  <span className="metric-tag">Aprovechamiento</span>
                </div>
                <div className="tech-metric-divider"></div>
                <div className="tech-metric-box">
                  <span className="metric-figure">30s</span>
                  <span className="metric-tag">Recetas a medida</span>
                </div>
              </div>
            </div>

            {/* Showcase Visual: Tarjeta interactiva de receta */}
            <div className="guest-hologram-showcase">
              <div className="hologram-recipe-panel">
                <div className="hologram-hud-top">
                  <span className="hologram-tag">Plato recomendado</span>
                  <span className="hologram-chip">98% de ingredientes listos</span>
                </div>
                <div className="hologram-image-wrapper">
                  <img
                    src="https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=900"
                    alt="Risotto cremoso de boletus"
                    loading="lazy"
                  />
                  <div className="hologram-overlay-gradient"></div>
                </div>
                <div className="hologram-body">
                  <div className="hologram-stars">
                    <FaStar /><FaStar /><FaStar /><FaStar /><FaStar />
                    <span>5.0 • RECETA DE LA SEMANA</span>
                  </div>
                  <h3>Risotto Cremoso de Boletus y Parmesano</h3>
                  <p>Mantecado con mantequilla fría, queso curado y reducción de caldo casero.</p>
                  <div className="hologram-telemetry">
                    <span><FaClock /> 30 min</span>
                    <span><FaUtensils /> 4 raciones</span>
                    <span><FaBoxOpen /> 5 ingredientes en nevera</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 4 Pilares de Valor */}
          <section className="guest-pillars-section">
            <div className="pillars-grid">
              <div className="pillar-module">
                <div className="pillar-icon-box">
                  <FaCamera />
                </div>
                <h3>Escaneo Inteligente</h3>
                <p>Fotografía tus compras o escanea códigos de barras para registrar ingredientes en tu despensa sin escribir.</p>
              </div>

              <div className="pillar-module pillar-highlight">
                <div className="pillar-icon-box">
                  <FaMagic />
                </div>
                <h3>Chef IA Adaptativo</h3>
                <p>Propuestas culinarias creativas que aprovechan exactamente lo que tienes a mano antes de que caduque.</p>
              </div>

              <div className="pillar-module">
                <div className="pillar-icon-box">
                  <FaShieldAlt />
                </div>
                <h3>Control de Caducidades</h3>
                <p>Alertas visuales inteligentes y recordatorios para consumir cada alimento en su fecha óptima.</p>
              </div>

              <div className="pillar-module">
                <div className="pillar-icon-box">
                  <FaUsers />
                </div>
                <h3>Comunidad Gourmet</h3>
                <p>Comparte tus propias creaciones, valora platos de otros comensales y forja tu reputación como chef.</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
