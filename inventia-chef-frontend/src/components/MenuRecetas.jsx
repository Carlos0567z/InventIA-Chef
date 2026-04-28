import { Link, useLocation } from 'react-router-dom';
import '../styles/navigation.css';

const MenuRecetas = () => {
  const location = useLocation();
  const rutaActual = location.pathname;
  const esRutaSugerencias = rutaActual.includes('/recetas-ia');
  const esRutaComunidad = rutaActual.includes('/recetas-comunidad');
  const esRutaClasica = rutaActual.includes('/recetas') && !esRutaSugerencias && !esRutaComunidad;

  return (
    <div className="recipe-switcher">
      <Link to="/recetas-ia" className={esRutaSugerencias ? 'switch-pill chef active' : 'switch-pill chef'}>
        <i className="fa-solid fa-wand-magic-sparkles" /> Chef IA
      </Link>

      <Link to="/recetas-comunidad" className={esRutaComunidad ? 'switch-pill chef active' : 'switch-pill chef'}>
        <i className="fa-solid fa-users" /> Comunidad
      </Link>

      <Link to="/recetas" className={esRutaClasica ? 'switch-pill classic active' : 'switch-pill classic'}>
        <i className="fa-solid fa-book-bookmark" /> Recetas Clásicas
      </Link>
    </div>
  );
};

export default MenuRecetas;
