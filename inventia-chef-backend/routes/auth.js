const express = require('express');
const mongoose = require('mongoose');
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
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        mensaje: 'La base de datos (MongoDB) no está conectada en el servidor. Revisa MONGODB_URI y el acceso de red (0.0.0.0/0) en MongoDB Atlas.',
      });
    }

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
    if (String(error?.message || '').includes('JWT_SECRET')) {
      return res.status(500).json({ mensaje: 'Error de configuración: JWT_SECRET no está definido en el servidor.' });
    }
    return res.status(500).json({ mensaje: error?.message || 'No se ha podido crear el usuario' });
  }
});

// Importar modelos necesarios para el usuario demo
const Alimento = require('../models/Alimento');
const RecetaPendiente = require('../models/RecetaPendiente');
const Favorito = require('../models/Favorito');

async function asegurarUsuarioDemo() {
  const email = 'demo@inventia.com';
  let usuario = await Usuario.findOne({ email });
  const hash = await bcrypt.hash('demo1234', 10);

  if (!usuario) {
    usuario = await Usuario.create({
      nombre: 'Chef Carlos Demo',
      email,
      password_hash: hash,
      rol: 'usuario',
      biografia: 'Chef de pruebas de InventIA. Despensa activa con ingredientes frescos, alertas urgentes y recetas planificadas.',
    });
  } else {
    usuario.password_hash = hash;
    if (!usuario.nombre || usuario.nombre === 'Usuario') {
      usuario.nombre = 'Chef Carlos Demo';
    }
    await usuario.save();
  }

  const userId = usuario._id;
  const countAlimentos = await Alimento.countDocuments({ user_id: userId });

  // Si tiene menos de 10 alimentos, renovamos la despensa para asegurar la experiencia completa
  if (countAlimentos < 10) {
    await Alimento.deleteMany({ user_id: userId });

    const hoy = new Date();
    const sumDias = (d) => new Date(hoy.getTime() + d * 24 * 60 * 60 * 1000);

    const alimentos = [
      {
        user_id: userId,
        nombre: 'Salmón fresco del Cantábrico',
        categoria: 'Pescados',
        cantidad: 450,
        unidad_medida: 'Gramos',
        fecha_caducidad: sumDias(1),
        estado_alerta: 'Urgente',
        metodo_ingreso: 'Manual',
      },
      {
        user_id: userId,
        nombre: 'Boletus silvestres seleccionados',
        categoria: 'Verduras',
        cantidad: 300,
        unidad_medida: 'Gramos',
        fecha_caducidad: sumDias(1),
        estado_alerta: 'Urgente',
        metodo_ingreso: 'Manual',
      },
      {
        user_id: userId,
        nombre: 'Tomates maduros en rama',
        categoria: 'Verduras',
        cantidad: 6,
        unidad_medida: 'Unidades',
        fecha_caducidad: sumDias(2),
        estado_alerta: 'Urgente',
        metodo_ingreso: 'Manual',
      },
      {
        user_id: userId,
        nombre: 'Leche entera fresca de granja',
        categoria: 'Lácteos',
        cantidad: 1,
        unidad_medida: 'Litros',
        fecha_caducidad: sumDias(2),
        estado_alerta: 'Urgente',
        metodo_ingreso: 'Manual',
      },
      {
        user_id: userId,
        nombre: 'Nata fresca para cocina (35% MG)',
        categoria: 'Lácteos',
        cantidad: 250,
        unidad_medida: 'Mililitros',
        fecha_caducidad: sumDias(3),
        estado_alerta: 'Urgente',
        metodo_ingreso: 'Manual',
      },
      {
        user_id: userId,
        nombre: 'Aguacates Hass al punto',
        categoria: 'Frutas',
        cantidad: 2,
        unidad_medida: 'Unidades',
        fecha_caducidad: sumDias(3),
        estado_alerta: 'Urgente',
        metodo_ingreso: 'Manual',
      },
      {
        user_id: userId,
        nombre: 'Pechuga de pollo de corral',
        categoria: 'Carnes',
        cantidad: 600,
        unidad_medida: 'Gramos',
        fecha_caducidad: sumDias(5),
        estado_alerta: 'Ok',
        metodo_ingreso: 'Manual',
      },
      {
        user_id: userId,
        nombre: 'Queso Parmigiano Reggiano 24 meses',
        categoria: 'Lácteos',
        cantidad: 250,
        unidad_medida: 'Gramos',
        fecha_caducidad: sumDias(28),
        estado_alerta: 'Ok',
        metodo_ingreso: 'Manual',
      },
      {
        user_id: userId,
        nombre: 'Pasta Tagliatelle artesana al huevo',
        categoria: 'Despensa',
        cantidad: 500,
        unidad_medida: 'Gramos',
        fecha_caducidad: sumDias(90),
        estado_alerta: 'Ok',
        metodo_ingreso: 'Manual',
      },
      {
        user_id: userId,
        nombre: 'Arroz Carnaroli Superfino Risotto',
        categoria: 'Despensa',
        cantidad: 1000,
        unidad_medida: 'Gramos',
        fecha_caducidad: sumDias(120),
        estado_alerta: 'Ok',
        metodo_ingreso: 'Manual',
      },
      {
        user_id: userId,
        nombre: 'Huevos camperos clase 0 (Docena)',
        categoria: 'Fresco',
        cantidad: 12,
        unidad_medida: 'Unidades',
        fecha_caducidad: sumDias(14),
        estado_alerta: 'Ok',
        metodo_ingreso: 'Manual',
      },
      {
        user_id: userId,
        nombre: 'Aceite de Oliva Virgen Extra Picual',
        categoria: 'Despensa',
        cantidad: 1,
        unidad_medida: 'Litros',
        fecha_caducidad: sumDias(240),
        estado_alerta: 'Ok',
        metodo_ingreso: 'Manual',
      },
      {
        user_id: userId,
        nombre: 'Ajo morado de Las Pedroñeras',
        categoria: 'Verduras',
        cantidad: 5,
        unidad_medida: 'Unidades',
        fecha_caducidad: sumDias(30),
        estado_alerta: 'Ok',
        metodo_ingreso: 'Manual',
      },
      {
        user_id: userId,
        nombre: 'Cebolla dulce de Fuentes de Ebro',
        categoria: 'Verduras',
        cantidad: 3,
        unidad_medida: 'Unidades',
        fecha_caducidad: sumDias(20),
        estado_alerta: 'Ok',
        metodo_ingreso: 'Manual',
      },
      {
        user_id: userId,
        nombre: 'Mantequilla tradicional asturiana',
        categoria: 'Lácteos',
        cantidad: 250,
        unidad_medida: 'Gramos',
        fecha_caducidad: sumDias(22),
        estado_alerta: 'Ok',
        metodo_ingreso: 'Manual',
      },
      {
        user_id: userId,
        nombre: 'Chocolate negro 85% Santo Tomé',
        categoria: 'Despensa',
        cantidad: 200,
        unidad_medida: 'Gramos',
        fecha_caducidad: sumDias(180),
        estado_alerta: 'Ok',
        metodo_ingreso: 'Manual',
      },
    ];

    await Alimento.insertMany(alimentos);
  }

  // Comprobar favoritos demo
  const countFavs = await Favorito.countDocuments({ user_id: userId });
  if (countFavs === 0) {
    await Favorito.insertMany([
      {
        user_id: userId,
        id_externo: 'demo-fav-risotto',
        title: 'Risotto Cremoso de Boletus y Parmesano Reggiano',
        image: 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=600&auto=format&fit=crop&q=80',
        readyInMinutes: 28,
        servings: 2,
        tipo: 'IA',
        extendedIngredients: [
          { name: 'Arroz Carnaroli', original: '200g Arroz Carnaroli', amount: 200, unit: 'g' },
          { name: 'Boletus', original: '250g Boletus frescos', amount: 250, unit: 'g' },
          { name: 'Parmesano', original: '60g Queso Parmesano', amount: 60, unit: 'g' },
          { name: 'Cebolla', original: '1 cebolla dulce', amount: 1, unit: 'unidad' },
          { name: 'Mantequilla', original: '35g Mantequilla', amount: 35, unit: 'g' },
          { name: 'Aceite AOVE', original: '2 cucharadas AOVE', amount: 2, unit: 'cucharadas' },
        ],
        analyzedInstructions: [
          {
            steps: [
              { number: 1, step: 'Pica finamente la cebolla dulce y sofríela a fuego medio en AOVE.' },
              { number: 2, step: 'Limpia los boletus con un paño húmedo, trocéalos y saltéalos con la cebolla dorada.' },
              { number: 3, step: 'Incorpora el arroz carnaroli y nacáralo 2 minutos hasta que brille.' },
              { number: 4, step: 'Añade caldo caliente cazo a cazo removiendo de forma envolvente durante 16 minutos.' },
              { number: 5, step: 'Retira del fuego y realiza la mantecatura con mantequilla fría y abundante parmesano.' },
            ],
          },
        ],
      },
      {
        user_id: userId,
        id_externo: 'demo-fav-salmon',
        title: 'Lomos de Salmón al Horno con Costra de Tomate y Ajo',
        image: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600&auto=format&fit=crop&q=80',
        readyInMinutes: 18,
        servings: 2,
        tipo: 'IA',
        extendedIngredients: [
          { name: 'Salmón fresco', original: '2 lomos de salmón (400g)', amount: 400, unit: 'g' },
          { name: 'Tomates pera', original: '3 tomates picados en concassé', amount: 3, unit: 'unidades' },
          { name: 'Ajo', original: '2 dientes de ajo picados', amount: 2, unit: 'dientes' },
          { name: 'Aceite AOVE', original: '20ml Aceite virgen extra', amount: 20, unit: 'ml' },
        ],
        analyzedInstructions: [
          {
            steps: [
              { number: 1, step: 'Precalienta el horno a 200°C con calor arriba y abajo.' },
              { number: 2, step: 'Marca los lomos en sartén caliente por la piel 2 minutos para conseguir un punto crujiente.' },
              { number: 3, step: 'Corona los lomos con el picadillo de tomate maduro, ajo y AOVE.' },
              { number: 4, step: 'Hornea 7-8 minutos hasta obtener un centro rosado y fundente.' },
            ],
          },
        ],
      },
    ]);
  }

  // Comprobar recetas planificadas demo
  const countPendientes = await RecetaPendiente.countDocuments({ user_id: userId });
  if (countPendientes === 0) {
    await RecetaPendiente.insertMany([
      {
        user_id: userId,
        id_externo: 'demo-plan-pasta',
        title: 'Tagliatelle Frescos al Huevo con Crema de Parmesano',
        image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=600&auto=format&fit=crop&q=80',
        readyInMinutes: 15,
        servings: 2,
        tipo: 'IA',
        fecha_planificada: new Date(),
        extendedIngredients: [
          { name: 'Pasta Tagliatelle', original: '250g Tagliatelle', amount: 250, unit: 'g' },
          { name: 'Nata fresca', original: '150ml Nata para cocinar', amount: 150, unit: 'ml' },
          { name: 'Queso Parmigiano', original: '70g Queso rallado fino', amount: 70, unit: 'g' },
          { name: 'Pimienta negra', original: 'Pimienta de molinillo al gusto', amount: 1, unit: 'pizca' },
        ],
        analyzedInstructions: [
          {
            steps: [
              { number: 1, step: 'Cuece los tagliatelle en abundante agua hirviendo con sal durante 3 minutos.' },
              { number: 2, step: 'En una sartén amplia reduce la nata a fuego suave y disuelve el parmesano.' },
              { number: 3, step: 'Pasa la pasta con un chorrito de su agua de cocción a la salsa y emulsiona intensamente.' },
            ],
          },
        ],
      },
      {
        user_id: userId,
        id_externo: 'demo-plan-pollo',
        title: 'Pechuga de Pollo Dorada con Reducción de Ajo y Limón',
        image: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=600&auto=format&fit=crop&q=80',
        readyInMinutes: 20,
        servings: 2,
        tipo: 'IA',
        fecha_planificada: new Date(Date.now() + 86400000),
        extendedIngredients: [
          { name: 'Pechuga de pollo', original: '500g Pechuga en filetes gruesos', amount: 500, unit: 'g' },
          { name: 'Ajo', original: '3 dientes de ajo laminados', amount: 3, unit: 'dientes' },
          { name: 'Aceite AOVE', original: '2 cucharadas AOVE', amount: 2, unit: 'cucharadas' },
        ],
        analyzedInstructions: [
          {
            steps: [
              { number: 1, step: 'Dora los filetes de pechuga a fuego vivo en AOVE 3 minutos por cada lado.' },
              { number: 2, step: 'Añade los ajos laminados al final para que no se quemen y perfumen la carne.' },
              { number: 3, step: 'Deja reposar 2 minutos antes de cortar y emplatar.' },
            ],
          },
        ],
      },
    ]);
  }

  return usuario;
}

// Endpoint directo de acceso demo (1 clic)
router.post('/demo-login', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        mensaje: 'La base de datos (MongoDB) no está conectada en el servidor.',
      });
    }

    const usuario = await asegurarUsuarioDemo();
    const token = crearToken(usuario);

    return res.status(200).json({
      token,
      user: {
        id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
      },
      mensaje: 'Acceso demo concedido con éxito. ¡Bienvenido, Chef Demo!',
    });
  } catch (err) {
    console.error('Error en demo-login:', err);
    return res.status(500).json({ mensaje: err?.message || 'Error al iniciar sesión de prueba' });
  }
});

// Login con email y password
router.post('/login', async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        mensaje: 'La base de datos (MongoDB) no está conectada en el servidor. Revisa MONGODB_URI y el acceso de red (0.0.0.0/0) en MongoDB Atlas.',
      });
    }

    const email = normalizarEmail(req.body?.email || '');
    const password = String(req.body?.password || '');

    if (!email || !password) {
      return res.status(400).json({ mensaje: 'Falta el email o la contraseña' });
    }

    // Si es el usuario demo oficial y la contraseña coincide, garantizamos su inicialización
    if (email === 'demo@inventia.com' && password === 'demo1234') {
      const demoUser = await asegurarUsuarioDemo();
      const token = crearToken(demoUser);
      return res.status(200).json({
        token,
        user: {
          id: demoUser._id,
          nombre: demoUser.nombre,
          email: demoUser.email,
          rol: demoUser.rol,
        },
      });
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
    if (String(err?.message || '').includes('JWT_SECRET')) {
      return res.status(500).json({ mensaje: 'Error de configuración: JWT_SECRET no está definido en el servidor.' });
    }
    return res.status(500).json({ mensaje: err?.message || 'Error al intentar entrar' });
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
