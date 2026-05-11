import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaEdit, FaTrash, FaEye } from 'react-icons/fa';
import '../styles/Recetas.css';
import { deleteRecetaComunidad, listMisRecetasComunidad } from '../services/communityApi';

function esReciente(fecha) {
  if (!fecha) return false;
  const fechaPublicacion = new Date(fecha).getTime();
  if (Number.isNaN(fechaPublicacion)) return false;
  const diasTranscurridos = (Date.now() - fechaPublicacion) / (1000 * 60 * 60 * 24);
  return diasTranscurridos <= 3;
}

export default function MisRecetasComunidad() {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setLoading(true);
      const data = await listMisRecetasComunidad();
      setItems(Array.isArray(data) ? data : []);
    } catch (error) {
      alert(error.message || 'No se pudieron cargar tus recetas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const onDelete = async (id) => {
    if (!window.confirm('¿Seguro que quieres eliminar esta receta?')) return;
    try {
      await deleteRecetaComunidad(id);
      await load();
    } catch (error) {
      alert(error.message || 'No se pudo eliminar la receta.');
    }
  };

  return (
    <section className="view-section active recetas-container">
      <div className="recetas-header-premium">
        <h2>Mis recetas de comunidad</h2>
        <p>Gestiona y edita las recetas que has compartido con la comunidad.</p>
      </div>

      {loading ? (
        <div className="loading-state-premium">
          <div className="spinner"></div>
          <p>Cargando tus aportaciones...</p>
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="empty-state-premium">
          <h3>Aún no has publicado recetas</h3>
          <p>¡Anímate a compartir tu primera receta con el mundo!</p>
          <button type="button" className="action-btn" onClick={() => navigate('/recetas-comunidad/contribuir')}>
            Publicar mi primera receta
          </button>
        </div>
      ) : null}

      <div className="recetas-grid">
        {items.map((r) => (
          <div key={r._id} className="receta-card premium-manage-card" role="article">
            <div className="receta-card-image-wrapper">
              <img src={r.image} alt={r.title} className="receta-image" loading="lazy" />
              {esReciente(r.fecha_publicacion) ? (
                <div className="receta-card-badge">Nueva</div>
              ) : null}
            </div>
            
            <div className="receta-card-body">
              <h3>{r.title}</h3>
              <div className="receta-card-stats-row">
                <span className="stat-item">{r.estado === 'publicada' ? 'Publicada' : 'Borrador'}</span>
              </div>
              
              <div className="receta-manage-actions">
                <button
                  type="button"
                  className="manage-btn view"
                  onClick={() => navigate(`/recetas-comunidad/${r._id}`)}
                >
                  <FaEye /> Ver
                </button>
                <button
                  type="button"
                  className="manage-btn edit"
                  onClick={() => navigate('/recetas-comunidad/contribuir', { state: { recetaEdicion: r } })}
                >
                  <FaEdit /> Editar
                </button>
                <button 
                  type="button" 
                  className="manage-btn delete" 
                  onClick={() => onDelete(r._id)}
                >
                  <FaTrash /> Borrar
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
