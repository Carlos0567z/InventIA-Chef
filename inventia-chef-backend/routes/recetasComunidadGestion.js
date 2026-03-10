const express = require('express');
const router = express.Router();
const RecetaComunidad = require('../models/RecetaComunidad');
const requireAuth = require('../middleware/requireAuth');

router.post('/aportar', requireAuth, async (req, res) => {
  try {
    const {
      title,
      description,
      image,
      versiones,
      prompt_origen,
    } = req.body;

    if (!title || !versiones || versiones.length === 0) {
      return res.status(400).json({ mensaje: 'Título y al menos una versión de receta son obligatorios' });
    }

    const id_externo = `com-${title}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const receta = await RecetaComunidad.create({
      id_externo,
      title,
      description: description || '',
      image: image || 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=500',
      versiones: versiones.map((v) => ({
        numero_personas: v.numero_personas,
        readyInMinutes: v.readyInMinutes || 25,
        servings: v.numero_personas,
        extendedIngredients: v.extendedIngredients || [],
        analyzedInstructions: v.analyzedInstructions || [],
      })),
      extendedIngredients: versiones[0].extendedIngredients || [],
      readyInMinutes: versiones[0].readyInMinutes || 25,
      servings: versiones[0].numero_personas || 2,
      analyzedInstructions: versiones[0].analyzedInstructions || [],
      prompt_origen: prompt_origen || '',
      autor_id: req.user.id,
      autor_nombre: req.user.nombre,
      estado: 'publicada',
    });

    res.status(201).json(receta);
  } catch (error) {
    console.error('Error creando receta:', error);
    res.status(500).json({ mensaje: 'Error al aportar receta' });
  }
});

router.get('/mis-recetas', requireAuth, async (req, res) => {
  try {
    const recetas = await RecetaComunidad.find({ autor_id: req.user.id })
      .sort({ fecha_publicacion: -1 })
      .select('title image estado fecha_publicacion versiones readyInMinutes');

    res.status(200).json(recetas);
  } catch (error) {
    console.error('Error obteniendo recetas del usuario:', error);
    res.status(500).json({ mensaje: 'Error al obtener tus recetas' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const receta = await RecetaComunidad.findById(req.params.id).populate('autor_id', 'nombre email');

    if (!receta) {
      return res.status(404).json({ mensaje: 'Receta no encontrada' });
    }

    if (receta.estado !== 'publicada') {
      return res.status(404).json({ mensaje: 'Receta no disponible' });
    }

    res.status(200).json(receta);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener receta' });
  }
});

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const receta = await RecetaComunidad.findById(req.params.id);

    if (!receta) {
      return res.status(404).json({ mensaje: 'Receta no encontrada' });
    }

    if (receta.autor_id.toString() !== req.user.id) {
      return res.status(403).json({ mensaje: 'No puedes editar recetas de otros usuarios' });
    }

    const { title, description, image, versiones } = req.body;

    receta.title = title || receta.title;
    receta.description = description !== undefined ? description : receta.description;
    receta.image = image || receta.image;

    if (versiones && versiones.length > 0) {
      receta.versiones = versiones.map((v) => ({
        numero_personas: v.numero_personas,
        readyInMinutes: v.readyInMinutes || 25,
        servings: v.numero_personas,
        extendedIngredients: v.extendedIngredients || [],
        analyzedInstructions: v.analyzedInstructions || [],
      }));
    }

    receta.fecha_ultima_edicion = new Date();

    await receta.save();

    res.status(200).json(receta);
  } catch (error) {
    console.error('Error editando receta:', error);
    res.status(500).json({ mensaje: 'Error al editar receta' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const receta = await RecetaComunidad.findById(req.params.id);

    if (!receta) {
      return res.status(404).json({ mensaje: 'Receta no encontrada' });
    }

    if (receta.autor_id.toString() !== req.user.id) {
      return res.status(403).json({ mensaje: 'No puedes eliminar recetas de otros usuarios' });
    }

    await RecetaComunidad.findByIdAndDelete(req.params.id);

    res.status(200).json({ mensaje: 'Receta eliminada' });
  } catch (error) {
    console.error('Error eliminando receta:', error);
    res.status(500).json({ mensaje: 'Error al eliminar receta' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { buscar, ordenar, autor_id } = req.query;

    const filtro = { estado: 'publicada' };

    if (buscar) {
      filtro.$or = [
        { title: { $regex: buscar, $options: 'i' } },
        { autor_nombre: { $regex: buscar, $options: 'i' } },
      ];
    }

    if (autor_id) {
      filtro.autor_id = autor_id;
    }

    let query = RecetaComunidad.find(filtro)
      .populate('autor_id', 'nombre')
      .select('title image autor_nombre fecha_publicacion extendedIngredients readyInMinutes versiones');

    if (ordenar === 'rapidez') {
      query = query.sort({ readyInMinutes: 1 });
    } else {
      query = query.sort({ fecha_publicacion: -1 });
    }

    const recetas = await query.limit(50);

    res.status(200).json(recetas);
  } catch (error) {
    console.error('Error listando recetas:', error);
    res.status(500).json({ mensaje: 'Error al listar recetas' });
  }
});

module.exports = router;
