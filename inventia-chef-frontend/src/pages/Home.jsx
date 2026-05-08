import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FaArrowRight, FaUtensils, FaListUl, FaSearch, FaCamera, FaShoppingBasket, FaDrumstickBite, FaFire, FaUsers, FaBook, FaClock, FaBoxOpen, FaHeart, FaStar } from 'react-icons/fa';
import '../styles/home.css';
import { isAuthenticated } from '../services/auth';

const Home = () => {
  const navigate = useNavigate();
  const loggedIn = isAuthenticated();
  const [sugerenciaChef, setSugerenciaChef] = useState(null);
  const [sugerenciaComunidad, setSugerenciaComunidad] = useState(null);
  const [sugerenciaClasica, setSugerenciaClasica] = useState(null);
  const [alertas, setAlertas] = useState([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!loggedIn) return;

    const cargarSugerenciasTop = async () => {
      setCargando(true);
      try {
        // 1. Bloque sugerencias (chef)
        const resChef = await fetch('/api/recetas-ia/sugerencias?total=1');
        if (resChef.ok) {
          const dataChef = await resChef.json();
          if (dataChef && dataChef[0]) setSugerenciaChef(dataChef[0]);
        }

        // 2. Sugerencia destacada (comunidad)
        const resCom = await fetch('/api/recetas-comunidad');
        if (resCom.ok) {
          const dataCom = await resCom.json();
          // cojo la primera de la lista (como un "mejor match" rapido)
          if (dataCom && dataCom[0]) setSugerenciaComunidad(dataCom[0]);
        }

        // 3. Sugerencia destacada (recetas clasicas)
        const resCla = await fetch('/api/recetas/sugerencias');
        if (resCla.ok) {
          const dataCla = await resCla.json();
          if (dataCla && dataCla[0]) setSugerenciaClasica(dataCla[0]);
        }

        // 4. Alertas de la despensa para el resumen
        const resInv = await fetch('/api/alimentos');
        if (resInv.ok) {
          const dataInv = await resInv.json();
          const urgentes = dataInv.filter(item => 
            item.estado_alerta === 'Urgente' || item.estado_alerta === 'Caducado'
          );
          setAlertas(urgentes);
        }
      } catch (error) {
        console.error('Error cargando sugerencias del inicio:', error);
      } finally {
        setCargando(false);
      }
    };

    cargarSugerenciasTop();
  }, [loggedIn]);

  return (
    <main className="home-layout">
      {/* bloque hero */}
      <section className="home-hero-premium">
        <div className="home-hero-content">
          <div className="home-badge">
            <span className="badge-dot"></span>
            {loggedIn ? 'Hola de nuevo' : 'InventIA Chef'}
          </div>
          
          <h1 className="home-title">
            {loggedIn ? 'Tu cocina,' : 'Tu cocina,'}<br />
            <span className="text-gradient">
              {loggedIn ? 'al día.' : 'ordenada y clara.'}
            </span>
          </h1>
          
          <p className="home-description">
            {loggedIn 
              ? 'Revisa la despensa, las recetas sugeridas y la lista de la compra desde el menu.'
              : 'Controla la despensa, busca recetas y prepara listas de compra desde una sola app.'
            }
          </p>

          <div className="home-cta-group">
            {loggedIn ? (
              <>
                <Link to="/recetas-ia" className="btn-primary-hero">
                  Ver Chef IA <FaUtensils />
                </Link>
                <Link to="/despensa" className="btn-secondary-hero">
                  Ver mi despensa
                </Link>
              </>
            ) : (
              <>
                <Link to="/auth" className="btn-primary-hero">
                  Comenzar ahora <FaArrowRight />
                </Link>
                <Link to="/recetas" className="btn-secondary-hero">
                  Explorar recetas
                </Link>
              </>
            )}
          </div>

          <div className="home-stats-row">
            <div className="stat-item">
              <span className="stat-value">3</span>
              <span className="stat-label">Tipos receta</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-value">IA</span>
              <span className="stat-label">Sugerencias</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-value">24/7</span>
              <span className="stat-label">Despensa</span>
            </div>
          </div>
        </div>

        <div className="home-hero-graphics">
          <div className="graphic-main-card">
            <div className="graphic-header">
              <div className="window-controls">
                <span></span><span></span><span></span>
              </div>
              <div className="window-title">Resumen</div>
            </div>
            <div className="graphic-body">
              <div className="graphic-recipe-card">
                <div className="recipe-image-placeholder"></div>
                <div className="recipe-text-placeholder">
                  <div className="line title"></div>
                  <div className="line subtitle"></div>
                </div>
              </div>
              <div className="graphic-metrics">
                <div className="metric-box alert"></div>
                <div className="metric-box ok"></div>
              </div>
            </div>
            
            {/* decoracion flotante */}
            <div className="floating-badge badge-1">
              <FaUtensils /> Chef IA
            </div>
            <div className="floating-badge badge-2">
              <FaShoppingBasket /> Lista auto
            </div>
          </div>
        </div>
      </section>

      {/* panel resumen (solo usuarios logueados) */}
      {loggedIn && (
        <section className="home-dashboard">
          <div className="dashboard-welcome">
            <div className="welcome-text">
              <h2>Tu <span className="text-gradient">resumen</span></h2>
              <p>Alertas de la despensa y accesos rápidos.</p>
            </div>
          </div>

          {/* alertas importantes de la despensa */}
          {alertas.length > 0 && (
            <div className="dashboard-alerts-integration">
              <div className="integration-header">
                <span className="integration-badge">Urgente</span>
                <h4>Productos a revisar</h4>
              </div>
              <div className="alerts-unified-grid">
                {alertas.map(alerta => (
                  <div key={alerta._id} className={`unified-alert-card ${alerta.estado_alerta.toLowerCase()}`} onClick={() => navigate('/despensa')}>
                    <div className="u-alert-header">
                      <span className="u-alert-dot"></span>
                      <span className="u-alert-name">{alerta.nombre}</span>
                    </div>
                    <p className="u-alert-desc">
                      {alerta.estado_alerta === 'Caducado' ? 'Producto expirado' : 'Consumir pronto'}
                    </p>
                    <div className="u-alert-footer">
                      <span>Ver en despensa</span>
                      <FaArrowRight />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="dashboard-welcome dashboard-welcome-spaced">
            <div className="welcome-text">
              <h3 className="dashboard-inspo-title">Inspiración para hoy</h3>
            </div>
          </div>

          <div className="suggestions-showcase">
            {/* tarjeta: sugerencias chef */}
            <div className="dashboard-card chef-card" onClick={() => navigate(`/recetas-ia/${sugerenciaChef?.id}`, { state: { receta: sugerenciaChef } })}>
              <div className="card-source-badge chef">
                <FaUtensils /> Chef IA
              </div>
              {sugerenciaChef ? (
                <>
                  <div className="card-image-wrapper">
                    <img src={sugerenciaChef.image} alt={sugerenciaChef.title} />
                  </div>
                  <div className="card-info">
                    <h3>{sugerenciaChef.title}</h3>
                    <div className="card-stats">
                      <span><FaClock /> {sugerenciaChef.readyInMinutes} min</span>
                      <span><FaBoxOpen /> {sugerenciaChef.usedIngredientCount} disp.</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="card-placeholder">
                  <p>{cargando ? 'Cargando ideas...' : 'Añade cosas a la despensa para ver ideas nuevas'}</p>
                </div>
              )}
            </div>

            {/* tarjeta: comunidad */}
            <div className="dashboard-card com-card" onClick={() => navigate(`/recetas-comunidad/${sugerenciaComunidad?._id}`, { state: { receta: sugerenciaComunidad } })}>
              <div className="card-source-badge com">
                <FaUsers /> Comunidad
              </div>
              {sugerenciaComunidad ? (
                <>
                  <div className="card-image-wrapper">
                    <img src={sugerenciaComunidad.image} alt={sugerenciaComunidad.title} />
                  </div>
                  <div className="card-info">
                    <h3>{sugerenciaComunidad.title}</h3>
                    <div className="card-stats">
                      <span><FaClock /> {sugerenciaComunidad.readyInMinutes || 25} min</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="card-placeholder">
                  <p>{cargando ? 'Buscando...' : 'Explora lo que cocinan otros'}</p>
                </div>
              )}
            </div>

            {/* tarjeta: receta clasica */}
            <div className="dashboard-card classic-card" onClick={() => navigate(`/recetas/${sugerenciaClasica?.id}`)}>
              <div className="card-source-badge classic">
                <FaBook /> Clásica
              </div>
              {sugerenciaClasica ? (
                <>
                  <div className="card-image-wrapper">
                    <img src={sugerenciaClasica.image} alt={sugerenciaClasica.title} />
                  </div>
                  <div className="card-info">
                    <h3>{sugerenciaClasica.title}</h3>
                    <div className="card-stats">
                      <span><FaClock /> {sugerenciaClasica.readyInMinutes} min</span>
                      <span><FaBoxOpen /> {sugerenciaClasica.usedIngredientCount} disp.</span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="card-placeholder">
                  <p>{cargando ? 'Buscando...' : 'Recetas de toda la vida'}</p>
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* rejilla de funciones */}
      <section className="home-features-section">
        <div className="section-header">
          <h2>Todo lo que necesitas para cocinar mejor</h2>
          <p>Herramientas diseñadas para ahorrarte tiempo, dinero y esfuerzo en tu día a día.</p>
        </div>

        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <FaSearch className="feature-icon" />
            </div>
            <h3>Catálogo Extenso</h3>
            <p>Miles de recetas clásicas y de la comunidad, listas para ser descubiertas y preparadas.</p>
          </div>

          <div className="feature-card highlighted">
            <div className="feature-icon-wrapper">
              <FaUtensils className="feature-icon" />
            </div>
            <h3>Recetas a tu medida</h3>
            <p>Descubre recetas que encajan con los ingredientes que ya tienes en tu despensa.</p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-wrapper">
              <FaListUl className="feature-icon" />
            </div>
            <h3>Compras Fáciles</h3>
            <p>Añade los ingredientes de tus recetas favoritas directamente a la lista de la compra.</p>
          </div>
        </div>
      </section>

      {/* como funciona (pasos) */}
      <section className="home-workflow-section">
        <div className="workflow-content">
          <h2>Cocina en 3 sencillos pasos</h2>
          <p>Olvídate del estrés. InventIA te guía desde que abres la nevera hasta que te sientas a la mesa.</p>
          
          <div className="workflow-steps">
            <div className="workflow-step">
              <div className="step-number">1</div>
              <div className="step-text">
                <h4>Revisa tu despensa</h4>
                <p>Mantén un registro de tus ingredientes y fechas de caducidad.</p>
              </div>
            </div>
            <div className="workflow-step">
              <div className="step-number">2</div>
              <div className="step-text">
                <h4>Encuentra tu receta</h4>
                <p>Usa el buscador o las sugerencias para inspirarte según tus gustos.</p>
              </div>
            </div>
            <div className="workflow-step">
              <div className="step-number">3</div>
              <div className="step-text">
                <h4>Cocina y disfruta</h4>
                <p>Sigue las instrucciones paso a paso y guarda tus favoritas.</p>
              </div>
            </div>
          </div>
        </div>
        <div className="workflow-visual">
          <div className="visual-circle" aria-hidden="true">
            <FaDrumstickBite className="workflow-pulse-icon" />
          </div>
        </div>
      </section>
    </main>
  );
};

export default Home;
