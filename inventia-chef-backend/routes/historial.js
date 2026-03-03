const express = require('express');
const Historial = require('../models/Historial');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

router.use(requireAuth);

// GET: Obtener todos los tickets ordenados del mas nuevo al mas viejo
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const tickets = await Historial.find({ user_id: userId }).sort({ fecha: -1 });
    res.status(200).json(tickets);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al obtener el historial' });
  }
});

// POST: Guardar un nuevo ticket de compra
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const nuevoTicket = new Historial({
      ...req.body,
      user_id: userId,
    });
    await nuevoTicket.save();
    res.status(201).json(nuevoTicket);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al guardar el ticket' });
  }
});

// DELETE: Borrar todo el historial de tickets
router.delete('/', async (req, res) => {
  try {
    const userId = req.user.id;
    await Historial.deleteMany({ user_id: userId });
    res.status(200).json({ mensaje: 'Historial borrado correctamente' });
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al borrar el historial' });
  }
});

// PUT: Actualizar un ticket existente (por ejemplo, tras anadir productos manuales)
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const actualizado = await Historial.findOneAndUpdate(
      { _id: req.params.id, user_id: userId },
      req.body,
      { returnDocument: 'after', runValidators: true }
    );

    if (!actualizado) {
      return res.status(404).json({ mensaje: 'Ticket no encontrado' });
    }

    res.status(200).json(actualizado);
  } catch (error) {
    res.status(400).json({ mensaje: 'Error al actualizar el ticket' });
  }
});

module.exports = router;
