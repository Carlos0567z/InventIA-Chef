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
  return { token: r.body.token, user: r.body.user };
}

function headers(token) {
  return { Authorization: `Bearer ${token}` };
}

test('comunidad: flujo completo de red social (recetas, likes, comentarios, respuestas y perfil de cocinero)', async () => {
  const chef1 = await register('ChefMario');
  const user2 = await register('ComensalLuigi');

  // 1. ChefMario aporta una receta a la comunidad
  const recetaRes = await request(app)
    .post('/api/recetas-comunidad/gestionar/aportar')
    .set(headers(chef1.token))
    .send({
      title: 'Risotto de Champiñones Auténtico',
      description: 'Cremoso risotto tradicional italiano con setas frescas.',
      image: 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?w=500',
      versiones: [
        {
          numero_personas: 4,
          readyInMinutes: 30,
          extendedIngredients: [
            { name: 'Arroz arborio', cantidad: 320, unidad: 'g', original: '320g arroz arborio' },
            { name: 'Champiñones', cantidad: 300, unidad: 'g', original: '300g champiñones frescos' },
            { name: 'Parmesano', cantidad: 60, unidad: 'g', original: '60g queso parmesano' },
          ],
          analyzedInstructions: [
            {
              steps: [
                { number: 1, step: 'Dorar los champiñones con ajo en oliva.' },
                { number: 2, step: 'Añadir el arroz y nacarar 2 minutos.' },
                { number: 3, step: 'Incorporar caldo poco a poco y mantecar con parmesano.' },
              ],
            },
          ],
        },
      ],
    });

  assert.equal(recetaRes.status, 201);
  const receta = recetaRes.body;
  assert.ok(receta._id);
  assert.equal(receta.title, 'Risotto de Champiñones Auténtico');
  assert.equal(receta.autor_nombre, 'ChefMario');
  assert.equal(receta.numero_likes, 0);

  // 2. ComensalLuigi da Like a la receta
  const like1 = await request(app)
    .post(`/api/recetas-comunidad/gestionar/${receta._id}/like`)
    .set(headers(user2.token));
  assert.equal(like1.status, 200);
  assert.equal(like1.body.liked, true);
  assert.equal(like1.body.numero_likes, 1);

  // Comprobar que en el detalle de la receta aparece has_liked: true para user2
  const detalleUser2 = await request(app)
    .get(`/api/recetas-comunidad/gestionar/${receta._id}`)
    .set(headers(user2.token));
  assert.equal(detalleUser2.status, 200);
  assert.equal(detalleUser2.body.has_liked, true);
  assert.equal(detalleUser2.body.numero_likes, 1);

  // 3. ComensalLuigi da Like de nuevo (Toggle -> Quitar Like)
  const unlike = await request(app)
    .post(`/api/recetas-comunidad/gestionar/${receta._id}/like`)
    .set(headers(user2.token));
  assert.equal(unlike.status, 200);
  assert.equal(unlike.body.liked, false);
  assert.equal(unlike.body.numero_likes, 0);

  // Volvemos a dar like para las metricas del perfil
  await request(app)
    .post(`/api/recetas-comunidad/gestionar/${receta._id}/like`)
    .set(headers(user2.token));

  // 4. ComensalLuigi comenta y valora con 5 estrellas
  const comentarioRes = await request(app)
    .post(`/api/recetas-comunidad/gestionar/${receta._id}/comentarios`)
    .set(headers(user2.token))
    .send({
      puntuacion: 5,
      contenido: '¡Espectacular risotto! El toque de mantecado queda perfecto.',
    });

  assert.equal(comentarioRes.status, 201);
  assert.equal(comentarioRes.body.numero_comentarios, 1);
  assert.equal(comentarioRes.body.puntuacion_media, 5);
  const comentario = comentarioRes.body.comentario;
  assert.ok(comentario._id);
  assert.equal(comentario.autor_nombre, 'ComensalLuigi');

  // 5. ChefMario responde al comentario
  const respRes = await request(app)
    .post(`/api/recetas-comunidad/gestionar/${receta._id}/comentarios/${comentario._id}/respuesta`)
    .set(headers(chef1.token))
    .send({
      texto: '¡Muchas gracias Luigi! Me alegro un montón de que te gustara.',
    });

  assert.equal(respRes.status, 201);
  assert.equal(respRes.body.respuestas.length, 1);
  assert.equal(respRes.body.respuestas[0].autor_nombre, 'ChefMario');

  // 6. Validar listado de comentarios de la receta
  const comentariosList = await request(app)
    .get(`/api/recetas-comunidad/gestionar/${receta._id}/comentarios`);
  assert.equal(comentariosList.status, 200);
  assert.equal(comentariosList.body.length, 1);
  assert.equal(comentariosList.body[0].respuestas.length, 1);

  // 7. Seguridad: ChefMario intenta borrar el comentario de Luigi (no es admin ni autor del comentario) -> 403
  const borrarAjeno = await request(app)
    .delete(`/api/recetas-comunidad/gestionar/${receta._id}/comentarios/${comentario._id}`)
    .set(headers(chef1.token));
  assert.equal(borrarAjeno.status, 403);

  // 8. Consulta de perfil público del cocinero (ChefMario)
  const cocineroRes = await request(app)
    .get(`/api/perfil/cocinero/${chef1.user.id}`);
  assert.equal(cocineroRes.status, 200);
  assert.equal(cocineroRes.body.cocinero.nombre, 'ChefMario');
  assert.equal(cocineroRes.body.metricas.recetas_count, 1);
  assert.equal(cocineroRes.body.metricas.likes_totales, 1);
  assert.equal(cocineroRes.body.metricas.puntuacion_media, 5);
  // Verificar que NO se filtra informacion sensible como password o email
  assert.equal(cocineroRes.body.cocinero.password_hash, undefined);
  assert.equal(cocineroRes.body.cocinero.email, undefined);

  // 9. Recetas públicas del cocinero
  const recetasChef = await request(app)
    .get(`/api/perfil/cocinero/${chef1.user.id}/recetas`);
  assert.equal(recetasChef.status, 200);
  assert.equal(recetasChef.body.length, 1);
  assert.equal(recetasChef.body[0].title, 'Risotto de Champiñones Auténtico');

  // 10. Filtrado y ordenamiento en comunidad
  const listadoPopulares = await request(app)
    .get('/api/recetas-comunidad/gestionar?ordenar=populares');
  assert.equal(listadoPopulares.status, 200);
  assert.ok(listadoPopulares.body.length >= 1);

  // 11. Búsqueda con caracteres regex para asegurar resistencia contra ReDoS
  const busquedaSegura = await request(app)
    .get('/api/recetas-comunidad/gestionar?buscar=(.*)+Risotto[a-z]?');
  assert.equal(busquedaSegura.status, 200);

  // 12. Luigi borra su propio comentario
  const borrarPropio = await request(app)
    .delete(`/api/recetas-comunidad/gestionar/${receta._id}/comentarios/${comentario._id}`)
    .set(headers(user2.token));
  assert.equal(borrarPropio.status, 200);
  assert.equal(borrarPropio.body.numero_comentarios, 0);
  assert.equal(borrarPropio.body.puntuacion_media, 0);
});
