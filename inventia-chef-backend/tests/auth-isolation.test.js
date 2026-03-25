const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;
let app;

async function registerUser(prefix) {
  const email = `${prefix.toLowerCase()}${Math.floor(Math.random() * 100000)}@inventia.local`;
  const response = await request(app)
    .post('/api/auth/register')
    .send({
      nombre: prefix,
      email,
      password: 'secreto123',
    });

  assert.equal(response.status, 201, `Registro falló para ${prefix}`);
  assert.ok(response.body?.token, 'No se devolvió token en registro');

  return {
    token: response.body.token,
    user: response.body.user,
  };
}

function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

async function addPantryItem(headers, nombre, cantidad = 1) {
  return request(app)
    .post('/api/alimentos')
    .set(headers)
    .send({
      nombre,
      categoria: 'Fresco',
      cantidad,
      unidad_medida: 'Unidades',
      metodo_ingreso: 'Manual',
    });
}

async function addPendingRecipe(headers, idExterno, title = 'Receta Pendiente Test', ingrediente = 'cebolla') {
  return request(app)
    .post('/api/recetas-pendientes')
    .set(headers)
    .send({
      id_externo: idExterno,
      title,
      image: 'https://example.com/recipe.jpg',
      readyInMinutes: 20,
      servings: 2,
      extendedIngredients: [{ name: ingrediente, original: `1 ${ingrediente}` }],
      analyzedInstructions: [],
      tipo: 'Spoonacular',
    });
}

test.before(async () => {
  mongoServer = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongoServer.getUri();
  process.env.JWT_SECRET = 'test-jwt-secret';
  process.env.PASSWORD_CHANGE_MAX_ATTEMPTS = '3';
  process.env.PASSWORD_CHANGE_WINDOW_MS = '600000';
  process.env.PASSWORD_CHANGE_LOCK_MS = '120000';

  app = require('../server');
  await mongoose.connection.asPromise();
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

test('bloquea endpoint protegido sin token', async () => {
  const response = await request(app).get('/api/alimentos');
  assert.equal(response.status, 401);
});

test('aísla inventario y favoritos entre usuarios', async () => {
  const userA = await registerUser('UserA');
  const userB = await registerUser('UserB');

  const headersA = authHeaders(userA.token);
  const headersB = authHeaders(userB.token);

  const crearAlimentoA = await request(app)
    .post('/api/alimentos')
    .set(headersA)
    .send({
      nombre: 'Tomate',
      categoria: 'Fresco',
      cantidad: 2,
      unidad_medida: 'Unidades',
      metodo_ingreso: 'Manual',
    });

  assert.equal(crearAlimentoA.status, 201);

  const inventarioA = await request(app).get('/api/alimentos').set(headersA);
  const inventarioB = await request(app).get('/api/alimentos').set(headersB);

  assert.equal(inventarioA.status, 200);
  assert.equal(inventarioB.status, 200);
  assert.equal(Array.isArray(inventarioA.body), true);
  assert.equal(Array.isArray(inventarioB.body), true);
  assert.equal(inventarioA.body.length, 1);
  assert.equal(inventarioB.body.length, 0);

  const crearFavoritoA = await request(app)
    .post('/api/favoritos')
    .set(headersA)
    .send({
      id_externo: 'ia-receta-1',
      title: 'Receta IA Test',
      image: 'https://example.com/test.jpg',
      readyInMinutes: 15,
      servings: 2,
      tipo: 'IA',
    });

  assert.equal(crearFavoritoA.status, 201);

  const favoritosA = await request(app).get('/api/favoritos').set(headersA);
  const favoritosB = await request(app).get('/api/favoritos').set(headersB);

  assert.equal(favoritosA.status, 200);
  assert.equal(favoritosB.status, 200);
  assert.equal(Array.isArray(favoritosA.body), true);
  assert.equal(Array.isArray(favoritosB.body), true);
  assert.equal(favoritosA.body.length, 1);
  assert.equal(favoritosB.body.length, 0);
});

test('aísla pendientes entre usuarios y evita duplicados por usuario', async () => {
  const userA = await registerUser('PendingA');
  const userB = await registerUser('PendingB');
  const headersA = authHeaders(userA.token);
  const headersB = authHeaders(userB.token);

  const createA = await addPendingRecipe(headersA, 'pend-1', 'Pendiente A');
  assert.equal(createA.status, 201);

  const dupA = await addPendingRecipe(headersA, 'pend-1', 'Pendiente A Duplicada');
  assert.equal(dupA.status, 409);

  const createB = await addPendingRecipe(headersB, 'pend-1', 'Pendiente B misma receta');
  assert.equal(createB.status, 201);

  const pendientesA = await request(app).get('/api/recetas-pendientes').set(headersA);
  const pendientesB = await request(app).get('/api/recetas-pendientes').set(headersB);

  assert.equal(pendientesA.status, 200);
  assert.equal(pendientesB.status, 200);
  assert.equal(pendientesA.body.length, 1);
  assert.equal(pendientesB.body.length, 1);
  assert.equal(String(pendientesA.body[0].user_id), String(userA.user.id));
  assert.equal(String(pendientesB.body[0].user_id), String(userB.user.id));
});

test('aísla historial y borrado afecta solo al usuario autenticado', async () => {
  const userA = await registerUser('HistA');
  const userB = await registerUser('HistB');
  const headersA = authHeaders(userA.token);
  const headersB = authHeaders(userB.token);

  const addHistA = await request(app)
    .post('/api/historial')
    .set(headersA)
    .send({
      titulo: 'Compra A',
      tipo: 'compra',
      origen: 'manual',
      articulos: [{ nombre: 'Arroz', cantidad: '1 kg', precio: 2 }],
      total: 2,
    });
  assert.equal(addHistA.status, 201);

  const addHistB = await request(app)
    .post('/api/historial')
    .set(headersB)
    .send({
      titulo: 'Compra B',
      tipo: 'compra',
      origen: 'manual',
      articulos: [{ nombre: 'Pasta', cantidad: '1 paquete', precio: 1 }],
      total: 1,
    });
  assert.equal(addHistB.status, 201);

  const beforeDeleteA = await request(app).get('/api/historial').set(headersA);
  const beforeDeleteB = await request(app).get('/api/historial').set(headersB);
  assert.equal(beforeDeleteA.body.length, 1);
  assert.equal(beforeDeleteB.body.length, 1);

  const deleteA = await request(app).delete('/api/historial').set(headersA);
  assert.equal(deleteA.status, 200);

  const afterDeleteA = await request(app).get('/api/historial').set(headersA);
  const afterDeleteB = await request(app).get('/api/historial').set(headersB);
  assert.equal(afterDeleteA.body.length, 0);
  assert.equal(afterDeleteB.body.length, 1);
});

test('genera compra inteligente por usuario y guarda ticket propio', async () => {
  const userA = await registerUser('SmartA');
  const userB = await registerUser('SmartB');
  const headersA = authHeaders(userA.token);
  const headersB = authHeaders(userB.token);

  const pA = await addPendingRecipe(headersA, 'smart-pend-a', 'Receta smart A', 'cebolla');
  assert.equal(pA.status, 201);
  const pB = await addPendingRecipe(headersB, 'smart-pend-b', 'Receta smart B', 'zanahoria');
  assert.equal(pB.status, 201);

  const invA = await addPantryItem(headersA, 'Tomate', 1);
  assert.equal(invA.status, 201);
  const invB = await addPantryItem(headersB, 'Leche', 1);
  assert.equal(invB.status, 201);

  const smartA = await request(app)
    .post('/api/compra-inteligente/generar')
    .set(headersA)
    .send({});
  const smartB = await request(app)
    .post('/api/compra-inteligente/generar')
    .set(headersB)
    .send({});

  assert.equal(smartA.status, 200);
  assert.equal(smartB.status, 200);
  assert.equal(Array.isArray(smartA.body.lista), true);
  assert.equal(Array.isArray(smartB.body.lista), true);
  assert.ok(smartA.body.ticketId, 'Usuario A debería tener ticketId');
  assert.ok(smartB.body.ticketId, 'Usuario B debería tener ticketId');
  assert.notEqual(String(smartA.body.ticketId), String(smartB.body.ticketId));

  const historialA = await request(app).get('/api/historial').set(headersA);
  const historialB = await request(app).get('/api/historial').set(headersB);
  assert.equal(historialA.status, 200);
  assert.equal(historialB.status, 200);
  assert.equal(historialA.body.some((t) => String(t._id) === String(smartA.body.ticketId)), true);
  assert.equal(historialB.body.some((t) => String(t._id) === String(smartB.body.ticketId)), true);
});

test('actualiza nombre de cuenta en perfil y refleja token actualizado', async () => {
  const user = await registerUser('PerfilCuenta');
  const headers = authHeaders(user.token);

  const update = await request(app)
    .put('/api/perfil/account')
    .set(headers)
    .send({ nombre: 'Nombre Editado Perfil' });

  assert.equal(update.status, 200);
  assert.ok(update.body?.token, 'Debe devolver token actualizado');
  assert.equal(update.body?.user?.nombre, 'Nombre Editado Perfil');
  assert.equal(update.body?.perfil?.nombre, 'Nombre Editado Perfil');

  const me = await request(app)
    .get('/api/auth/me')
    .set(authHeaders(update.body.token));

  assert.equal(me.status, 200);
  assert.equal(me.body?.user?.nombre, 'Nombre Editado Perfil');
});

test('cambia password correctamente y permite login con nueva password', async () => {
  const email = `pwdok${Math.floor(Math.random() * 100000)}@inventia.local`;

  const registro = await request(app)
    .post('/api/auth/register')
    .send({
      nombre: 'PwdOk',
      email,
      password: 'secreto123',
    });

  assert.equal(registro.status, 201);

  const cambio = await request(app)
    .put('/api/perfil/password')
    .set(authHeaders(registro.body.token))
    .send({
      password_actual: 'secreto123',
      password_nueva: 'nueva1234',
    });

  assert.equal(cambio.status, 200);
  assert.ok(cambio.body?.token);

  const loginVieja = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'secreto123' });
  assert.equal(loginVieja.status, 401);

  const loginNueva = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'nueva1234' });
  assert.equal(loginNueva.status, 200);
  assert.ok(loginNueva.body?.token);
});

test('valida longitud minima en nueva password', async () => {
  const user = await registerUser('PwdMinLen');

  const cambio = await request(app)
    .put('/api/perfil/password')
    .set(authHeaders(user.token))
    .send({
      password_actual: 'secreto123',
      password_nueva: '123',
    });

  assert.equal(cambio.status, 400);
  assert.equal(
    String(cambio.body?.mensaje || '').includes('al menos 6 caracteres'),
    true,
    'Debe exigir longitud minima en password_nueva'
  );
});

test('rechaza nueva password igual a la actual', async () => {
  const user = await registerUser('PwdSame');

  const cambio = await request(app)
    .put('/api/perfil/password')
    .set(authHeaders(user.token))
    .send({
      password_actual: 'secreto123',
      password_nueva: 'secreto123',
    });

  assert.equal(cambio.status, 400);
  assert.equal(
    String(cambio.body?.mensaje || '').includes('distinta'),
    true,
    'Debe rechazar reusar la misma password'
  );
});

test('aplica lock temporal tras varios intentos fallidos de password actual', async () => {
  const user = await registerUser('PwdLock');
  const headers = authHeaders(user.token);

  const intento1 = await request(app)
    .put('/api/perfil/password')
    .set(headers)
    .send({ password_actual: 'incorrecta', password_nueva: 'nueva1234' });
  assert.equal(intento1.status, 401);

  const intento2 = await request(app)
    .put('/api/perfil/password')
    .set(headers)
    .send({ password_actual: 'incorrecta', password_nueva: 'nueva1234' });
  assert.equal(intento2.status, 401);

  const intento3 = await request(app)
    .put('/api/perfil/password')
    .set(headers)
    .send({ password_actual: 'incorrecta', password_nueva: 'nueva1234' });
  assert.equal(intento3.status, 429);
  assert.ok(Number(intento3.body?.retry_after_segundos || 0) > 0);

  const intentoBloqueado = await request(app)
    .put('/api/perfil/password')
    .set(headers)
    .send({ password_actual: 'secreto123', password_nueva: 'nueva1234' });
  assert.equal(intentoBloqueado.status, 429);
});
