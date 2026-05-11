import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getRecetaComunidad } from '../services/communityApi';
import { showToast } from '../utils/toast';
import { FaChevronLeft, FaClock, FaUsers, FaAward, FaUser, FaPlus } from 'react-icons/fa';
import '../styles/Recetas.css';
import '../styles/RecetaDetalle.css';

export default function RecetaComunidadDetalle() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [receta, setReceta] = useState(null);
  const [versionActiva, setVersionActiva] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getRecetaComunidad(id);
        if (!cancelled) setReceta(data);
      } catch (error) {
        if (!cancelled) {
          showToast(error.message || 'No se pudo cargar la receta.', 'error');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!receta) {
    return (
      <section className="view-section active receta-comunidad-detalle">
        <p>Cargando...</p>
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

  return (
    <section className="view-section active receta-comunidad-detalle">
      <button type="button" className="receta-detalle-back" onClick={() => navigate('/recetas-comunidad')}>
        <FaChevronLeft /> Volver a la comunidad
      </button>
      <div className="receta-detalle-container-premium">
        <div className="receta-detalle-hero-image-wrapper">
          <img src={receta.image} alt={receta.title} className="receta-detalle-hero-img" />
        </div>

        <div className="receta-detalle-card-premium">
          <header className="receta-header-main">
            <div className="header-badge">Receta de Comunidad</div>
            <h1>{receta.title}</h1>
            <p className="description-text-premium">
              {receta.description || 'Una deliciosa receta compartida con la comunidad.'}
            </p>

            <div className="header-info-row">
              <div className="author-info-premium">
                <div className="author-avatar-wrapper">
                  {receta.autor_image ? (
                    <img src={receta.autor_image} alt={receta.autor_nombre} className="author-img-circle" />
                  ) : (
                    <div className="author-icon-placeholder"><FaUser /></div>
                  )}
                </div>
                <div className="author-text">
                  <span>Por </span>
                  <strong>{receta.autor_nombre || 'Usuario'}</strong>
                </div>
              </div>

              <div className="quick-stats-row">
                <div className="quick-stat"><FaClock /> {currentVersion.readyInMinutes} min</div>
                <div className="quick-stat"><FaUsers /> {currentVersion.numero_personas} pers.</div>
              </div>
            </div>
          </header>

          <section className="preparacion-section-premium">
            <div className="section-header-flex">
              <h2><FaAward /> Elaboración</h2>
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
              <div className="ingredients-col">
                <h3><FaPlus /> Ingredientes</h3>
                <ul className="ing-list-premium">
                  {(currentVersion.extendedIngredients || []).map((ing, i) => (
                    <li key={`i-${i}`}>
                      {ing.original || `${ing.cantidad || ''} ${ing.unidad || ''} ${ing.name || ''}`.trim()}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="steps-col">
                <h3><FaClock /> Pasos a seguir</h3>
                <div className="steps-list-premium">
                  {(currentVersion.analyzedInstructions?.[0]?.steps || []).map((s, i) => (
                    <div key={`s-${i}`} className="step-item-premium">
                      <div className="step-number-circle">{s.number}</div>
                      <div className="step-text-box">
                        <p>{s.step}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}
