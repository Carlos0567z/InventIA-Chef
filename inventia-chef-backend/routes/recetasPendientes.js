const express = require('express');
const router = express.Router();
const RecetaPendiente = require('../models/RecetaPendiente');
const requireAuth = require('../middleware/requireAuth');

router.use(requireAuth);

// GET: Obtener todas las recetas planificadas
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const pendientes = await RecetaPendiente.find({ user_id: userId }).sort({ fecha_planificada: -1 });
        res.status(200).json(pendientes);
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al obtener plan semanal' });
    }
});



// POST: Añadir al plan semanal (pendientes)
router.post('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const recetaInfo = req.body;
        
        const existe = await RecetaPendiente.findOne({
            user_id: userId,
            id_externo: recetaInfo.id_externo,
            tipo: recetaInfo.tipo
        });
        
        if (existe) {
            return res.status(409).json({ mensaje: 'Esta receta ya esta en tus pendientes (duplicate)' });
        }

        const nuevaPendiente = new RecetaPendiente({
            user_id: userId,
            ...recetaInfo
        });

        const guardada = await nuevaPendiente.save();
        res.status(201).json(guardada);
    } catch (error) {
        console.error('Error interno POST pendientes:', error);
        if (error.code === 11000) {
            return res.status(409).json({ mensaje: 'Esta receta ya esta en tus pendientes (duplicate)' });
        }
        res.status(500).json({ mensaje: 'Error al anadir a pendientes' });
    }
});

// DELETE: Eliminar del plan semanal (ej: tras cocinarla)
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        await RecetaPendiente.findOneAndDelete({ _id: req.params.id, user_id: userId });
        res.status(200).json({ mensaje: 'Eliminada del plan' });
    } catch (error) {
        res.status(500).json({ mensaje: 'Error al eliminar' });
    }
});

module.exports = router;
