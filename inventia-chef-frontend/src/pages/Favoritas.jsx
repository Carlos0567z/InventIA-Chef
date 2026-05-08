import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTrash, FaRegClock, FaHeartbeat } from 'react-icons/fa';
import PageHeader from '../components/PageHeader';
import '../styles/Favoritas.css';

const Favoritas = () => {
  const [favoritos, setFavoritos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const cargarFavoritos = async () => {
      try {
        const response = await fetch('/api/favoritos');
        if (response.ok) {
          const data = await response.json();
          setFavoritos(data);
        }
      } catch (error) {
        console.error('Error al cargar favoritos:', error);
      } finally {
        setCargando(false);
      }
    };

    cargarFavoritos();
  }, []);

  const eliminarFavorito = async (favoritoId, e) => {
    e.stopPropagation();

    try {
      const response = await fetch(`/api/favoritos/${favoritoId}`, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(`Error HTTP ${response.status}`);
      }

      setFavoritos((prev) => prev.filter((item) => item._id !== favoritoId));
      window.dispatchEvent(new Event('favoritos-updated'));
    } catch (error) {
      console.error('Error al eliminar favorito:', error);
    }
  };

  if (cargando) {
    return (
      <section className="view-section active">
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          Cargando tus favoritas...
        </div>
      </section>
    );
  }

  return (
    <section className="view-section active">
      <div className="favoritas-container">
        <PageHeader
          kicker="Favoritas"
          title="Mis recetas favoritas"
          description="Tus recetas guardadas para cuando quieras cocinar. Todo tu recetario personal en un solo lugar."
        />

        {favoritos.length > 0 ? (
          <div className="favoritas-grid">
            {favoritos.map((receta) => (
              <div
                key={receta._id}
                className="favoritas-card"
                onClick={() => navigate(`/favoritas/${receta._id}`)}
              >
                <button
                  type="button"
                  onClick={(e) => eliminarFavorito(receta._id, e)}
                  aria-label="Eliminar favorito"
                  className="btn-delete-favorito"
                  title="Eliminar de favoritos"
                >
                  <FaTrash size={14} />
                </button>

                <img
                  src={receta.image}
                  alt={receta.title}
                  className="favoritas-card-image"
                />
                
                <div className="favoritas-card-content">
                  <h3 className="favoritas-card-title">{receta.title}</h3>
                  <div className="favoritas-card-meta">
                    <FaRegClock />
                    {receta.readyInMinutes || receta.tiempo_preparacion || receta.tiempo || 30} min
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="favoritas-empty">
            <FaHeartbeat className="favoritas-empty-icon" />
            <h2 className="favoritas-empty-text">Aún no tienes recetas favoritas</h2>
            <p className="favoritas-empty-hint">Explora el catálogo, la comunidad o la inteligencia artificial y haz clic en el corazón para guardar las recetas que más te gusten aquí.</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default Favoritas;
