import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPaperPlane, FaPlus, FaTrash, FaArrowLeft, FaUser, FaPencilAlt } from 'react-icons/fa';
import '../styles/ContribuirRecetaComunidad.css';
import { isAuthenticated } from '../services/auth';
import { aportarRecetaComunidad, updateRecetaComunidad } from '../services/communityApi';
import PageHeader from '../components/PageHeader';
import CustomSelect from '../components/CustomSelect';
import { comprimirImagen } from '../utils/imageCompressor';

function nuevaVersion(seed = Date.now(), persons = 2) {
  return {
    key: `version-${seed}-${Math.random().toString(36).slice(2, 6)}`,
    numero_personas: persons,
    readyInMinutes: 25,
    ingredientes: [{ name: '', cantidad: '', unidad: 'g' }],
    pasos: [''],
  };
}

export default function ContribuirRecetaComunidad() {
  const navigate = useNavigate();
  const recetaEdicion = useMemo(() => window.history.state?.usr?.recetaEdicion || null, []);
  const esEdicion = Boolean(recetaEdicion?._id);

  const [publicando, setPublicando] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [modoImagen, setModoImagen] = useState('url');
  const [imagen, setImagen] = useState('');
  const [imagenGaleriaData, setImagenGaleriaData] = useState('');
  const [nombreImagenGaleria, setNombreImagenGaleria] = useState('');
  const [versiones, setVersiones] = useState([nuevaVersion()]);
  const [versionActiva, setVersionActiva] = useState(0);

  useEffect(() => {
    if (!isAuthenticated()) navigate('/auth?next=/recetas-comunidad/contribuir');
  }, [navigate]);

  useEffect(() => {
    if (!recetaEdicion) return;

    setTitulo(recetaEdicion.title || '');
    setDescripcion(recetaEdicion.description || '');
    setSourceUrl(recetaEdicion.source_url || '');
    setImagen(recetaEdicion.image || '');

    if (Array.isArray(recetaEdicion.versiones) && recetaEdicion.versiones.length > 0) {
      const mapped = recetaEdicion.versiones.map((v, idx) => {
        const ingredientes = Array.isArray(v.extendedIngredients) && v.extendedIngredients.length
          ? v.extendedIngredients.map((ing) => ({
              name: String(ing.name || '').trim(),
              cantidad: String(ing.cantidad || ''),
              unidad: String(ing.unidad || 'g'),
            }))
          : [{ name: '', cantidad: '', unidad: 'g' }];

        const pasos = Array.isArray(v.analyzedInstructions?.[0]?.steps)
          ? v.analyzedInstructions[0].steps.map((s) => String(s.step || '').trim()).filter(Boolean)
          : [''];

        return {
          key: `version-${Date.now()}-${idx}`,
          numero_personas: Number(v.numero_personas || v.servings || 2),
          readyInMinutes: Number(v.readyInMinutes || 25),
          ingredientes,
          pasos,
        };
      });
      setVersiones(mapped);
      setVersionActiva(0);
    }
  }, [recetaEdicion]);

  const leerArchivoImagen = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen seleccionada'));
    reader.readAsDataURL(file);
  });

  const onSeleccionarImagen = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) return alert('Selecciona un archivo de imagen valido.');
    if (file.size > 3 * 1024 * 1024) return alert('La imagen es demasiado grande. Usa una imagen de hasta 3MB.');

    try {
      const dataUrl = await leerArchivoImagen(file);
      // Comprimimos la imagen de la receta (800x600 aprox es suficiente para web)
      const b64Comprimida = await comprimirImagen(dataUrl, 800, 600, 0.7);
      
      setImagenGaleriaData(b64Comprimida);
      setNombreImagenGaleria(file.name);
    } catch (error) {
      alert(error.message || 'No se pudo cargar la imagen.');
    }
  };

  const actualizarVersion = (index, patch) => {
    setVersiones((prev) => prev.map((v, idx) => (idx === index ? { ...v, ...patch } : v)));
  };

  const anadirVersion = () => {
    setVersiones((prev) => [...prev, nuevaVersion(Date.now(), 4)]);
    setVersionActiva(versiones.length);
  };

  const eliminarVersion = (index) => {
    setVersiones((prev) => {
      if (prev.length <= 1) return prev;
      const next = prev.filter((_, idx) => idx !== index);
      setVersionActiva((current) => (current >= next.length ? next.length - 1 : current));
      return next;
    });
  };

  const actualizarIngrediente = (versionIndex, ingredienteIndex, patch) => {
    setVersiones((prev) => prev.map((version, idx) => {
      if (idx !== versionIndex) return version;
      const ingredientes = version.ingredientes.map((ing, i) => (i === ingredienteIndex ? { ...ing, ...patch } : ing));
      return { ...version, ingredientes };
    }));
  };

  const anadirIngrediente = (versionIndex) => {
    setVersiones((prev) => prev.map((version, idx) => (
      idx === versionIndex
        ? { ...version, ingredientes: [...version.ingredientes, { name: '', cantidad: '', unidad: 'g' }] }
        : version
    )));
  };

  const eliminarIngrediente = (versionIndex, ingredienteIndex) => {
    setVersiones((prev) => prev.map((version, idx) => {
      if (idx !== versionIndex || version.ingredientes.length <= 1) return version;
      return { ...version, ingredientes: version.ingredientes.filter((_, i) => i !== ingredienteIndex) };
    }));
  };

  const actualizarPaso = (versionIndex, pasoIndex, value) => {
    setVersiones((prev) => prev.map((version, idx) => {
      if (idx !== versionIndex) return version;
      const pasos = version.pasos.map((p, i) => (i === pasoIndex ? value : p));
      return { ...version, pasos };
    }));
  };

  const anadirPaso = (versionIndex) => {
    setVersiones((prev) => prev.map((version, idx) => (
      idx === versionIndex ? { ...version, pasos: [...version.pasos, ''] } : version
    )));
  };

  const eliminarPaso = (versionIndex, pasoIndex) => {
    setVersiones((prev) => prev.map((version, idx) => {
      if (idx !== versionIndex || version.pasos.length <= 1) return version;
      return { ...version, pasos: version.pasos.filter((_, i) => i !== pasoIndex) };
    }));
  };

  const contribuirReceta = async (event) => {
    event.preventDefault();

    const tituloLimpio = titulo.trim();
    if (!tituloLimpio) return alert('Escribe un título para la receta.');

    // Validacion de imagen obligatoria
    const imagenFinal = modoImagen === 'galeria' ? imagenGaleriaData : imagen.trim();
    if (!imagenFinal) {
      return alert('Es obligatorio añadir una foto a la receta para que otros puedan verla.');
    }

    const versionesPayload = versiones.map((version) => {
      const extendedIngredients = version.ingredientes
        .map((ing) => {
          const name = String(ing.name || '').trim();
          if (!name) return null;
          const cantidad = Number(ing.cantidad || 0);
          const unidad = String(ing.unidad || '').trim();
          const original = `${cantidad || ''}${unidad ? ` ${unidad}` : ''} ${name}`.trim();
          return { name, cantidad, unidad, original };
        })
        .filter(Boolean);

      const steps = version.pasos
        .map((p) => String(p || '').trim())
        .filter(Boolean)
        .map((step, idx) => ({ number: idx + 1, step }));

      return {
        numero_personas: Number(version.numero_personas || 2),
        readyInMinutes: Number(version.readyInMinutes || 25),
        extendedIngredients,
        analyzedInstructions: [{ steps }],
      };
    });

    const invalida = versionesPayload.some((v) => !v.extendedIngredients.length || !v.analyzedInstructions[0].steps.length);
    if (invalida) return alert('Cada versión debe tener al menos un ingrediente y un paso.');

    setPublicando(true);
    try {
      const payload = {
        title: tituloLimpio,
        description: descripcion.trim(),
        image: modoImagen === 'galeria' ? imagenGaleriaData : imagen.trim(),
        source_url: sourceUrl.trim(),
        versiones: versionesPayload,
      };

      if (esEdicion) {
        await updateRecetaComunidad(recetaEdicion._id, payload);
        alert('Receta actualizada correctamente.');
      } else {
        await aportarRecetaComunidad(payload);
        alert('Receta publicada correctamente.');
      }

      navigate('/recetas-comunidad/mis-recetas');
    } catch (error) {
      alert(error.message || 'No se pudo guardar la receta.');
    } finally {
      setPublicando(false);
    }
  };

  return (
    <div className="contribuir-container">
      <div className="contribuir-top-bar">
        <button type="button" className="contribuir-back-btn" onClick={() => navigate('/recetas-comunidad')}>
          <FaArrowLeft /> Volver a la comunidad
        </button>
      </div>

      <form onSubmit={contribuirReceta} className="contribuir-form">
        <div className="contribuir-section">
          <div className="contribuir-grid-2">
            <div className="contribuir-input-wrapper">
              <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título de la receta" className="contribuir-input full" required maxLength="150" />
            </div>
            <div className="contribuir-input-wrapper" style={{ gridColumn: 'span 2' }}>
              <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '8px', display: 'block' }}>Descripción de la receta</label>
              <textarea 
                value={descripcion} 
                onChange={(e) => setDescripcion(e.target.value)} 
                placeholder="Cuenta de qué trata tu plato, su origen o por qué es especial..." 
                className="contribuir-textarea full" 
                maxLength="500"
                style={{ minHeight: '100px' }}
              />
            </div>
            <div className="contribuir-input-wrapper">
              <input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="Enlace original (opcional)" className="contribuir-input full" />
            </div>
          </div>
        </div>

        <div className="contribuir-section">
          <div className="contribuir-section-title">
            <h3>Imagen <span style={{ color: '#f43f5e', fontSize: '0.8rem', marginLeft: '5px' }}>(Obligatoria)</span></h3>
          </div>
          <div className="contribuir-grid-2">
            <div className="contribuir-input-wrapper">
              <CustomSelect
                value={modoImagen}
                onChange={(val) => setModoImagen(val)}
                options={[
                  { value: 'url', label: 'Imagen por URL' },
                  { value: 'galeria', label: 'Imagen desde galería' }
                ]}
              />
            </div>
            {modoImagen === 'url' ? (
              <div className="contribuir-input-wrapper">
                <input type="url" value={imagen} onChange={(e) => setImagen(e.target.value)} placeholder="URL de imagen" className="contribuir-input full" />
              </div>
            ) : (
              <div className="contribuir-input-wrapper">
                <input id="imagen-galeria" type="file" accept="image/*" onChange={onSeleccionarImagen} className="contribuir-file-input" />
                <label htmlFor="imagen-galeria" className="contribuir-file-label">{nombreImagenGaleria ? `✓ ${nombreImagenGaleria}` : 'Selecciona una imagen'}</label>
              </div>
            )}
          </div>
          {(imagen || imagenGaleriaData) && (
            <div className="contribuir-image-preview">
              <img src={modoImagen === 'galeria' ? imagenGaleriaData : imagen} alt="Previsualización" />
              <p>Vista previa de la imagen</p>
            </div>
          )}
        </div>

        <div className="contribuir-section">
          <div className="contribuir-section-title">
            <h3>Versiones por raciones</h3>
            <button type="button" onClick={anadirVersion} className="contribuir-add-btn"><FaPlus /> Añadir versión</button>
          </div>

          <div className="contribuir-tabs" role="tablist" aria-label="Versiones">
            {versiones.map((version, index) => (
              <button key={version.key} type="button" className={index === versionActiva ? 'contribuir-tab active' : 'contribuir-tab'} onClick={() => setVersionActiva(index)}>
                {version.numero_personas} personas
              </button>
            ))}
          </div>

          {versiones.map((version, idx) => (
            <div key={`${version.key}-panel`} className="contribuir-version-panel" style={{ display: idx === versionActiva ? 'block' : 'none' }}>
              <div className="contribuir-version-grid-top">
                <div className="contribuir-input-group">
                  <label className="contribuir-label">Raciones</label>
                  <div className="contribuir-input-with-icon">
                    <FaUser className="input-icon" />
                    <input type="number" min="1" value={version.numero_personas} onChange={(e) => actualizarVersion(idx, { numero_personas: Number(e.target.value || 1) })} className="contribuir-input" placeholder="Ej: 4" />
                  </div>
                </div>
                <div className="contribuir-input-group">
                  <label className="contribuir-label">Preparación (min)</label>
                  <div className="contribuir-input-with-icon">
                    <FaPencilAlt className="input-icon" />
                    <input type="number" min="1" max="1440" value={version.readyInMinutes} onChange={(e) => actualizarVersion(idx, { readyInMinutes: Number(e.target.value || 1) })} className="contribuir-input" placeholder="Ej: 25" required />
                  </div>
                </div>
                <div className="contribuir-header-actions">
                  <button type="button" className="contribuir-btn-ghost-danger" onClick={() => eliminarVersion(idx)} disabled={versiones.length <= 1}>
                    <FaTrash /> Eliminar versión
                  </button>
                </div>
              </div>

              <div className="contribuir-section-title" style={{ marginTop: '24px' }}>
                <h3>Ingredientes</h3>
                <button type="button" className="contribuir-add-btn" onClick={() => anadirIngrediente(idx)}><FaPlus /> Añadir ingrediente</button>
              </div>

              <div className="contribuir-items-list">
                {version.ingredientes.map((ing, ingIdx) => (
                  <div key={`${version.key}-ing-${ingIdx}`} className="contribuir-item-row">
                    <div className="contribuir-item-field">
                      <input type="text" value={ing.name} onChange={(e) => actualizarIngrediente(idx, ingIdx, { name: e.target.value })} className="contribuir-input full" placeholder="Nombre ingrediente" required maxLength="100" />
                    </div>
                    <div className="contribuir-item-field compact">
                      <input type="number" min="0" step="0.01" value={ing.cantidad} onChange={(e) => actualizarIngrediente(idx, ingIdx, { cantidad: e.target.value })} className="contribuir-input full" placeholder="Cant." required />
                    </div>
                    <div className="contribuir-item-field compact">
                      <CustomSelect
                        value={ing.unidad}
                        onChange={(val) => actualizarIngrediente(idx, ingIdx, { unidad: val })}
                        options={[
                          { value: 'g', label: 'g' },
                          { value: 'kg', label: 'kg' },
                          { value: 'ml', label: 'ml' },
                          { value: 'l', label: 'l' },
                          { value: 'unidad', label: 'ud.' },
                          { value: 'cucharada', label: 'cda' },
                          { value: 'cucharadita', label: 'cdta' },
                          { value: 'al gusto', label: 'al gusto' },
                          { value: '', label: 'Sin medida' }
                        ]}
                      />
                    </div>
                    <button type="button" className="contribuir-delete-btn" onClick={() => eliminarIngrediente(idx, ingIdx)} disabled={version.ingredientes.length <= 1} title="Quitar ingrediente">
                      <FaTrash />
                    </button>
                  </div>
                ))}
              </div>

              <div className="contribuir-section-title" style={{ marginTop: '12px' }}>
                <h3>Instrucciones</h3>
                <button type="button" className="contribuir-add-btn" onClick={() => anadirPaso(idx)}><FaPlus /> Paso</button>
              </div>
              <div className="contribuir-items-list">
                {version.pasos.map((paso, pasoIdx) => (
                  <div key={`${version.key}-paso-${pasoIdx}`} className="contribuir-item-row">
                    <textarea value={paso} onChange={(e) => actualizarPaso(idx, pasoIdx, e.target.value)} className="contribuir-textarea contribuir-item-input" placeholder={`Paso ${pasoIdx + 1}`} required maxLength="2000" />
                    <button type="button" className="contribuir-delete-btn" onClick={() => eliminarPaso(idx, pasoIdx)} disabled={version.pasos.length <= 1} title="Quitar paso">
                      <FaTrash />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="contribuir-actions">
          <button type="submit" className="contribuir-submit-btn" disabled={publicando}>
            <FaPaperPlane /> {publicando ? 'Guardando...' : esEdicion ? 'Actualizar receta' : 'Publicar receta'}
          </button>
        </div>
      </form>
    </div>
  );
}
