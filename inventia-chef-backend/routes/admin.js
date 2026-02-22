const express = require('express');
const mongoose = require('mongoose');
const requireAuth = require('../middleware/requireAuth');
const requireAdmin = require('../middleware/requireAdmin');
const { getSpoonacularBloqueadoHasta, isSpoonacularBloqueado } = require('../services/integrationState');
const { getAppSettings, updateAppSettings } = require('../services/appSettings');

const router = express.Router();

// Todos estos endpoints necesitan que estes logueado y seas admin
router.use(requireAuth);
router.use(requireAdmin);

// Panel principal: estadisticas de la base de datos
router.get('/dashboard', async (req, res) => {
  try {
    const db = mongoose.connection.db;

    // Contamos cuantos documentos hay en cada coleccion para el panel
    const [usuarios, alimentos, favoritos, pendientes, comunidad] = await Promise.all([
      db.collection('usuarios').countDocuments({}),
      db.collection('alimentos').countDocuments({}),
      db.collection('favoritos').countDocuments({}),
      db.collection('recetapendientes').countDocuments({}),
      db.collection('recetacomunidads').countDocuments({}),
    ]);

    const spoonacularUntil = getSpoonacularBloqueadoHasta();
    const spoonacularBloqueado = isSpoonacularBloqueado();
    
    // Miramos cuantas keys de Gemini tenemos configuradas
    const geminiKeys = String(process.env.GEMINI_API_KEYS || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean).length;
      
    const ajustes = await getAppSettings();

    return res.status(200).json({
      usuario_admin: {
        id: req.user.id,
        email: req.user.email,
        rol: req.user.rol,
      },
      alertas: {
        spoonacular: {
          bloqueado: spoonacularBloqueado,
          disponible_desde: spoonacularUntil ? new Date(spoonacularUntil).toISOString() : null,
        },
        gemini: {
          keys_configuradas: geminiKeys > 0 ? geminiKeys : (process.env.GEMINI_API_KEY ? 1 : 0),
        },
      },
      metricas: {
        usuarios,
        alimentos,
        favoritos,
        pendientes,
        recetas_comunidad: comunidad,
      },
      ajustes,
    });
  } catch (error) {
    console.error('Error cargando el dashboard admin:', error);
    return res.status(500).json({ mensaje: 'No se pudo cargar el panel de administracion' });
  }
});

// Leer los ajustes configurables (limites de recetas, etc)
router.get('/settings', async (req, res) => {
  try {
    const ajustes = await getAppSettings();
    return res.status(200).json({ ajustes });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al leer los ajustes' });
  }
});

// Actualizar los ajustes desde el panel
router.put('/settings', async (req, res) => {
  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const ajustes = await updateAppSettings(body);
    return res.status(200).json({ ajustes, mensaje: 'Ajustes actualizados correctamente.' });
  } catch (error) {
    return res.status(500).json({ mensaje: 'No se han podido guardar los cambios en los ajustes' });
  }
});

// Diagnostico para ver si las colecciones e indices estan bien
router.get('/diagnostics', async (req, res) => {
  try {
    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const colNames = collections.map((c) => c.name);

    const diagnostics = {};

    const inspect = async (name) => {
      try {
        const coll = db.collection(name);
        const count = await coll.countDocuments();
        const indexes = await coll.indexes();
        diagnostics[name] = { count, indexes };
      } catch (e) {
        diagnostics[name] = { error: String(e) };
      }
    };

    const targets = ['usuarios', 'alimentos', 'favoritos', 'recetapendientes', 'recetacomunidads'];
    await Promise.all(targets.filter((t) => colNames.includes(t)).map((t) => inspect(t)));

    return res.status(200).json({ collections: colNames, diagnostics });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al realizar el diagnostico de la BD' });
  }
});

module.exports = router;
