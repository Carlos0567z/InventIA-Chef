const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongoServer.getUri();
  process.env.JWT_SECRET = 'test-jwt-secret';
  app = require('../server');
  await mongoose.connection.asPromise();
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

// Funciones auxiliares para los tests
async function register(prefix) {
  const email = `${prefix.toLowerCase()}${Math.floor(Math.random() * 100000)}@inventia.local`;
  const r = await request(app).post('/api/auth/register').send({ nombre: prefix, email, password: 'secreto123' });
  assert.equal(r.status, 201, `Registro falló para ${prefix}`);
  return { email, token: r.body.token, user: r.body.user };
}

function hdr(token) {
  return { Authorization: `Bearer ${token}` };
}

test('arranque: servidor responde en raíz', async () => {
  const r = await request(app).get('/');
  assert.equal(r.status, 200);
});

test('auth: registro de usuario nuevo', async () => {
  const r = await request(app).post('/api/auth/register').send({
    nombre: 'RegistroTest',
    email: `reg${Date.now()}@inventia.local`,
    password: 'secreto123',
  });
  assert.equal(r.status, 201);
  assert.ok(r.body.token);
  assert.ok(r.body.user);
});

test('auth: login con usuario registrado', async () => {
  const { email } = await register('LoginTest');
  const r = await request(app).post('/api/auth/login').send({ email, password: 'secreto123' });
  assert.equal(r.status, 200);
  assert.ok(r.body.token);
  assert.ok(r.body.user);
});

test('auth: recarga del navegador mantiene sesión (token válido)', async () => {
  const { token } = await register('ReloadTest');
  const r = await request(app).get('/api/auth/me').set(hdr(token));
  assert.equal(r.status, 200);
  assert.ok(r.body.user);
});

test('auth: login falla con password incorrecto', async () => {
  const { email } = await register('BadPwdTest');
  const r = await request(app).post('/api/auth/login').send({ email, password: 'incorrecto' });
  assert.equal(r.status, 401);
});

test('despensa: añadir alimentos manualmente', async () => {
  const { token } = await register('DespensaAdd');
  const r1 = await request(app).post('/api/alimentos').set(hdr(token)).send({
    nombre: 'Manzana',
    categoria: 'Fruta',
    cantidad: 2,
    unidad_medida: 'Unidades',
    metodo_ingreso: 'Manual',
  });
  assert.equal(r1.status, 201);
  assert.ok(r1.body._id);

  const r2 = await request(app).post('/api/alimentos').set(hdr(token)).send({
    nombre: 'Pan',
    categoria: 'Pan',
    cantidad: 1,
    unidad_medida: 'Pieza',
    metodo_ingreso: 'Manual',
  });
  assert.equal(r2.status, 201);
});

test('despensa: editar alimento', async () => {
  const { token } = await register('DespensaEdit');
  const add = await request(app).post('/api/alimentos').set(hdr(token)).send({
    nombre: 'Lechuga',
    categoria: 'Verdura',
    cantidad: 1,
    unidad_medida: 'Unidades',
    metodo_ingreso: 'Manual',
  });
  const id = add.body._id;

  const edit = await request(app).put(`/api/alimentos/${id}`).set(hdr(token)).send({ cantidad: 5 });
  assert.equal(edit.status, 200);
  assert.equal(edit.body.cantidad, 5);
});

test('despensa: eliminar alimento', async () => {
  const { token } = await register('DespensaDel');
  const add = await request(app).post('/api/alimentos').set(hdr(token)).send({
    nombre: 'Tomate',
    categoria: 'Verdura',
    cantidad: 3,
    unidad_medida: 'Unidades',
    metodo_ingreso: 'Manual',
  });
  const id = add.body._id;

  const del = await request(app).delete(`/api/alimentos/${id}`).set(hdr(token));
  assert.equal(del.status, 200);

  const inv = await request(app).get('/api/alimentos').set(hdr(token));
  assert.equal(inv.status, 200);
  assert.equal(inv.body.length, 0);
});

test('despensa: recarga página persiste datos', async () => {
  const { token } = await register('DespensaPersist');
  await request(app).post('/api/alimentos').set(hdr(token)).send({
    nombre: 'Huevos',
    categoria: 'Fresco',
    cantidad: 12,
    unidad_medida: 'Unidades',
    metodo_ingreso: 'Manual',
  });

  const r = await request(app).get('/api/alimentos').set(hdr(token));
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].nombre, 'Huevos');
  assert.equal(r.body[0].cantidad, 12);
});

test('compra inteligente: genera lista desde estado actual', async () => {
  const { token } = await register('CompraGen');
  
  // Añadir receta pendiente
  await request(app).post('/api/recetas-pendientes').set(hdr(token)).send({
    id_externo: 'compra-1',
    tipo: 'com',
    title: 'Pasta',
    extendedIngredients: [{ name: 'Pasta', original: '500g' }, { name: 'Tomate', original: '1 lata' }],
  });

  const r = await request(app).post('/api/compra-inteligente/generar').set(hdr(token)).send({});
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.lista));
  assert.ok(r.body.ticketId);
});

test('historial: registra acciones recientes', async () => {
  const { token } = await register('HistorialReg');

  await request(app).post('/api/historial').set(hdr(token)).send({
    titulo: 'Compra 1',
    tipo: 'compra',
    origen: 'manual',
    articulos: [{ nombre: 'Arroz', cantidad: '1 kg', precio: 2 }],
    total: 2,
  });

  const r = await request(app).get('/api/historial').set(hdr(token));
  assert.equal(r.status, 200);
  assert.equal(r.body.length, 1);
  assert.equal(r.body[0].titulo, 'Compra 1');
});

test('historial: orden temporal (más reciente primero)', async () => {
  const { token } = await register('HistorialOrd');

  const h1 = await request(app).post('/api/historial').set(hdr(token)).send({
    titulo: 'Compra 1',
    tipo: 'compra',
    origen: 'manual',
    articulos: [],
    total: 1,
  });

  const h2 = await request(app).post('/api/historial').set(hdr(token)).send({
    titulo: 'Compra 2',
    tipo: 'compra',
    origen: 'manual',
    articulos: [],
    total: 2,
  });

  const r = await request(app).get('/api/historial').set(hdr(token));
  assert.equal(r.status, 200);
  assert.equal(r.body[0]._id.toString(), h2.body._id.toString());
  assert.equal(r.body[1]._id.toString(), h1.body._id.toString());
});

test('recetas: añadir/quitar de favoritas', async () => {
  const { token } = await register('FavoritasTest');

  const add = await request(app).post('/api/favoritos').set(hdr(token)).send({
    id_externo: 'fav-1',
    tipo: 'com',
    title: 'Receta Favorita',
    image: 'https://example.com/img.jpg',
    readyInMinutes: 20,
    servings: 2,
  });
  assert.equal(add.status, 201);

  const lista = await request(app).get('/api/favoritos').set(hdr(token));
  assert.equal(lista.status, 200);
  assert.equal(lista.body.length, 1);

  const id = add.body._id;
  const del = await request(app).delete(`/api/favoritos/${id}`).set(hdr(token));
  assert.equal(del.status, 200);

  const listaAhora = await request(app).get('/api/favoritos').set(hdr(token));
  assert.equal(listaAhora.body.length, 0);
});

test('recetas: estado favorito consistente', async () => {
  const { token } = await register('FavConsist');

  const r1 = await request(app).post('/api/favoritos').set(hdr(token)).send({
    id_externo: 'fav-const',
    tipo: 'IA',
    title: 'Receta IA',
    image: 'https://example.com/ia.jpg',
    readyInMinutes: 15,
    servings: 1,
  });
  const id = r1.body._id;

  const r2 = await request(app).get('/api/favoritos').set(hdr(token));
  assert.equal(r2.body.some((f) => f._id.toString() === id.toString()), true);

  const r3 = await request(app).get(`/api/favoritos`).set(hdr(token));
  assert.equal(r3.body.some((f) => f._id.toString() === id.toString()), true);
});

test('perfil: editar nombre de cuenta', async () => {
  const { token } = await register('PerfilNombre');

  const r = await request(app).put('/api/perfil/account').set(hdr(token)).send({ nombre: 'Nombre Nuevo' });
  assert.equal(r.status, 200);
  assert.equal(r.body.user.nombre, 'Nombre Nuevo');
});

test('perfil: añadir/editar alergias', async () => {
  const { token } = await register('PerfilAlergias');

  const r = await request(app).put('/api/perfil').set(hdr(token)).send({ alergias: ['Cacahuete', 'Mariscos'] });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.alergias));
  assert.equal(r.body.alergias.length, 2);
});

test('perfil: persistencia tras recarga', async () => {
  const { token } = await register('PerfilPersist');

  const update = await request(app).put('/api/perfil/account').set(hdr(token)).send({ nombre: 'Persistido' });
  assert.equal(update.status, 200);

  const r = await request(app).get('/api/auth/me').set(hdr(update.body.token));
  assert.equal(r.status, 200);
  assert.equal(r.body.user.nombre, 'Persistido');
});

test('errores: campo vacío en formulario', async () => {
  const { token } = await register('ErrorVacio');

  const r = await request(app).post('/api/alimentos').set(hdr(token)).send({
    nombre: '',
    categoria: 'Fruta',
    cantidad: 1,
    unidad_medida: 'Unidades',
    metodo_ingreso: 'Manual',
  });
  assert.equal(r.status, 400);
  assert.ok(r.body.mensaje || r.body.message);
});

test('errores: formato incorrecto (cantidad negativa)', async () => {
  const { token } = await register('ErrorFormato');

  const r = await request(app).post('/api/alimentos').set(hdr(token)).send({
    nombre: 'Item',
    categoria: 'Fruta',
    cantidad: -5,
    unidad_medida: 'Unidades',
    metodo_ingreso: 'Manual',
  });
  // Esperamos al menos status no 201, con mensaje de error
  assert(r.status !== 201 || r.body.cantidad >= 0);
});

test('errores: sin token devuelve 401', async () => {
  const r = await request(app).get('/api/alimentos');
  assert.equal(r.status, 401);
});

test('flujo final: cierra sesión y vuelve a entrar', async () => {
  const { email, token } = await register('FlujoFinal');

  // Añadir datos
  await request(app).post('/api/alimentos').set(hdr(token)).send({
    nombre: 'Final Item',
    categoria: 'Fruta',
    cantidad: 3,
    unidad_medida: 'Unidades',
    metodo_ingreso: 'Manual',
  });

  // segundo login con el mismo usuario
  const newLogin = await request(app).post('/api/auth/login').send({ email, password: 'secreto123' });
  assert.equal(newLogin.status, 200);
  const newToken = newLogin.body.token;

  // Verificar datos persisten
  const inv = await request(app).get('/api/alimentos').set(hdr(newToken));
  assert.equal(inv.status, 200);
  assert.equal(inv.body.length, 1);
  assert.equal(inv.body[0].nombre, 'Final Item');
});

test('flujo final: integridad de datos entre usuarios', async () => {
  const { token: t1 } = await register('FlujoDatos1');
  const { token: t2 } = await register('FlujoDatos2');

  // Usuario 1 añade datos
  await request(app).post('/api/alimentos').set(hdr(t1)).send({
    nombre: 'Item Usuario 1',
    categoria: 'Fruta',
    cantidad: 2,
    unidad_medida: 'Unidades',
    metodo_ingreso: 'Manual',
  });

  // Usuario 2 añade datos
  await request(app).post('/api/alimentos').set(hdr(t2)).send({
    nombre: 'Item Usuario 2',
    categoria: 'Verdura',
    cantidad: 5,
    unidad_medida: 'Unidades',
    metodo_ingreso: 'Manual',
  });

  // Verificar aislamiento
  const inv1 = await request(app).get('/api/alimentos').set(hdr(t1));
  const inv2 = await request(app).get('/api/alimentos').set(hdr(t2));

  assert.equal(inv1.body.length, 1);
  assert.equal(inv2.body.length, 1);
  assert.equal(inv1.body[0].nombre, 'Item Usuario 1');
  assert.equal(inv2.body[0].nombre, 'Item Usuario 2');
});

test('pendientes: duplicado devuelve 409', async () => {
  const { token } = await register('PendienteDup');

  const r1 = await request(app).post('/api/recetas-pendientes').set(hdr(token)).send({
    id_externo: 'dup-1',
    tipo: 'com',
    title: 'Receta',
    extendedIngredients: [],
  });
  assert.equal(r1.status, 201);

  const r2 = await request(app).post('/api/recetas-pendientes').set(hdr(token)).send({
    id_externo: 'dup-1',
    tipo: 'com',
    title: 'Receta',
    extendedIngredients: [],
  });
  assert.equal(r2.status, 409);
});
