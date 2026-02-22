const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { OAuth2Client } = require('google-auth-library');
const Usuario = require('../models/Usuario');
const requireAuth = require('../middleware/requireAuth');
const { rolDefinidoPorEmail, normalizarEmail } = require('../utils/roles');
const { crearToken } = require('../utils/jwt');

const router = express.Router();
const googleClient = new OAuth2Client();

router.post('/register', async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || '').trim();
    const email = normalizarEmail(req.body?.email || '');
    const password = String(req.body?.password || '');

    if (!nombre || !email || !password) {
      return res.status(400).json({ mensaje: 'Vaya, faltan campos obligatorios' });
    }

    if (nombre.length > 70 || email.length > 100) {
      return res.status(400).json({ mensaje: 'Nombre o email demasiado largos' });
    }

    if (password.length < 6) {
      return res.status(400).json({ mensaje: 'La contraseña es muy corta (min. 6 caracteres)' });
    }

    // Comprobamos email repetido
    const existente = await Usuario.findOne({ email });
    if (existente) {
      return res.status(409).json({ mensaje: 'Este email ya esta en uso' });
    }

    // Guardamos password con hash
    const password_hash = await bcrypt.hash(password, 10);
    const rol = rolDefinidoPorEmail(email);
    const usuario = await Usuario.create({ nombre, email, password_hash, rol });

    const token = crearToken(usuario);
    return res.status(201).json({
      token,
      user: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error('Error en el registro:', error);
    return res.status(500).json({ mensaje: 'No se ha podido crear el usuario' });
  }
});

// Login con email y password
router.post('/login', async (req, res) => {
  try {
    const email = normalizarEmail(req.body?.email || '');
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ mensaje: 'Falta el email o la contraseña' });
    }

    const usuario = await Usuario.findOne({ email });
    if (!usuario) {
      return res.status(401).json({ mensaje: 'Email o contraseña incorrectos' });
    }

    // Comparamos password con el hash
    const ok = await bcrypt.compare(password, usuario.password_hash);
    if (!ok) {
      return res.status(401).json({ mensaje: 'Email o contraseña incorrectos' });
    }

    // Ajustamos el rol si hace falta
    const rolEsperado = rolDefinidoPorEmail(email);
    if ((usuario.rol || 'usuario') !== rolEsperado) {
      usuario.rol = rolEsperado;
      await usuario.save();
    }

    const token = crearToken(usuario);
    return res.status(200).json({
      token,
      user: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (err) {
    console.error('Error en el login:', err);
    return res.status(500).json({ mensaje: 'Error al intentar entrar' });
  }
});

// Login con Google
router.post('/google', async (req, res) => {
  try {
    const credential = String(req.body?.credential || '').trim();
    if (!credential) {
      return res.status(400).json({ mensaje: 'Falta el token de Google' });
    }

    const clientId = String(process.env.GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
      return res.status(503).json({ mensaje: 'Google Sign-In no configurado en el servidor' });
    }

    // Validamos el token de Google
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId,
    });

    const payload = ticket.getPayload() || {};
    const email = normalizarEmail(payload.email || '');
    const nombre = String(payload.name || '').trim();
    const emailVerified = Boolean(payload.email_verified);

    if (!email || !emailVerified) {
      return res.status(401).json({ mensaje: 'Email de Google no verificado' });
    }

    let usuario = await Usuario.findOne({ email });
    if (!usuario) {
      // Si no existe, lo creamos
      const rol = rolDefinidoPorEmail(email);
      const randomPassword = crypto.randomBytes(24).toString('hex');
      const password_hash = await bcrypt.hash(randomPassword, 10);
      usuario = await Usuario.create({
        nombre: nombre || email.split('@')[0],
        email,
        password_hash,
        rol,
      });
    }

    const rolEsperado = rolDefinidoPorEmail(email);
    const nombreGoogle = nombre || usuario.nombre;
    let requiereGuardar = false;

    if ((usuario.rol || 'usuario') !== rolEsperado) {
      usuario.rol = rolEsperado;
      requiereGuardar = true;
    }

    if (nombreGoogle && usuario.nombre !== nombreGoogle) {
      usuario.nombre = nombreGoogle;
      requiereGuardar = true;
    }

    if (requiereGuardar) {
      await usuario.save();
    }

    const token = crearToken(usuario);
    return res.status(200).json({
      token,
      user: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
    });
  } catch (error) {
    console.error('Error con Google Auth:', error);
    return res.status(401).json({ mensaje: 'No hemos podido validar tu cuenta de Google' });
  }
});

// Endpoint para que el front recupere sus datos si tiene el token
router.get('/me', requireAuth, async (req, res) => {
  try {
    const usuario = await Usuario.findById(req.user.id).lean();
    if (!usuario) {
      return res.status(401).json({ mensaje: 'Sesion no encontrada' });
    }
    return res.status(200).json({
      user: {
        id: String(usuario._id),
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol || 'usuario',
      },
    });
  } catch (err) {
    return res.status(500).json({ mensaje: 'Error al leer los datos de tu sesion' });
  }
});

module.exports = router;
