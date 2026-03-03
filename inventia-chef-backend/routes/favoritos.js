const express = require('express');
const Favorito = require('../models/Favorito');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

// POST: Guardar una receta en favoritos
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const idExterno = String(req.body?.id_externo || '');
    const tipo = String(req.body?.tipo || '').toUpperCase();

    if (!idExterno) {
      return res.status(400).json({ mensaje: 'id_externo es obligatorio' });
    }

    const existente = await Favorito.findOne({
      user_id: userId,
      id_externo: idExterno,
      tipo: { $regex: `^${tipo || 'SPOONACULAR'}$`, $options: 'i' },
    });

    if (existente) {
      return res.status(200).json(existente);
    }

    const nuevaReceta = new Favorito({
      ...req.body,
      user_id: userId,
    });
    await nuevaReceta.save();
    res.status(201).json(nuevaReceta);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al guardar el favorito' });
  }
});

// GET: Obtener todos los favoritos
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const favoritos = await Favorito.find({ user_id: userId }).sort({ fecha_guardado: -1 });
    res.status(200).json(favoritos);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener favoritos' });
  }
});

// GET: Obtener un favorito por id
router.get('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const favorito = await Favorito.findOne({ _id: req.params.id, user_id: userId });
    if (!favorito) {
      return res.status(404).json({ mensaje: 'Favorito no encontrado' });
    }
    res.status(200).json(favorito);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener favorito' });
  }
});

// DELETE: Eliminar de favoritos
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    await Favorito.findOneAndDelete({ _id: req.params.id, user_id: userId });
    res.status(200).json({ mensaje: 'Eliminado de favoritos' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al eliminar' });
  }
});

module.exports = router;
