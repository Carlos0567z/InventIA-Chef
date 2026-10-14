const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Perfil = require('../models/Perfil');
const Usuario = require('../models/Usuario');
const RecetaComunidad = require('../models/RecetaComunidad');
const requireAuth = require('../middleware/requireAuth');
const {
  buildPasswordLimiterKey,
  getPasswordLimiterStatus,
  registerPasswordLimiterFailure,
  clearPasswordLimiter,
} = require('../services/passwordRateLimiter');
const { writeSecurityAudit } = require('../services/securityAudit');
const { crearToken } = require('../utils/jwt');

const router = express.Router();

router.get('/', requireAuth, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id);
    if (!usuario) {
      return res.status(401).json({
        mensaje: 'Sesion no valida. Por favor, vuelve a entrar.',
      });
    }

    let perfil = await Perfil.findOne({ user_id: req.user.id });

    // Si es la primera vez que entra a su perfil, le creamos uno vacio
    if (!perfil) {
      perfil = await Perfil.create({
        user_id: req.user.id,
        nombre: usuario.nombre || '',
        email: usuario.email || '',
        alergias: [],
      });
    } else {
      // Si el usuario ha cambiado su nombre en la cuenta, lo actualizamos aqui tambien
      const nombreActual = String(usuario.nombre || '');
      const emailActual = String(usuario.email || '');
      if (perfil.nombre !== nombreActual || perfil.email !== emailActual) {
        perfil.nombre = nombreActual;
        perfil.email = emailActual;
        await perfil.save();
      }
    }

    res.status(200).json(perfil);
  } catch (error) {
    console.error('Error al cargar perfil:', error);
    res.status(500).json({ mensaje: 'No se ha podido cargar tu perfil.' });
  }
});

// PUT: Actualizar las alergias del perfil autenticado
router.put('/', requireAuth, async (req, res) => {
  try {
    const alergias = Array.isArray(req.body?.alergias) ? req.body.alergias : [];

    let perfil = await Perfil.findOne({ user_id: req.user.id });
    if (!perfil) {
      perfil = await Perfil.create({
        user_id: req.user.id,
        nombre: req.user.nombre || '',
        email: req.user.email || '',
        alergias,
      });
      return res.status(200).json(perfil);
    }

    perfil.alergias = alergias;
    await perfil.save();

    res.status(200).json(perfil);
  } catch (error) {
    res.status(500).json({ mensaje: 'Error al actualizar el perfil' });
  }
});

// PUT: Actualizar el nombre del usuario y su imagen
router.put('/account', requireAuth, async (req, res) => {
  try {
    const { nombre, imagen_perfil, imagen_banner, biografia } = req.body;
    const nombreTrim = String(nombre || '').trim();
    
    if (!nombreTrim) {
      return res.status(400).json({ mensaje: 'Tienes que poner un nombre' });
    }
    if (nombreTrim.length > 70) {
      return res.status(400).json({ mensaje: 'El nombre es demasiado largo (max. 70)' });
    }

    // Validacion de biografia
    const bioTrim = String(biografia || '').trim();
    if (bioTrim.length > 300) {
      return res.status(400).json({ mensaje: 'La biografía es demasiado larga (max. 300 caracteres)' });
    }

    // Validacion de peso de imagenes para no llenar la base de datos (Max ~1MB por string)
    const MAX_SIZE = 1024 * 1024; 
    if (imagen_perfil && imagen_perfil.length > MAX_SIZE) {
      return res.status(400).json({ mensaje: 'La foto de perfil es demasiado pesada. Prueba a subir una mas pequeña.' });
    }
    if (imagen_banner && imagen_banner.length > MAX_SIZE) {
      return res.status(400).json({ mensaje: 'El banner es demasiado pesado. Prueba a subir uno mas pequeño.' });
    }

    const usuario = await Usuario.findById(req.user.id);
    if (!usuario) {
      return res.status(401).json({
        mensaje: 'Error de autenticacion.',
      });
    }

    usuario.nombre = nombreTrim;
    usuario.biografia = bioTrim;
    await usuario.save();

    let perfil = await Perfil.findOne({ user_id: req.user.id });
    if (!perfil) {
      perfil = await Perfil.create({
        user_id: req.user.id,
        nombre: usuario.nombre,
        email: usuario.email,
        alergias: [],
        imagen_perfil: imagen_perfil || '',
        imagen_banner: imagen_banner || '',
        biografia: bioTrim,
      });
    } else {
      perfil.nombre = usuario.nombre;
      perfil.email = usuario.email;
      perfil.biografia = bioTrim;
      if (imagen_perfil !== undefined) perfil.imagen_perfil = imagen_perfil;
      if (imagen_banner !== undefined) perfil.imagen_banner = imagen_banner;
      await perfil.save();
    }

    const token = crearToken(usuario);

    res.status(200).json({
      mensaje: '¡Datos guardados!',
      token,
      user: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
      perfil,
    });
  } catch (error) {
    console.error('Error al guardar datos de cuenta:', error);
    return res.status(500).json({ mensaje: 'No se han podido guardar los cambios.' });
  }
});

// PUT: Cambiar contraseña del usuario autenticado
router.put('/password', requireAuth, async (req, res) => {
  try {
    const password_actual = String(req.body?.password_actual || '');
    const password_nueva = String(req.body?.password_nueva || '');
    const sourceIp = String(req.headers['x-forwarded-for'] || req.ip || 'unknown');
    const limiterKey = buildPasswordLimiterKey(req.user.id, req.headers['x-forwarded-for'] || req.ip);
    const limiterStatus = await getPasswordLimiterStatus(limiterKey);

    if (limiterStatus.blocked) {
      await writeSecurityAudit('password_change_blocked', {
        user_id: req.user.id,
        email: req.user.email,
        ip: sourceIp,
        retry_after_segundos: limiterStatus.retryAfterSeconds,
      });
      return res.status(429).json({
        mensaje: 'Demasiados intentos de cambio de password. Intenta de nuevo mas tarde.',
        retry_after_segundos: limiterStatus.retryAfterSeconds,
      });
    }

    if (!password_actual || !password_nueva) {
      return res.status(400).json({ mensaje: 'Password actual y nueva son obligatorias' });
    }

    if (password_nueva.length < 6) {
      return res.status(400).json({ mensaje: 'La nueva password debe tener al menos 6 caracteres' });
    }

    const usuario = await Usuario.findById(req.user.id);
    if (!usuario) {
      return res.status(401).json({
        mensaje: 'Tu usuario no esta en la base de datos. Cierra sesion y entra de nuevo.',
      });
    }

    const ok = await bcrypt.compare(password_actual, usuario.password_hash);
    if (!ok) {
      const failure = await registerPasswordLimiterFailure(limiterKey);

      if (failure.locked) {
        await writeSecurityAudit('password_change_locked', {
          user_id: req.user.id,
          email: req.user.email,
          ip: sourceIp,
          retry_after_segundos: failure.retryAfterSeconds,
        });
        return res.status(429).json({
          mensaje: 'Demasiados intentos de cambio de password. Intenta de nuevo mas tarde.',
          retry_after_segundos: failure.retryAfterSeconds,
        });
      }

      await writeSecurityAudit('password_change_invalid_current_password', {
        user_id: req.user.id,
        email: req.user.email,
        ip: sourceIp,
        intentos_restantes: failure.attemptsRemaining,
      });

      return res.status(401).json({
        mensaje: 'La password actual no es valida',
        intentos_restantes: failure.attemptsRemaining,
      });
    }

    const mismaPassword = await bcrypt.compare(password_nueva, usuario.password_hash);
    if (mismaPassword) {
      await writeSecurityAudit('password_change_reused_password', {
        user_id: req.user.id,
        email: req.user.email,
        ip: sourceIp,
      });
      return res.status(400).json({ mensaje: 'La nueva password debe ser distinta a la actual' });
    }

    usuario.password_hash = await bcrypt.hash(password_nueva, 10);
    await usuario.save();
    await clearPasswordLimiter(limiterKey);

    await writeSecurityAudit('password_change_success', {
      user_id: req.user.id,
      email: req.user.email,
      ip: sourceIp,
    });

    const token = crearToken(usuario);

    return res.status(200).json({
      mensaje: 'Password actualizada',
      token,
      user: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    return res.status(500).json({ mensaje: 'Error al actualizar la password' });
  }
});

// -------------------------------------------------------------
// GET /cocinero/:id — Perfil publico del cocinero
// -------------------------------------------------------------
router.get('/cocinero/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let usuario = null;

    if (mongoose.isValidObjectId(id)) {
      usuario = await Usuario.findById(id).select('nombre biografia rol fecha_registro').lean();
    }
    if (!usuario) {
      // Intento buscar por nombre si no fue objectId
      usuario = await Usuario.findOne({ nombre: id }).select('nombre biografia rol fecha_registro').lean();
    }
    if (!usuario) {
      return res.status(404).json({ mensaje: 'Cocinero no encontrado' });
    }

    const perfil = await Perfil.findOne({ user_id: String(usuario._id) })
      .select('imagen_perfil imagen_banner biografia nombre')
      .lean();

    // Calcular metricas de comunidad
    const userObjectId = new mongoose.Types.ObjectId(String(usuario._id));
    const [recetasCount, agregadosLikes, agregadosRatings] = await Promise.all([
      RecetaComunidad.countDocuments({ autor_id: userObjectId, estado: 'publicada' }),
      RecetaComunidad.aggregate([
        { $match: { autor_id: userObjectId, estado: 'publicada' } },
        { $group: { _id: null, totalLikes: { $sum: '$numero_likes' } } },
      ]),
      RecetaComunidad.aggregate([
        { $match: { autor_id: userObjectId, estado: 'publicada', puntuacion_media: { $gt: 0 } } },
        { $group: { _id: null, avgRating: { $avg: '$puntuacion_media' } } },
      ]),
    ]);

    const totalLikes = agregadosLikes[0]?.totalLikes || 0;
    const mediaRating = agregadosRatings[0]?.avgRating
      ? Math.round(agregadosRatings[0].avgRating * 10) / 10
      : 0;

    // Calcular insignias sociales
    const insignias = [];
    if (usuario.rol === 'admin') {
      insignias.push({ id: 'admin', nombre: 'Administrador / Chef Ejecutivo', icono: 'crown' });
    }
    if (recetasCount >= 1) {
      insignias.push({ id: 'creador', nombre: 'Chef Creador', icono: 'utensils' });
    }
    if (recetasCount >= 3) {
      insignias.push({ id: 'maestro', nombre: 'Maestro Culinario', icono: 'award' });
    }
    if (totalLikes >= 5) {
      insignias.push({ id: 'popular', nombre: 'Estrella Comunitaria', icono: 'heart' });
    }
    if (mediaRating >= 4.0 && recetasCount >= 1) {
      insignias.push({ id: 'alta_calidad', nombre: 'Sabor 5 Estrellas', icono: 'star' });
    }

    res.status(200).json({
      cocinero: {
        id: usuario._id,
        nombre: perfil?.nombre || usuario.nombre,
        imagen_perfil: perfil?.imagen_perfil || '',
        imagen_banner: perfil?.imagen_banner || '',
        biografia: perfil?.biografia || usuario.biografia || '',
        fecha_registro: usuario.fecha_registro,
        rol: usuario.rol || 'usuario',
      },
      metricas: {
        recetas_count: recetasCount,
        likes_totales: totalLikes,
        puntuacion_media: mediaRating,
      },
      insignias,
    });
  } catch (error) {
    console.error('Error al obtener perfil de cocinero:', error);
    res.status(500).json({ mensaje: 'Error al cargar perfil de cocinero' });
  }
});

// -------------------------------------------------------------
// GET /cocinero/:id/recetas — Recetas publicas del cocinero
// -------------------------------------------------------------
router.get('/cocinero/:id/recetas', async (req, res) => {
  try {
    const { id } = req.params;
    let autorId = id;

    if (!mongoose.isValidObjectId(id)) {
      const u = await Usuario.findOne({ nombre: id }).select('_id');
      if (u) autorId = u._id;
      else return res.status(404).json({ mensaje: 'Cocinero no encontrado' });
    }

    const recetas = await RecetaComunidad.find({
      autor_id: autorId,
      estado: 'publicada',
    })
      .sort({ fecha_publicacion: -1 })
      .select('title image description readyInMinutes servings numero_likes puntuacion_media numero_comentarios fecha_publicacion id_externo versiones extendedIngredients')
      .lean();

    res.status(200).json(recetas);
  } catch (error) {
    console.error('Error al obtener recetas del cocinero:', error);
    res.status(500).json({ mensaje: 'Error al listar recetas del cocinero' });
  }
});

module.exports = router;

