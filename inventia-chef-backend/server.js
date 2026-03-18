const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middlewares basicos
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Conexion a MongoDB
const uri = process.env.MONGODB_URI;
mongoose
  .connect(uri)
  .then(() => console.log('Base de datos conectada: OK'))
  .catch((err) => console.error('Error al conectar con la BD:', err));

// Ruta principal
app.get('/', (req, res) => {
  res.send('Servidor de InventIA Chef funcionando correctamente');
});

// Rutas de la app
const rutasAlimentos = require('./routes/alimentos');
app.use('/api/alimentos', rutasAlimentos);

const rutasCatalogo = require('./routes/catalogo');
app.use('/api/catalogo', rutasCatalogo);

const rutasRecetas = require('./routes/recetas');
app.use('/api/recetas', rutasRecetas);

const rutasRecetasIA = require('./routes/recetasIA');
app.use('/api/recetas-ia', rutasRecetasIA);

const rutasAuth = require('./routes/auth');
app.use('/api/auth', rutasAuth);

const rutasAdmin = require('./routes/admin');
app.use('/api/admin', rutasAdmin);

const rutasPerfil = require('./routes/perfil');
app.use('/api/perfil', rutasPerfil);

const rutasFavoritos = require('./routes/favoritos');
app.use('/api/favoritos', rutasFavoritos);

const rutasHistorial = require('./routes/historial');
app.use('/api/historial', rutasHistorial);

const rutasRecetasPendientes = require('./routes/recetasPendientes');
app.use('/api/recetas-pendientes', rutasRecetasPendientes);

const rutasCompraInteligente = require('./routes/compraInteligente');
app.use('/api/compra-inteligente', rutasCompraInteligente);

const rutasRecetasComunidadGestion = require('./routes/recetasComunidadGestion');
app.use('/api/recetas-comunidad/gestionar', rutasRecetasComunidadGestion);

const rutasRecetasComunidad = require('./routes/recetasComunidad');
app.use('/api/recetas-comunidad', rutasRecetasComunidad);

// Servir frontend en produccion
if (process.env.SERVIR_FRONTEND === '1') {
  const dist = path.resolve(
    process.env.FRONTEND_DIST || path.join(__dirname, '../inventia-chef-frontend/dist')
  );
  if (fs.existsSync(dist)) {
    app.use(express.static(dist));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) {
        return next();
      }
      res.sendFile(path.join(dist, 'index.html'));
    });
  } else {
    console.warn('Advertencia: SERVIR_FRONTEND=1 pero no existe la carpeta dist:', dist);
  }
}

// Arranque del servidor
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
}

module.exports = app;
