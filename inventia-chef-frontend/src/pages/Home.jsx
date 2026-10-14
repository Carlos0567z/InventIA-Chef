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
  FaLeaf,
  FaCheckCircle,
  FaMagic,
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
        /* =========================================================
           VISTA PARA USUARIOS CONECTADOS (PANEL PRÁCTICO DEL CHEF)
           ========================================================= */
        <div className="home-dashboard-view">
          {/* Cabecera de bienvenida personalizada */}
          <section className="home-welcome-banner">
            <div className="welcome-banner-copy">
              <span className="welcome-pill">
                <FaLeaf className="welcome-pill-icon" /> Tu cocina al día
              </span>
              <h1 className="welcome-title">
                ¡Hola{userFirstName ? `, ${userFirstName}` : ''}!{' '}
                <span className="text-gradient">¿Qué cocinamos hoy?</span>
              </h1>
              <p className="welcome-subtitle">
                Tienes el control de tu despensa, sugerencias inteligentes con lo que tienes en casa y toda la comunidad gastronómica a tu alcance.
              </p>
            </div>
          </section>

          {/* Accesos rápidos: 4 tarjetas amplias, cómodas y legibles para cualquier edad */}
          <section className="home-quick-actions" aria-label="Accesos rápidos a la cocina">
            <div className="quick-action-card card-despensa" onClick={() => navigate('/despensa')}>
              <div className="action-card-icon-box">
                <FaBoxOpen />
              </div>
              <div className="action-card-text">
                <h3>Mi Despensa</h3>
                <p>
                  {totalAlimentos > 0
                    ? `${totalAlimentos} producto${totalAlimentos !== 1 ? 's' : ''} registrados actualmente.`
                    : 'Revisa tus ingredientes y existencias.'}
                </p>
              </div>
              <div className="action-card-actions">
                <span className="action-card-link">
                  Ver despensa <FaArrowRight />
                </span>
                <button
                  type="button"
                  className="quick-scan-pill-btn"
                  title="Escanear un producto con cámara o código de barras"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/escaner');
                  }}
                >
                  <FaCamera /> Escanear
                </button>
              </div>
            </div>

            <div className="quick-action-card card-chef-ia" onClick={() => navigate('/recetas-ia')}>
              <div className="action-card-icon-box">
                <FaMagic />
              </div>
              <div className="action-card-text">
                <h3>Chef Inteligente</h3>
                <p>Crea recetas originales e inspiradoras aprovechando lo que ya tienes.</p>
              </div>
              <div className="action-card-actions">
                <span className="action-card-link">
                  Probar Chef IA <FaArrowRight />
                </span>
              </div>
            </div>

            <div className="quick-action-card card-comunidad" onClick={() => navigate('/recetas-comunidad')}>
              <div className="action-card-icon-box">
                <FaUsers />
              </div>
              <div className="action-card-text">
                <h3>Comunidad</h3>
                <p>Explora recetas publicadas, vota con estrellas y sigue a otros cocineros.</p>
              </div>
              <div className="action-card-actions">
                <span className="action-card-link">
                  Explorar comunidad <FaArrowRight />
                </span>
              </div>
            </div>

            <div className="quick-action-card card-compras" onClick={() => navigate('/compra-inteligente')}>
              <div className="action-card-icon-box">
                <FaShoppingBasket />
              </div>
              <div className="action-card-text">
                <h3>Lista de Compra</h3>
                <p>Organiza los ingredientes que necesitas antes de ir al supermercado.</p>
              </div>
              <div className="action-card-actions">
                <span className="action-card-link">
                  Abrir compras <FaArrowRight />
                </span>
              </div>
            </div>
          </section>

          {/* Alertas de caducidad (Solo se muestra si hay productos urgentes para evitar desperdicio) */}
          {alertas.length > 0 && (
            <section className="home-alerts-section" aria-label="Alertas de productos próximos a caducar">
              <div className="alerts-section-header">
                <div className="alerts-header-title">
                  <FaExclamationTriangle className="alert-icon-warning" />
                  <h2>Productos que necesitan tu atención</h2>
                </div>
                <Link to="/despensa" className="alerts-view-all-link">
                  Ver toda la despensa <FaArrowRight />
                </Link>
              </div>

              <div className="alerts-cards-grid">
                {alertas.slice(0, 4).map((alerta) => {
                  const esCaducado = String(alerta.estado_alerta || '').toLowerCase() === 'caducado';
                  return (
                    <div
                      key={alerta._id}
                      className={`alert-product-card ${esCaducado ? 'is-expired' : 'is-urgent'}`}
                      onClick={() => navigate('/despensa')}
                    >
                      <div className="alert-product-top">
                        <span className={`alert-status-badge ${esCaducado ? 'badge-expired' : 'badge-urgent'}`}>
                          {esCaducado ? 'Caducado' : 'Consumir pronto'}
                        </span>
                        <span className="alert-product-qty">
                          {alerta.cantidad ?? 1} {alerta.unidad_medida || 'ud'}
                        </span>
                      </div>
                      <h4 className="alert-product-name">{alerta.nombre}</h4>
                      <div className="alert-product-footer">
                        <span>Revisar en despensa</span>
                        <FaArrowRight />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Inspiración recomendada de hoy (3 tarjetas reales con fotos, notas y tiempos) */}
          <section className="home-inspo-section" aria-label="Inspiración culinaria para hoy">
            <div className="inspo-section-header">
              <div className="inspo-header-title">
                <FaUtensils className="inspo-header-icon" />
                <h2>Inspiración recomendada para hoy</h2>
              </div>
              <p>Platos sugeridos especialmente para tu despensa y gustos de la comunidad.</p>
            </div>

            <div className="inspo-cards-grid">
              {/* Tarjeta 1: Chef IA */}
              <div
                className="inspo-card inspo-card-chef"
                onClick={() => {
                  if (sugerenciaChef?.id) {
                    navigate(`/recetas-ia/${sugerenciaChef.id}`, { state: { receta: sugerenciaChef } });
                  } else {
                    navigate('/recetas-ia');
                  }
                }}
              >
                <div className="inspo-card-badge badge-chef">
                  <FaMagic /> Chef IA
                </div>
                {sugerenciaChef ? (
                  <>
                    <div className="inspo-card-image-wrapper">
                      <img src={sugerenciaChef.image} alt={sugerenciaChef.title} loading="lazy" />
                    </div>
                    <div className="inspo-card-info">
                      <h3>{sugerenciaChef.title}</h3>
                      <div className="inspo-card-meta">
                        <span>
                          <FaClock /> {sugerenciaChef.readyInMinutes || 25} min
                        </span>
                        <span>
                          <FaBoxOpen /> {sugerenciaChef.usedIngredientCount || 0} disp.
                        </span>
                      </div>
                      <span className="inspo-card-btn">
                        Ver receta completa <FaArrowRight />
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="inspo-card-empty">
                    <p>{cargando ? 'Buscando ideas...' : 'Añade productos a la despensa para recibir sugerencias inteligentes.'}</p>
                    <span className="inspo-card-btn">Abrir Chef IA</span>
                  </div>
                )}
              </div>

              {/* Tarjeta 2: Comunidad */}
              <div
                className="inspo-card inspo-card-comunidad"
                onClick={() => {
                  if (sugerenciaComunidad?._id) {
                    navigate(`/recetas-comunidad/${sugerenciaComunidad._id}`, { state: { receta: sugerenciaComunidad } });
                  } else {
                    navigate('/recetas-comunidad');
                  }
                }}
              >
                <div className="inspo-card-badge badge-comunidad">
                  <FaUsers /> Comunidad
                </div>
                {sugerenciaComunidad ? (
                  <>
                    <div className="inspo-card-image-wrapper">
                      <img src={sugerenciaComunidad.image} alt={sugerenciaComunidad.title} loading="lazy" />
                    </div>
                    <div className="inspo-card-info">
                      <h3>{sugerenciaComunidad.title}</h3>
                      <div className="inspo-card-meta">
                        <span>
                          <FaClock /> {sugerenciaComunidad.readyInMinutes || 30} min
                        </span>
                        {Number(sugerenciaComunidad.numero_likes) > 0 && (
                          <span>
                            <FaHeart style={{ color: '#ef4444' }} /> {sugerenciaComunidad.numero_likes}
                          </span>
                        )}
                        {Number(sugerenciaComunidad.puntuacion_media) > 0 && (
                          <span>
                            <FaStar style={{ color: '#eab308' }} /> {Number(sugerenciaComunidad.puntuacion_media).toFixed(1)}
                          </span>
                        )}
                      </div>
                      <span className="inspo-card-btn">
                        Ver receta comunitaria <FaArrowRight />
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="inspo-card-empty">
                    <p>{cargando ? 'Cargando comunidad...' : 'Descubre lo que están cocinando otros chefs.'}</p>
                    <span className="inspo-card-btn">Ver comunidad</span>
                  </div>
                )}
              </div>

              {/* Tarjeta 3: Receta Clásica */}
              <div
                className="inspo-card inspo-card-clasica"
                onClick={() => {
                  if (sugerenciaClasica?.id) {
                    navigate(`/recetas/${sugerenciaClasica.id}`);
                  } else {
                    navigate('/recetas');
                  }
                }}
              >
                <div className="inspo-card-badge badge-clasica">
                  <FaBook /> Receta clásica
                </div>
                {sugerenciaClasica ? (
                  <>
                    <div className="inspo-card-image-wrapper">
                      <img src={sugerenciaClasica.image} alt={sugerenciaClasica.title} loading="lazy" />
                    </div>
                    <div className="inspo-card-info">
                      <h3>{sugerenciaClasica.title}</h3>
                      <div className="inspo-card-meta">
                        <span>
                          <FaClock /> {sugerenciaClasica.readyInMinutes || 30} min
                        </span>
                        <span>
                          <FaBoxOpen /> {sugerenciaClasica.usedIngredientCount || 0} disp.
                        </span>
                      </div>
                      <span className="inspo-card-btn">
                        Ver preparación <FaArrowRight />
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="inspo-card-empty">
                    <p>{cargando ? 'Buscando recetas...' : 'Explora miles de recetas clásicas probadas.'}</p>
                    <span className="inspo-card-btn">Explorar catálogo</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      ) : (
        /* =========================================================
           VISTA PARA VISITANTES / INVITADOS (PRESENTACIÓN GOURMET)
           ========================================================= */
        <div className="home-guest-view">
          <section className="home-guest-hero">
            <div className="guest-hero-content">
              <span className="guest-hero-pill">
                <FaLeaf /> Cocina inteligente y sin desperdicios
              </span>
              <h1 className="guest-hero-title">
                Tu cocina ordenada, <br />
                <span className="text-gradient">tus comidas resueltas.</span>
              </h1>
              <p className="guest-hero-description">
                Aprovecha al máximo lo que tienes en la despensa, descubre recetas deliciosas adaptadas a tus ingredientes y organiza tus compras diarias de forma fácil y accesible para todos.
              </p>

              <div className="guest-hero-actions">
                <Link to="/auth" className="btn-primary-hero">
                  Comenzar ahora (Gratis) <FaArrowRight />
                </Link>
                <Link to="/auth" className="btn-secondary-hero">
                  Iniciar sesión
                </Link>
              </div>

              <div className="guest-hero-badges">
                <div className="guest-badge-item">
                  <FaCheckCircle className="badge-check-icon" />
                  <span>Control de caducidades</span>
                </div>
                <div className="guest-badge-item">
                  <FaCheckCircle className="badge-check-icon" />
                  <span>Chef IA personalizado</span>
                </div>
                <div className="guest-badge-item">
                  <FaCheckCircle className="badge-check-icon" />
                  <span>Comunidad de recetas</span>
                </div>
              </div>
            </div>

            {/* Vista previa gastronómica real (sin esquemas grises ni wireframes) */}
            <div className="guest-hero-preview">
              <div className="guest-recipe-card">
                <div className="guest-recipe-media">
                  <img
                    src="https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=900"
                    alt="Risotto cremoso de boletus"
                    loading="lazy"
                  />
                  <span className="guest-card-chip">Sugerencia recomendada</span>
                </div>
                <div className="guest-recipe-body">
                  <div className="guest-recipe-stars">
                    <FaStar />
                    <FaStar />
                    <FaStar />
                    <FaStar />
                    <FaStar />
                    <span>5.0 (Comunidad)</span>
                  </div>
                  <h3>Risotto Cremoso de Boletus y Parmesano</h3>
                  <p>Aprovecha el caldo casero y el arroz arborio de tu despensa con esta receta paso a paso.</p>
                  <div className="guest-recipe-meta">
                    <span>
                      <FaClock /> 30 min
                    </span>
                    <span>
                      <FaUtensils /> 4 raciones
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* 3 Pilares Fundamentales explicados con claridad */}
          <section className="home-features-section">
            <div className="section-header">
              <h2>Todo lo necesario para cocinar mejor y ahorrar tiempo</h2>
              <p>Herramientas prácticas pensadas para personas de cualquier edad, desde principiantes hasta cocineros expertos.</p>
            </div>

            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon-wrapper">
                  <FaBoxOpen className="feature-icon" />
                </div>
                <h3>Despensa bajo control</h3>
                <p>Mantén un registro claro de lo que tienes en casa y recibe avisos antes de que los alimentos caduquen.</p>
              </div>

              <div className="feature-card highlighted">
                <div className="feature-icon-wrapper">
                  <FaMagic className="feature-icon" />
                </div>
                <h3>Recetas a tu medida</h3>
                <p>El Chef IA analiza tus existencias y te propone platos creativos sin que tengas que salir a comprar.</p>
              </div>

              <div className="feature-card">
                <div className="feature-icon-wrapper">
                  <FaShoppingBasket className="feature-icon" />
                </div>
                <h3>Compra inteligente</h3>
                <p>Agrupa los ingredientes que te falten en una lista ordenada por pasillos de supermercado.</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
