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
           CENTRO DE CONTROL CULINARIO (FUTURISTA & MODERNO BENTO COCKPIT)
           ==================================================================== */
        <div className="home-cockpit">
          {/* Telemetría y Bienvenida Superior */}
          <header className="cockpit-hud-header">
            <div className="hud-telemetry-bar">
              <span className="hud-status-beacon">
                <span className="beacon-ping"></span>
                <span className="beacon-dot"></span>
                KITCHEN_OS // ONLINE
              </span>
              <span className="hud-telemetry-item">
                DESPENSA: <strong>{totalAlimentos} INGREDIENTES</strong>
              </span>
              <span className="hud-telemetry-item hud-pill-ai">
                <FaMagic /> NEURAL_AI: ACTIVA
              </span>
              {alertas.length > 0 ? (
                <span className="hud-telemetry-item hud-pill-warning">
                  <FaExclamationTriangle /> {alertas.length} EN RIESGO DE CADUCIDAD
                </span>
              ) : (
                <span className="hud-telemetry-item hud-pill-fresh">
                  <FaCheckCircle /> DESPENSA 100% ÓPTIMA
                </span>
              )}
            </div>

            <div className="cockpit-title-row">
              <div>
                <h1 className="cockpit-main-title">
                  Centro de Control <span className="text-gradient">Culinario</span>
                </h1>
                <p className="cockpit-sub-title">
                  {userFirstName ? `Bienvenido, Chef ${userFirstName}. ` : 'Bienvenido a tu cocina inteligente. '}
                  Aprovechamiento integral de existencias, síntesis neural de recetas y telemetría de caducidades en tiempo real.
                </p>
              </div>

              <div className="cockpit-quick-triggers">
                <button
                  type="button"
                  className="hud-trigger-btn btn-scan"
                  onClick={() => navigate('/escaner')}
                  title="Escanear código de barras o visión artificial"
                >
                  <FaBarcode />
                  <span>Escanear ingrediente</span>
                </button>
                <button
                  type="button"
                  className="hud-trigger-btn btn-ai"
                  onClick={() => navigate('/recetas-ia')}
                >
                  <FaMagic />
                  <span>Chef IA</span>
                </button>
              </div>
            </div>
          </header>

          {/* Bento Grid Cockpit */}
          <section className="cockpit-bento-grid" aria-label="Consola de mando culinaria">
            {/* CELDA 1 (GRANDE): Síntesis Neural Chef IA */}
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
              <div className="bento-card-glass-glow"></div>
              <div className="bento-card-hud-label">
                <span className="hud-mono-tag">NEURAL_AI // SÍNTESIS RECOMENDADA</span>
                <span className="hud-match-chip">
                  <FaMagic /> 94% COMPATIBLE
                </span>
              </div>

              {sugerenciaChef ? (
                <div className="hero-ai-content">
                  <div className="hero-ai-image-backdrop">
                    <img src={sugerenciaChef.image} alt={sugerenciaChef.title} loading="lazy" />
                    <div className="hero-ai-gradient-overlay"></div>
                  </div>

                  <div className="hero-ai-details">
                    <span className="hero-ai-kicker">Plato de máxima compatibilidad hoy</span>
                    <h2 className="hero-ai-title">{sugerenciaChef.title}</h2>
                    <div className="hero-ai-telemetry">
                      <span className="telemetry-chip">
                        <FaClock /> {sugerenciaChef.readyInMinutes || 25} MIN
                      </span>
                      <span className="telemetry-chip">
                        <FaBoxOpen /> {sugerenciaChef.usedIngredientCount || 0} DISP. EN TU DESPENSA
                      </span>
                    </div>
                    <div className="hero-ai-cta-row">
                      <span className="hero-ai-action-btn">
                        Sintetizar y cocinar ahora <FaArrowRight />
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="hero-ai-empty">
                  <FaMagic className="empty-ai-icon" />
                  <h3>Chef IA preparado para cocinar</h3>
                  <p>{cargando ? 'Analizando tu despensa...' : 'Añade ingredientes para que el motor neural sugiera tu próximo menú gourmet.'}</p>
                  <span className="hero-ai-action-btn">
                    Abrir Chef IA <FaArrowRight />
                  </span>
                </div>
              )}
            </article>

            {/* CELDA 2: Telemetría de Despensa */}
            <article className="bento-card bento-pantry" onClick={() => navigate('/despensa')}>
              <div className="bento-card-hud-label">
                <span className="hud-mono-tag">TELEMETRÍA // DESPENSA EN VIVO</span>
                <span className="hud-status-dot active"></span>
              </div>

              <div className="pantry-stat-display">
                <div className="pantry-big-number">{totalAlimentos}</div>
                <div className="pantry-number-label">
                  <strong>Ingredientes activos</strong>
                  <span>En tu despensa doméstica</span>
                </div>
              </div>

              <div className="pantry-meter-wrapper">
                <div className="pantry-meter-header">
                  <span>Aprovechamiento</span>
                  <strong>{totalAlimentos > 0 ? 'Óptimo' : 'Requiere carga'}</strong>
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
                  <FaCamera /> Escaneo óptico
                </button>
                <span className="bento-link-arrow">
                  Explorar <FaArrowRight />
                </span>
              </div>
            </article>

            {/* CELDA 3: Radar de Caducidades */}
            <article
              className={`bento-card bento-radar ${alertas.length > 0 ? 'radar-alert-active' : 'radar-nominal'}`}
              onClick={() => navigate('/despensa')}
            >
              <div className="bento-card-hud-label">
                <span className="hud-mono-tag">RADAR // CONTROL DE CADUCIDAD</span>
                {alertas.length > 0 ? (
                  <span className="hud-badge-urgent">
                    <FaExclamationTriangle /> {alertas.length} CRÍTICOS
                  </span>
                ) : (
                  <span className="hud-badge-ok">
                    <FaShieldAlt /> 100% SEGURO
                  </span>
                )}
              </div>

              {alertas.length > 0 ? (
                <div className="radar-alerts-list">
                  <p className="radar-warning-text">Consume estos productos en tus próximas recetas para evitar desperdicio:</p>
                  <div className="radar-items-scroll">
                    {alertas.slice(0, 3).map((alerta) => {
                      const esCaducado = String(alerta.estado_alerta || '').toLowerCase() === 'caducado';
                      return (
                        <div key={alerta._id} className={`radar-item-row ${esCaducado ? 'is-expired' : 'is-urgent'}`}>
                          <span className="radar-item-name">{alerta.nombre}</span>
                          <span className="radar-item-pill">
                            {esCaducado ? 'CADUCADO' : 'URGENTE'}
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
                  <h4>Despensa al día</h4>
                  <p>Todos tus alimentos están en fecha óptima de consumo.</p>
                </div>
              )}

              <div className="bento-card-footer">
                <span className="bento-link-arrow">
                  Ver despensa al completo <FaArrowRight />
                </span>
              </div>
            </article>

            {/* CELDA 4: Red Gastronómica (Comunidad) */}
            <article
              className="bento-card bento-community"
              onClick={() => {
                if (sugerenciaComunidad?._id) {
                  navigate(`/recetas-comunidad/${sugerenciaComunidad._id}`, { state: { receta: sugerenciaComunidad } });
                } else {
                  navigate('/recetas-comunidad');
                }
              }}
            >
              <div className="bento-card-hud-label">
                <span className="hud-mono-tag">COMUNIDAD // CHEFS EN RED</span>
                <span className="hud-community-chip">
                  <FaUsers /> RED GLOBAL
                </span>
              </div>

              {sugerenciaComunidad ? (
                <div className="community-card-body">
                  <div className="community-image-thumb">
                    <img src={sugerenciaComunidad.image} alt={sugerenciaComunidad.title} loading="lazy" />
                  </div>
                  <div className="community-details">
                    <span className="community-author-tag">
                      Por <strong>{sugerenciaComunidad.autor_nombre || 'Chef de la Comunidad'}</strong>
                    </span>
                    <h3 className="community-title">{sugerenciaComunidad.title}</h3>
                    <div className="community-metrics">
                      <span>
                        <FaHeart style={{ color: '#ff2a5f' }} /> {sugerenciaComunidad.numero_likes || 0} likes
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
                  <p>Explora recetas publicadas, vota con estrellas y sigue a otros chefs.</p>
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
              <div className="bento-card-hud-label">
                <span className="hud-mono-tag">LOGÍSTICA // COMPRA INTELIGENTE</span>
                <span className="hud-mono-sub">AUTO-SYNC</span>
              </div>

              <div className="shopping-card-body">
                <div className="shopping-icon-box">
                  <FaShoppingBasket />
                </div>
                <div className="shopping-info">
                  <h3>Lista de Supermercado</h3>
                  <p>Genera automáticamente los ingredientes que faltan para tus recetas pendientes.</p>
                </div>
              </div>

              <div className="bento-card-footer">
                <span className="bento-link-arrow">
                  Gestionar compras y tickets <FaArrowRight />
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
              <div className="bento-card-hud-label">
                <span className="hud-mono-tag">CATÁLOGO // RECETARIO CLÁSICO</span>
                <span className="hud-mono-sub">PROBADO</span>
              </div>

              <div className="classic-card-body">
                <div className="classic-icon-box">
                  <FaBook />
                </div>
                <div className="classic-info">
                  <h3>{sugerenciaClasica?.title || 'Recetas Tradicionales'}</h3>
                  <p>Miles de platos clásicos filtrados por los ingredientes de tu despensa.</p>
                </div>
              </div>

              <div className="bento-card-footer">
                <span className="bento-link-arrow">
                  Abrir recetario clásico <FaArrowRight />
                </span>
              </div>
            </article>
          </section>
        </div>
      ) : (
        /* ====================================================================
           LANDING FUTURISTA PARA INVITADOS (CYBER-GASTRONOMY SHOWCASE)
           ==================================================================== */
        <div className="home-guest-futuristic">
          <section className="guest-futuristic-hero">
            <div className="guest-hero-glass-card">
              <div className="guest-telemetry-badge">
                <span className="telemetry-beacon"></span>
                <span>SYS // INVENTIA_CHEF • THE CULINARY OPERATING SYSTEM</span>
              </div>

              <h1 className="guest-futuristic-title">
                La cocina del futuro, <br />
                <span className="text-gradient">hoy en tu despensa.</span>
              </h1>

              <p className="guest-futuristic-desc">
                Algoritmos de visión para escaneo de ingredientes, síntesis neural de recetas personalizadas y control preventivo de caducidades en una interfaz de precisión.
              </p>

              <div className="guest-cta-row">
                <Link to="/auth" className="btn-futuristic-primary">
                  <span>Iniciar Sistema (Gratis)</span>
                  <FaArrowRight />
                </Link>
                <Link to="/auth" className="btn-futuristic-secondary">
                  <span>Acceso de Usuario</span>
                </Link>
              </div>

              <div className="guest-tech-metrics">
                <div className="tech-metric-box">
                  <span className="metric-figure">0%</span>
                  <span className="metric-tag">DESPERDICIO DE COMIDA</span>
                </div>
                <div className="tech-metric-divider"></div>
                <div className="tech-metric-box">
                  <span className="metric-figure">100%</span>
                  <span className="metric-tag">APROVECHAMIENTO</span>
                </div>
                <div className="tech-metric-divider"></div>
                <div className="tech-metric-box">
                  <span className="metric-figure">IA</span>
                  <span className="metric-tag">SÍNTESIS GASTRONÓMICA</span>
                </div>
              </div>
            </div>

            {/* Holographic Gourmet Showcase */}
            <div className="guest-hologram-showcase">
              <div className="hologram-recipe-panel">
                <div className="hologram-hud-top">
                  <span className="hologram-tag">DEMO_SYNTHESIS // RISOTTO_BOLETUS</span>
                  <span className="hologram-chip">98% MATCH</span>
                </div>
                <div className="hologram-image-wrapper">
                  <img
                    src="https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=900"
                    alt="Risotto cremoso de boletus"
                    loading="lazy"
                  />
                  <div className="hologram-scanline"></div>
                </div>
                <div className="hologram-body">
                  <div className="hologram-stars">
                    <FaStar /><FaStar /><FaStar /><FaStar /><FaStar />
                    <span>5.0 • RECETA DESTACADA</span>
                  </div>
                  <h3>Risotto Cremoso de Boletus y Parmesano</h3>
                  <p>Mantecado al estilo tradicional con mantequilla fría y queso curado.</p>
                  <div className="hologram-telemetry">
                    <span><FaClock /> 30 MIN</span>
                    <span><FaUtensils /> 4 RACIONES</span>
                    <span><FaBoxOpen /> 5/5 INGREDIENTES</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3 Pilares Tecnológicos */}
          <section className="guest-pillars-section">
            <div className="pillars-grid">
              <div className="pillar-module">
                <div className="pillar-header">
                  <div className="pillar-icon-box">
                    <FaBoxOpen />
                  </div>
                  <span className="pillar-tag">MÓDULO 01</span>
                </div>
                <h3>Telemetría de Despensa</h3>
                <p>Escaneo instantáneo de alimentos con cámara o código de barras. Registro de fechas y alertas tempranas para no tirar jamás un producto.</p>
              </div>

              <div className="pillar-module pillar-highlight">
                <div className="pillar-header">
                  <div className="pillar-icon-box">
                    <FaMagic />
                  </div>
                  <span className="pillar-tag">MÓDULO 02 // NEURAL</span>
                </div>
                <h3>Chef IA Generativo</h3>
                <p>Algoritmos culinarios que cruzan las existencias reales de tu nevera para componer platos gourmet sin que tengas que ir a comprar.</p>
              </div>

              <div className="pillar-module">
                <div className="pillar-header">
                  <div className="pillar-icon-box">
                    <FaUsers />
                  </div>
                  <span className="pillar-tag">MÓDULO 03</span>
                </div>
                <h3>Red Social Gastronómica</h3>
                <p>Publica tus creaciones, comparte valoraciones con estrellas, responde a otros comensales y forja tu perfil de chef con insignias.</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
