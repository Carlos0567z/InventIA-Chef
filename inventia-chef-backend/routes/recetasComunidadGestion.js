const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const RecetaComunidad = require('../models/RecetaComunidad');
const Comentario = require('../models/Comentario');
const Perfil = require('../models/Perfil');
const requireAuth = require('../middleware/requireAuth');
const optionalAuth = require('../middleware/optionalAuth');

function escapeRegex(text) {
  return String(text || '').replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

function sanitizeText(text) {
  if (!text) return '';
  return String(text)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim();
}

function findRecetaFilter(id) {
  return mongoose.isValidObjectId(id)
    ? { $or: [{ _id: id }, { id_externo: id }] }
    : { id_externo: id };
}

// -------------------------------------------------------------
// POST /aportar & POST /contribuir — Crear receta de comunidad
// -------------------------------------------------------------
router.post(['/aportar', '/contribuir'], requireAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      image,
      versiones,
      prompt_origen,
    } = req.body || {};

    const tituloTrim = sanitizeText(title);
    if (!tituloTrim) {
      return res.status(400).json({ mensaje: 'El título de la receta es obligatorio' });
    }
    if (tituloTrim.length > 150) {
      return res.status(400).json({ mensaje: 'El título es demasiado largo (máx. 150 caracteres)' });
    }

    if (!Array.isArray(versiones) || versiones.length === 0) {
      return res.status(400).json({ mensaje: 'Debes añadir al menos una versión de la receta' });
    }

    const primeraVersion = versiones[0];
    const baseId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const id_externo = `com-${baseId}`;

    let imagenFinal = String(image || '').trim();
    if (!imagenFinal) {
      imagenFinal = 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=500';
    } else if (imagenFinal.length > 1024 * 1024) {
      return res.status(400).json({ mensaje: 'La imagen es demasiado pesada. Máximo 1MB.' });
    }

    const receta = await RecetaComunidad.create({
      id_externo,
      title: tituloTrim,
      description: sanitizeText(description),
      image: imagenFinal,
      versiones: versiones.map((v) => ({
        numero_personas: Number(v.numero_personas) || 2,
        readyInMinutes: Number(v.readyInMinutes) || 25,
        servings: Number(v.numero_personas) || 2,
        extendedIngredients: Array.isArray(v.extendedIngredients) ? v.extendedIngredients : [],
        analyzedInstructions: Array.isArray(v.analyzedInstructions) ? v.analyzedInstructions : [],
      })),
      extendedIngredients: primeraVersion.extendedIngredients || [],
      readyInMinutes: Number(primeraVersion.readyInMinutes) || 25,
      servings: Number(primeraVersion.numero_personas) || 2,
      analyzedInstructions: primeraVersion.analyzedInstructions || [],
      prompt_origen: prompt_origen || '',
      autor_id: req.user.id,
      autor_nombre: req.user.nombre,
      estado: 'publicada',
      numero_likes: 0,
      likes: [],
      numero_comentarios: 0,
      puntuacion_media: 0,
    });

    res.status(201).json(receta);
  } catch (error) {
    console.error('Error creando receta:', error);
    res.status(500).json({ mensaje: 'Error al aportar receta' });
  }
});

// -------------------------------------------------------------
// GET /mis-recetas — Recetas creadas por el usuario autenticado
// -------------------------------------------------------------
router.get('/mis-recetas', requireAuth, async (req, res) => {
  try {
    const recetas = await RecetaComunidad.find({ autor_id: req.user.id })
      .sort({ fecha_publicacion: -1 })
      .select('title image description estado fecha_publicacion versiones readyInMinutes numero_likes puntuacion_media numero_comentarios id_externo');

    res.status(200).json(recetas);
  } catch (error) {
    console.error('Error obteniendo recetas del usuario:', error);
    res.status(500).json({ mensaje: 'Error al obtener tus recetas' });
  }
});

// -------------------------------------------------------------
// GET / — Listar recetas de la comunidad con filtros y orden
// -------------------------------------------------------------
router.get('/', optionalAuth, async (req, res) => {
  try {
    const { buscar, ordenar, autor_id, limit = 50 } = req.query;

    const filtro = { estado: 'publicada' };

    if (buscar && String(buscar).trim()) {
      const escaped = escapeRegex(String(buscar).trim());
      filtro.$or = [
        { title: { $regex: escaped, $options: 'i' } },
        { autor_nombre: { $regex: escaped, $options: 'i' } },
        { description: { $regex: escaped, $options: 'i' } },
      ];
    }

    if (autor_id) {
      if (mongoose.isValidObjectId(autor_id)) {
        filtro.autor_id = autor_id;
      }
    }

    let query = RecetaComunidad.find(filtro)
      .select('title image description autor_id autor_nombre fecha_publicacion extendedIngredients readyInMinutes servings versiones numero_likes puntuacion_media numero_comentarios id_externo likes');

    // Ordenamiento avanzado
    if (ordenar === 'populares') {
      query = query.sort({ numero_likes: -1, fecha_publicacion: -1 });
    } else if (ordenar === 'valoradas') {
      query = query.sort({ puntuacion_media: -1, numero_comentarios: -1, fecha_publicacion: -1 });
    } else if (ordenar === 'rapidez') {
      query = query.sort({ readyInMinutes: 1, fecha_publicacion: -1 });
    } else {
      query = query.sort({ fecha_publicacion: -1 });
    }

    const maxLimit = Math.min(Math.max(Number(limit) || 50, 1), 100);
    const recetas = await query.limit(maxLimit).lean();

    const currentUserId = req.user?.id ? String(req.user.id) : null;
    const items = recetas.map((r) => {
      const hasLiked = currentUserId && Array.isArray(r.likes)
        ? r.likes.some((id) => String(id) === currentUserId)
        : false;
      return {
        ...r,
        has_liked: hasLiked,
        // no enviar la lista completa de likes en el feed para ahorrar ancho de banda
        likes: undefined,
      };
    });

    res.status(200).json(items);
  } catch (error) {
    console.error('Error listando recetas:', error);
    res.status(500).json({ mensaje: 'Error al listar recetas' });
  }
});

// -------------------------------------------------------------
// GET /:id — Obtener detalle de una receta
// -------------------------------------------------------------
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const filtro = findRecetaFilter(id);

    const receta = await RecetaComunidad.findOne(filtro).lean();
    if (!receta) {
      return res.status(404).json({ mensaje: 'Receta no encontrada' });
    }

    if (receta.estado !== 'publicada') {
      const esAutor = req.user && String(req.user.id) === String(receta.autor_id);
      const esAdmin = req.user && req.user.rol === 'admin';
      if (!esAutor && !esAdmin) {
        return res.status(404).json({ mensaje: 'Receta no disponible' });
      }
    }

    // Datos adicionales del autor
    const perfilAutor = await Perfil.findOne({ user_id: String(receta.autor_id) })
      .select('imagen_perfil biografia')
      .lean();
    receta.autor_image = perfilAutor?.imagen_perfil || '';
    receta.autor_bio = perfilAutor?.biografia || '';

    // Check si el usuario actual ha dado like
    const currentUserId = req.user?.id ? String(req.user.id) : null;
    receta.has_liked = currentUserId && Array.isArray(receta.likes)
      ? receta.likes.some((uid) => String(uid) === currentUserId)
      : false;

    res.status(200).json(receta);
  } catch (error) {
    console.error('Error obteniendo receta:', error);
    res.status(500).json({ mensaje: 'Error al obtener receta' });
  }
});

// -------------------------------------------------------------
// POST /:id/like — Dar o quitar Like (Toggle)
// -------------------------------------------------------------
router.post('/:id/like', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const filtro = findRecetaFilter(id);

    const receta = await RecetaComunidad.findOne(filtro);
    if (!receta) {
      return res.status(404).json({ mensaje: 'Receta no encontrada' });
    }

    const userObjectId = new mongoose.Types.ObjectId(String(userId));
    const yaDioLike = receta.likes.some((uid) => String(uid) === String(userId));

    let updated;
    if (yaDioLike) {
      updated = await RecetaComunidad.findOneAndUpdate(
        { _id: receta._id },
        {
          $pull: { likes: userObjectId },
          $inc: { numero_likes: -1 },
        },
        { returnDocument: 'after' }
      );
      // Garantizar que no sea negativo por inconsistencias previas
      if (updated.numero_likes < 0) {
        updated.numero_likes = 0;
        await updated.save();
      }
      return res.status(200).json({
        liked: false,
        numero_likes: Math.max(updated.numero_likes, 0),
        mensaje: 'Like retirado',
      });
    } else {
      updated = await RecetaComunidad.findOneAndUpdate(
        { _id: receta._id },
        {
          $addToSet: { likes: userObjectId },
          $inc: { numero_likes: 1 },
        },
        { returnDocument: 'after' }
      );
      return res.status(200).json({
        liked: true,
        numero_likes: updated.numero_likes,
        mensaje: 'Like registrado',
      });
    }
  } catch (error) {
    console.error('Error gestionando like:', error);
    res.status(500).json({ mensaje: 'Error al procesar el like' });
  }
});

// -------------------------------------------------------------
// GET /:id/comentarios — Listar comentarios de una receta
// -------------------------------------------------------------
router.get('/:id/comentarios', async (req, res) => {
  try {
    const { id } = req.params;
    const filtro = findRecetaFilter(id);
    const receta = await RecetaComunidad.findOne(filtro).select('_id');
    if (!receta) {
      return res.status(404).json({ mensaje: 'Receta no encontrada' });
    }

    const comentarios = await Comentario.find({ receta_id: receta._id })
      .sort({ fecha: -1 })
      .lean();

    res.status(200).json(comentarios);
  } catch (error) {
    console.error('Error obteniendo comentarios:', error);
    res.status(500).json({ mensaje: 'Error al obtener comentarios' });
  }
});

// -------------------------------------------------------------
// POST /:id/comentarios — Publicar comentario y valoración
// -------------------------------------------------------------
router.post('/:id/comentarios', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { puntuacion, contenido } = req.body || {};

    const filtro = findRecetaFilter(id);
    const receta = await RecetaComunidad.findOne(filtro);
    if (!receta) {
      return res.status(404).json({ mensaje: 'Receta no encontrada' });
    }

    const ratingNum = Math.round(Number(puntuacion));
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ mensaje: 'La valoración debe ser un número entre 1 y 5 estrellas' });
    }

    const textoLimpio = sanitizeText(contenido);
    if (!textoLimpio) {
      return res.status(400).json({ mensaje: 'El comentario no puede estar vacío' });
    }
    if (textoLimpio.length > 600) {
      return res.status(400).json({ mensaje: 'El comentario es demasiado largo (máximo 600 caracteres)' });
    }

    // Buscar foto de perfil del autor del comentario
    const perfilAutor = await Perfil.findOne({ user_id: String(req.user.id) }).select('imagen_perfil').lean();

    const nuevoComentario = await Comentario.create({
      receta_id: receta._id,
      autor_id: req.user.id,
      autor_nombre: req.user.nombre,
      autor_imagen: perfilAutor?.imagen_perfil || '',
      contenido: textoLimpio,
      puntuacion: ratingNum,
      respuestas: [],
    });

    const stats = await Comentario.recalcularEstadisticasReceta(receta._id);

    res.status(201).json({
      comentario: nuevoComentario,
      numero_comentarios: stats.numero_comentarios,
      puntuacion_media: stats.puntuacion_media,
    });
  } catch (error) {
    console.error('Error creando comentario:', error);
    res.status(500).json({ mensaje: 'Error al publicar el comentario' });
  }
});

// -------------------------------------------------------------
// POST /:id/comentarios/:comentarioId/respuesta — Responder a comentario
// -------------------------------------------------------------
router.post('/:id/comentarios/:comentarioId/respuesta', requireAuth, async (req, res) => {
  try {
    const { comentarioId } = req.params;
    const { texto } = req.body || {};

    const textoLimpio = sanitizeText(texto);
    if (!textoLimpio) {
      return res.status(400).json({ mensaje: 'La respuesta no puede estar vacía' });
    }
    if (textoLimpio.length > 400) {
      return res.status(400).json({ mensaje: 'La respuesta es demasiado larga (máx. 400 caracteres)' });
    }

    const perfilAutor = await Perfil.findOne({ user_id: String(req.user.id) }).select('imagen_perfil').lean();

    const comentario = await Comentario.findById(comentarioId);
    if (!comentario) {
      return res.status(404).json({ mensaje: 'Comentario no encontrado' });
    }

    const nuevaRespuesta = {
      autor_id: req.user.id,
      autor_nombre: req.user.nombre,
      autor_imagen: perfilAutor?.imagen_perfil || '',
      texto: textoLimpio,
      fecha: new Date(),
    };

    comentario.respuestas.push(nuevaRespuesta);
    await comentario.save();

    res.status(201).json(comentario);
  } catch (error) {
    console.error('Error respondiendo comentario:', error);
    res.status(500).json({ mensaje: 'Error al enviar respuesta' });
  }
});

// -------------------------------------------------------------
// DELETE /:id/comentarios/:comentarioId — Eliminar comentario
// -------------------------------------------------------------
router.delete('/:id/comentarios/:comentarioId', requireAuth, async (req, res) => {
  try {
    const { comentarioId } = req.params;
    const comentario = await Comentario.findById(comentarioId);
    if (!comentario) {
      return res.status(404).json({ mensaje: 'Comentario no encontrado' });
    }

    const esAutor = String(comentario.autor_id) === String(req.user.id);
    const esAdmin = req.user.rol === 'admin';
    if (!esAutor && !esAdmin) {
      return res.status(403).json({ mensaje: 'No tienes permiso para eliminar este comentario' });
    }

    const recetaId = comentario.receta_id;
    await Comentario.findByIdAndDelete(comentarioId);
    const stats = await Comentario.recalcularEstadisticasReceta(recetaId);

    res.status(200).json({
      mensaje: 'Comentario eliminado',
      numero_comentarios: stats.numero_comentarios,
      puntuacion_media: stats.puntuacion_media,
    });
  } catch (error) {
    console.error('Error eliminando comentario:', error);
    res.status(500).json({ mensaje: 'Error al eliminar comentario' });
  }
});

// -------------------------------------------------------------
// PUT /:id — Editar receta existente
// -------------------------------------------------------------
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const filtro = findRecetaFilter(req.params.id);
    const receta = await RecetaComunidad.findOne(filtro);

    if (!receta) {
      return res.status(404).json({ mensaje: 'Receta no encontrada' });
    }

    const esAutor = String(receta.autor_id) === String(req.user.id);
    const esAdmin = req.user.rol === 'admin';
    if (!esAutor && !esAdmin) {
      return res.status(403).json({ mensaje: 'No puedes editar recetas de otros usuarios' });
    }

    const { title, description, image, versiones } = req.body;

    if (title) receta.title = sanitizeText(title);
    if (description !== undefined) receta.description = sanitizeText(description);
    if (image) {
      if (image.length > 1024 * 1024) {
        return res.status(400).json({ mensaje: 'La imagen es demasiado pesada. Máximo 1MB.' });
      }
      receta.image = image;
    }

    if (versiones && Array.isArray(versiones) && versiones.length > 0) {
      receta.versiones = versiones.map((v) => ({
        numero_personas: Number(v.numero_personas) || 2,
        readyInMinutes: Number(v.readyInMinutes) || 25,
        servings: Number(v.numero_personas) || 2,
        extendedIngredients: v.extendedIngredients || [],
        analyzedInstructions: v.analyzedInstructions || [],
      }));
      receta.readyInMinutes = Number(versiones[0].readyInMinutes) || 25;
      receta.servings = Number(versiones[0].numero_personas) || 2;
      receta.extendedIngredients = versiones[0].extendedIngredients || [];
      receta.analyzedInstructions = versiones[0].analyzedInstructions || [];
    }

    receta.fecha_ultima_edicion = new Date();
    await receta.save();

    res.status(200).json(receta);
  } catch (error) {
    console.error('Error editando receta:', error);
    res.status(500).json({ mensaje: 'Error al editar receta' });
  }
});

// -------------------------------------------------------------
// DELETE /:id — Eliminar receta
// -------------------------------------------------------------
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const filtro = findRecetaFilter(req.params.id);
    const receta = await RecetaComunidad.findOne(filtro);

    if (!receta) {
      return res.status(404).json({ mensaje: 'Receta no encontrada' });
    }

    const esAutor = String(receta.autor_id) === String(req.user.id);
    const esAdmin = req.user.rol === 'admin';
    if (!esAutor && !esAdmin) {
      return res.status(403).json({ mensaje: 'No puedes eliminar recetas de otros usuarios' });
    }

    await RecetaComunidad.findByIdAndDelete(receta._id);
    await Comentario.deleteMany({ receta_id: receta._id });

    res.status(200).json({ mensaje: 'Receta eliminada correctamente' });
  } catch (error) {
    console.error('Error eliminando receta:', error);
    res.status(500).json({ mensaje: 'Error al eliminar receta' });
  }
});

// -------------------------------------------------------------
// POST /seed-demo — Crear recetas de demostración con valoraciones y comentarios
// -------------------------------------------------------------
router.post('/seed-demo', async (req, res) => {
  try {
    const Usuario = require('../models/Usuario');
    const bcrypt = require('bcryptjs');

    // Buscar o crear Chef demo
    let chef = await Usuario.findOne({ email: 'chef_demo@inventia.local' });
    if (!chef) {
      const hash = await bcrypt.hash('secreto123', 10);
      chef = await Usuario.create({
        nombre: 'Chef Mateo Rossi',
        email: 'chef_demo@inventia.local',
        password_hash: hash,
        rol: 'admin',
        biografia: 'Especialista en cocina mediterránea y fusión italiana. Formado en Bolonia y apasionado por los ingredientes frescos de temporada.',
      });
    }

    let perfilChef = await Perfil.findOne({ user_id: String(chef._id) });
    if (!perfilChef) {
      perfilChef = await Perfil.create({
        user_id: String(chef._id),
        nombre: chef.nombre,
        email: chef.email,
        imagen_perfil: 'https://images.unsplash.com/photo-1577219491135-ce391730fb2c?w=400',
        imagen_banner: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=1200',
        biografia: chef.biografia,
      });
    }

    // Buscar o crear Comensal demo
    let comensal = await Usuario.findOne({ email: 'comensal_demo@inventia.local' });
    if (!comensal) {
      const hash = await bcrypt.hash('secreto123', 10);
      comensal = await Usuario.create({
        nombre: 'Lucía Gourmet',
        email: 'comensal_demo@inventia.local',
        password_hash: hash,
        rol: 'usuario',
        biografia: 'Foodie empedernida buscando siempre nuevas recetas para sorprender a mi familia.',
      });
    }

    let perfilComensal = await Perfil.findOne({ user_id: String(comensal._id) });
    if (!perfilComensal) {
      perfilComensal = await Perfil.create({
        user_id: String(comensal._id),
        nombre: comensal.nombre,
        email: comensal.email,
        imagen_perfil: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400',
        biografia: comensal.biografia,
      });
    }

    // Recetas a sembrar
    const recetasDemo = [
      {
        id_externo: 'com-risotto-boletus-demo',
        title: 'Risotto Cremoso de Boletus y Parmesano',
        description: 'Un clásico del norte de Italia con setas boletus edulis, caldo casero a fuego lento y mantecado con queso parmesano curado 24 meses.',
        image: 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=900',
        readyInMinutes: 30,
        servings: 4,
        autor_id: chef._id,
        autor_nombre: chef.nombre,
        estado: 'publicada',
        numero_likes: 12,
        likes: [comensal._id],
        versiones: [
          {
            numero_personas: 4,
            readyInMinutes: 30,
            servings: 4,
            extendedIngredients: [
              { name: 'Arroz arborio', cantidad: 320, unidad: 'g', original: '320g arroz arborio' },
              { name: 'Boletus frescos o hidratados', cantidad: 250, unidad: 'g', original: '250g boletus edulis' },
              { name: 'Caldo de verduras', cantidad: 1, unidad: 'l', original: '1 litro de caldo caliente' },
              { name: 'Queso Parmesano', cantidad: 70, unidad: 'g', original: '70g parmesano rallado' },
              { name: 'Mantequilla fría', cantidad: 30, unidad: 'g', original: '30g mantequilla para mantecar' },
            ],
            analyzedInstructions: [
              {
                steps: [
                  { number: 1, step: 'Picar la chalota muy fina y pocharla en aceite de oliva virgen extra.' },
                  { number: 2, step: 'Añadir los boletus troceados y saltear hasta que suelten su agua aromática.' },
                  { number: 3, step: 'Incorporar el arroz arborio y nacarar durante 2 minutos a fuego vivo.' },
                  { number: 4, step: 'Verter el caldo cucharón a cucharón sin dejar de remover con cuchara de madera.' },
                  { number: 5, step: 'Retirar del fuego y mantecar enérgicamente con la mantequilla fría y el parmesano.' },
                ],
              },
            ],
          },
          {
            numero_personas: 2,
            readyInMinutes: 25,
            servings: 2,
            extendedIngredients: [
              { name: 'Arroz arborio', cantidad: 160, unidad: 'g', original: '160g arroz arborio' },
              { name: 'Boletus frescos o hidratados', cantidad: 130, unidad: 'g', original: '130g boletus edulis' },
              { name: 'Caldo de verduras', cantidad: 500, unidad: 'ml', original: '500ml de caldo caliente' },
              { name: 'Queso Parmesano', cantidad: 35, unidad: 'g', original: '35g parmesano rallado' },
              { name: 'Mantequilla fría', cantidad: 15, unidad: 'g', original: '15g mantequilla para mantecar' },
            ],
            analyzedInstructions: [
              {
                steps: [
                  { number: 1, step: 'Pochar la chalota en aceite de oliva virgen extra.' },
                  { number: 2, step: 'Saltear los boletus y nacarar el arroz.' },
                  { number: 3, step: 'Añadir caldo poco a poco y mantecar al final con parmesano.' },
                ],
              },
            ],
          },
        ],
      },
      {
        id_externo: 'com-tacos-pastor-demo',
        title: 'Tacos de Cerdo al Pastor Caseros',
        description: 'Auténticos tacos mexicanos marinados en adobo de achiote, naranja agria y especias, acompañados de piña asada, cebolla y cilantro.',
        image: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=900',
        readyInMinutes: 40,
        servings: 4,
        autor_id: chef._id,
        autor_nombre: chef.nombre,
        estado: 'publicada',
        numero_likes: 18,
        likes: [comensal._id],
        versiones: [
          {
            numero_personas: 4,
            readyInMinutes: 40,
            servings: 4,
            extendedIngredients: [
              { name: 'Lomo de cerdo en tiras finas', cantidad: 600, unidad: 'g', original: '600g lomo de cerdo' },
              { name: 'Pasta de achiote', cantidad: 50, unidad: 'g', original: '50g achiote' },
              { name: 'Zumo de naranja y lima', cantidad: 100, unidad: 'ml', original: '100ml zumo cítrico' },
              { name: 'Piña natural en rodajas', cantidad: 4, unidad: 'rodajas', original: '4 rodajas de piña fresca' },
              { name: 'Tortillas de maíz', cantidad: 12, unidad: 'unidades', original: '12 tortillas de maíz' },
            ],
            analyzedInstructions: [
              {
                steps: [
                  { number: 1, step: 'Mezclar el achiote con el zumo cítrico, orégano, comino y ajo machacado.' },
                  { number: 2, step: 'Marinar el cerdo durante al menos 30 minutos (o toda la noche).' },
                  { number: 3, step: 'Cocinar la carne a fuego fuerte en sartén de hierro o plancha bien caliente.' },
                  { number: 4, step: 'Asar las rodajas de piña hasta caramelizar y cortar en dados pequeños.' },
                  { number: 5, step: 'Montar sobre tortillas calientes con piña, cilantro fresco picado y cebolla.' },
                ],
              },
            ],
          },
        ],
      },
      {
        id_externo: 'com-tarta-queso-demo',
        title: 'Tarta de Queso Fluida Estilo La Viña',
        description: 'La famosa tarta de queso vasca: tostada y dorada por fuera, ultra cremosa y semilíquida en el centro. Sin base de galleta.',
        image: 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=900',
        readyInMinutes: 50,
        servings: 6,
        autor_id: chef._id,
        autor_nombre: chef.nombre,
        estado: 'publicada',
        numero_likes: 25,
        likes: [comensal._id],
        versiones: [
          {
            numero_personas: 6,
            readyInMinutes: 50,
            servings: 6,
            extendedIngredients: [
              { name: 'Queso crema tipo Philadelphia', cantidad: 500, unidad: 'g', original: '500g queso crema' },
              { name: 'Nata para montar 35% MG', cantidad: 250, unidad: 'ml', original: '250ml nata líquida' },
              { name: 'Huevos grandes', cantidad: 4, unidad: 'unidades', original: '4 huevos camperos' },
              { name: 'Azúcar blanco', cantidad: 175, unidad: 'g', original: '175g azúcar' },
              { name: 'Harina de trigo', cantidad: 15, unidad: 'g', original: '1 cucharada de harina' },
            ],
            analyzedInstructions: [
              {
                steps: [
                  { number: 1, step: 'Precalentar el horno a 210°C con calor arriba y abajo.' },
                  { number: 2, step: 'Batir el queso crema con el azúcar hasta que quede suave y sin grumos.' },
                  { number: 3, step: 'Añadir los huevos uno a uno, mezclando suavemente sin meter demasiado aire.' },
                  { number: 4, step: 'Incorporar la nata y la cucharada de harina tamizada.' },
                  { number: 5, step: 'Forrar un molde con papel de horno humedecido, verter la mezcla y hornear 40 minutos.' },
                ],
              },
            ],
          },
        ],
      },
    ];

    const creadas = [];
    for (const rData of recetasDemo) {
      let r = await RecetaComunidad.findOne({ id_externo: rData.id_externo });
      if (!r) {
        r = await RecetaComunidad.create(rData);
        creadas.push(r.title);

        // Crear comentario con 5 estrellas
        await Comentario.create({
          receta_id: r._id,
          autor_id: comensal._id,
          autor_nombre: comensal.nombre,
          autor_imagen: perfilComensal.imagen_perfil,
          contenido: '¡Impresionante receta! La preparé ayer y a todos les encantó el punto de cocción y el aroma.',
          puntuacion: 5,
          respuestas: [
            {
              autor_id: chef._id,
              autor_nombre: chef.nombre,
              autor_imagen: perfilChef.imagen_perfil,
              texto: '¡Muchísimas gracias Lucía! El secreto está en mimar cada paso.',
              fecha: new Date(),
            },
          ],
        });
        await Comentario.recalcularEstadisticasReceta(r._id);
      }
    }

    res.status(200).json({
      mensaje: 'Sembrado de recetas demo completado',
      recetas_creadas: creadas,
      total_en_comunidad: await RecetaComunidad.countDocuments({ estado: 'publicada' }),
    });
  } catch (error) {
    console.error('Error sembrando recetas demo:', error);
    res.status(500).json({ mensaje: 'Error al sembrar recetas demo' });
  }
});

module.exports = router;
