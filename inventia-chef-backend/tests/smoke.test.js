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

async function register(prefix) {
  const email = `${prefix.toLowerCase()}${Math.floor(Math.random() * 100000)}@inventia.local`;
  const r = await request(app).post('/api/auth/register').send({ nombre: prefix, email, password: 'secreto123' });
  assert.equal(r.status, 201);
  return r.body.token;
}

function headers(token) {
  return { Authorization: `Bearer ${token}` };
}

test('smoke: servidor arriba y registro/login + despensa básica', async () => {
  // GET /
  const root = await request(app).get('/');
  assert.equal(root.status, 200);

  const token = await register('SmokeUser');
  assert.ok(token);

  // Añadir 2 alimentos
  const a1 = await request(app).post('/api/alimentos').set(headers(token)).send({ nombre: 'Manzana', categoria: 'Fruta', cantidad: 2, unidad_medida: 'Unidades', metodo_ingreso: 'Manual' });
  const a2 = await request(app).post('/api/alimentos').set(headers(token)).send({ nombre: 'Pan', categoria: 'Pan', cantidad: 1, unidad_medida: 'Pieza', metodo_ingreso: 'Manual' });
  assert.equal(a1.status, 201);
  assert.equal(a2.status, 201);

  // Editar primer alimento
  const inv = await request(app).get('/api/alimentos').set(headers(token));
  assert.equal(inv.status, 200);
  assert.equal(inv.body.length, 2);

  const idToEdit = inv.body[0]._id;
  const edit = await request(app).put(`/api/alimentos/${idToEdit}`).set(headers(token)).send({ cantidad: 5 });
  assert.equal(edit.status, 200);
  assert.equal(edit.body.cantidad, 5);

  // Eliminar segundo
  const idToDel = inv.body[1]._id;
  const del = await request(app).delete(`/api/alimentos/${idToDel}`).set(headers(token));
  assert.equal(del.status, 200);

  const after = await request(app).get('/api/alimentos').set(headers(token));
  assert.equal(after.status, 200);
  assert.equal(after.body.length, 1);

  // Pendientes: añadir y duplicado
  const p1 = await request(app).post('/api/recetas-pendientes').set(headers(token)).send({ id_externo: 'smoke-1', tipo: 'com', title: 'Smoke' });
  assert.equal(p1.status, 201);
  const p2 = await request(app).post('/api/recetas-pendientes').set(headers(token)).send({ id_externo: 'smoke-1', tipo: 'com', title: 'Smoke' });
  assert.equal(p2.status, 409);

  const pendientes = await request(app).get('/api/recetas-pendientes').set(headers(token));
  assert.equal(pendientes.status, 200);
  assert.equal(pendientes.body.length, 1);
});
