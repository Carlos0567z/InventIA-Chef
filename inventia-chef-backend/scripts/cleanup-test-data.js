const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI no configurada');
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const usuarios = db.collection('usuarios');
  const perfiles = db.collection('perfils');
  const alimentos = db.collection('alimentos');
  const favoritos = db.collection('favoritos');
  const pendientes = db.collection('recetapendientes');
  const historiales = db.collection('historials');

  const testUsers = await usuarios
    .find({ email: /@inventia\.local$/i })
    .project({ _id: 1, email: 1 })
    .toArray();

  const idsObj = testUsers.map((u) => u._id);
  const idsStr = testUsers.map((u) => String(u._id));

  const results = {};

  results.usuarios = (await usuarios.deleteMany({ email: /@inventia\.local$/i })).deletedCount || 0;

  results.perfiles = (
    await perfiles.deleteMany({
      $or: [
        { user_id: { $in: idsStr } },
        { email: /@inventia\.local$/i },
        { nombre: /^(Demo User|Multi User|Perfil User|UserA|UserB)$/i },
      ],
    })
  ).deletedCount || 0;

  results.alimentos = (
    await alimentos.deleteMany({
      $or: [
        { user_id: { $in: idsObj } },
        { user_id: { $in: idsStr } },
        { nombre: { $in: ['Tomate', 'Leche'] } },
      ],
    })
  ).deletedCount || 0;

  results.favoritos = (
    await favoritos.deleteMany({
      $or: [
        { user_id: { $in: idsObj } },
        { user_id: { $in: idsStr } },
        { id_externo: /^test-/i },
        { id_externo: /^iso-/i },
        { title: /test/i },
      ],
    })
  ).deletedCount || 0;

  results.pendientes = (
    await pendientes.deleteMany({
      $or: [
        { user_id: { $in: idsObj } },
        { user_id: { $in: idsStr } },
        { id_externo: /^pend-/i },
        { id_externo: /^smart-/i },
        { title: /test|pendiente a|pendiente b/i },
      ],
    })
  ).deletedCount || 0;

  results.historials = (
    await historiales.deleteMany({
      $or: [{ user_id: { $in: idsObj } }, { user_id: { $in: idsStr } }],
    })
  ).deletedCount || 0;

  const total = Object.values(results).reduce((acc, n) => acc + n, 0);

  console.log('Limpieza de datos de prueba completada:');
  Object.entries(results).forEach(([k, v]) => console.log(`- ${k}: ${v}`));
  console.log(`Total eliminados: ${total}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Error limpiando datos de prueba:', error.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignorar
  }
  process.exit(1);
});
