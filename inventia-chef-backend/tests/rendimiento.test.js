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
  process.env.JWT_SECRET = 'performance-secret';
  app = require('../server');
  await mongoose.connection.asPromise();
});

test.after(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

async function getAuthToken() {
  const r = await request(app).post('/api/auth/register').send({
    nombre: 'PerfTest',
    email: `perf${Date.now()}@test.com`,
    password: 'password123'
  });
  return r.body.token;
}

test('rendimiento: respuesta del inventario (GET /api/alimentos)', async () => {
  const token = await getAuthToken();
  
  // Insertamos 50 alimentos para simular una despensa real
  for (let i = 0; i < 50; i++) {
    await request(app)
      .post('/api/alimentos')
      .set('Authorization', `Bearer ${token}`)
      .send({
        nombre: `Alimento ${i}`,
        cantidad: i + 1,
        unidad_medida: 'Unidades',
        categoria: 'Fresco',
        fecha_caducidad: new Date(Date.now() + i * 86400000).toISOString()
      });
  }

  const inicio = Date.now();
  const res = await request(app)
    .get('/api/alimentos')
    .set('Authorization', `Bearer ${token}`);
  const fin = Date.now();
  
  const duracion = fin - inicio;
  console.log(`[PERF] GET /api/alimentos con 50 items: ${duracion}ms`);
  
  assert.equal(res.status, 200);
  assert.ok(duracion < 200, 'El inventario deberia cargar en menos de 200ms');
});

test('rendimiento: simulacion de carga de recetas IA (con fallback)', async () => {
  const token = await getAuthToken();
  
  // Añadimos un ingrediente para que la IA tenga algo que hacer
  await request(app)
    .post('/api/alimentos')
    .set('Authorization', `Bearer ${token}`)
    .send({ nombre: 'Tomate', cantidad: 1, unidad_medida: 'Unidades' });

  // Nota: Como no tenemos API Key de Gemini en el entorno de test, saltara el fallback
  const inicio = Date.now();
  const res = await request(app)
    .get('/api/recetas-ia/sugerencias?cantidad=3')
    .set('Authorization', `Bearer ${token}`);
  const fin = Date.now();
  
  const duracion = fin - inicio;
  console.log(`[PERF] GET /api/recetas-ia/sugerencias (Fallback): ${duracion}ms`);
  
  assert.equal(res.status, 200);
});
