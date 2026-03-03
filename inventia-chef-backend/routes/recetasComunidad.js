const express = require('express');
const mongoose = require('mongoose');
const RecetaComunidad = require('../models/RecetaComunidad');
const Perfil = require('../models/Perfil');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();
function esHttpUrl(texto) {
  if (!texto) return false;
  let str = String(texto).trim();
  // Si no tiene protocolo, intentamos añadirle https:// para validar
  if (!/^https?:\/\//i.test(str)) {
    str = 'https://' + str;
  }
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function esDataImageUrl(texto) {
  return /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(String(texto || ''));
}

function normalizarRecetaManual(payload, user) {
  const titulo = String(payload?.title || '').trim();
  if (!titulo) {
    throw new Error('El titulo de la receta es obligatorio');
  }
  if (titulo.length > 150) {
    throw new Error('El titulo es demasiado largo');
  }

  // Soporte para versiones múltiples enviadas por el frontend
  const versionesPayload = Array.isArray(payload?.versiones) ? payload.versiones : [];
  
  if (versionesPayload.length === 0) {
    throw new Error('Debes añadir al menos una versión de la receta');
  }

  // Tomamos la primera versión como base para los campos legacy
  const primeraVersion = versionesPayload[0];
  const ingredientes = Array.isArray(primeraVersion?.extendedIngredients) ? primeraVersion.extendedIngredients : [];
  const pasos = Array.isArray(primeraVersion?.analyzedInstructions?.[0]?.steps) ? primeraVersion.analyzedInstructions[0].steps : [];

  const baseId = `${titulo}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let imagenRaw = String(payload?.image || '').trim();
  
  // Pequeño fix: si el usuario no pone protocolo, se lo ponemos para que sea una URL válida
  if (imagenRaw && !esDataImageUrl(imagenRaw) && !/^https?:\/\//i.test(imagenRaw)) {
    imagenRaw = 'https://' + imagenRaw;
  }

  const sourceUrlRaw = String(payload?.source_url || '').trim();
  const imagenValida = imagenRaw && (esHttpUrl(imagenRaw) || esDataImageUrl(imagenRaw));
  const sourceUrlValida = sourceUrlRaw ? esHttpUrl(sourceUrlRaw) : false;

  // Validacion de peso de imagen (Max 1MB en Base64)
  if (esDataImageUrl(imagenRaw) && imagenRaw.length > 1024 * 1024) {
    throw new Error('La imagen de la receta es demasiado pesada. Por favor, comprimela o usa otra.');
  }

  return {
    id_externo: `com-${baseId}`,
    title: titulo,
    description: String(payload?.description || '').trim(),
    image: imagenValida ? imagenRaw : 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=500',
    source_url: sourceUrlValida ? sourceUrlRaw : '',
    versiones: versionesPayload,
    // Compatibilidad legacy
    readyInMinutes: Number(primeraVersion?.readyInMinutes) || 25,
    servings: Number(primeraVersion?.numero_personas) || 2,
    usedIngredients: ingredientes.map((item) => ({ name: item.name || item.original })),
    extendedIngredients: ingredientes,
    analyzedInstructions: [{ steps: pasos }],
    tipo: 'Comunidad',
    autor_id: String(user?.id || ''),
    autor_nombre: String(user?.nombre || ''),
  };
}

router.get('/', async (req, res) => {
  try {
    const recetas = await RecetaComunidad.find().sort({ fecha_publicacion: -1 });
    res.status(200).json(recetas);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener recetas de la comunidad' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const filtro = mongoose.isValidObjectId(id)
      ? { $or: [{ _id: id }, { id_externo: id }] }
      : { id_externo: id };

    let receta = await RecetaComunidad.findOne(filtro).lean();
    if (!receta) {
      return res.status(404).json({ mensaje: 'Receta no encontrada' });
    }

    const perfilAutor = await Perfil.findOne({ user_id: receta.autor_id }).select('imagen_perfil');
    receta.autor_image = perfilAutor?.imagen_perfil || '';

    return res.status(200).json(receta);
  } catch (error) {
    console.error('Error al obtener receta:', error);
    res.status(500).json({ mensaje: 'Error al obtener receta de comunidad' });
  }
});

router.post('/contribuir', requireAuth, async (req, res) => {
  try {
    const recetaNormalizada = normalizarRecetaManual(req.body || {}, req.user);

    const nueva = new RecetaComunidad(recetaNormalizada);
    await nueva.save();

    return res.status(201).json(nueva);
  } catch (error) {
    console.error('Error al contribuir receta de comunidad:', error);
    return res.status(400).json({ mensaje: error?.message || 'No se pudo guardar la receta de comunidad' });
  }
});

module.exports = router;
