const mongoose = require('mongoose');
require('dotenv').config();

const uri = process.env.MONGODB_URI;

if (!uri) {
  console.error('MONGODB_URI no está configurada.');
  process.exit(1);
}

const targetCollections = [
  'alimentos',
  'favoritos',
  'recetapendientes',
  'historials',
  'listacompras',
  'perfils',
];

async function run() {
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const existingCollections = await db.listCollections({}, { nameOnly: true }).toArray();
  const existingNames = new Set(existingCollections.map((c) => c.name));

  const summary = [];

  for (const name of targetCollections) {
    if (!existingNames.has(name)) {
      summary.push({ collection: name, removed: 0, skipped: true });
      continue;
    }

    const col = db.collection(name);
    const result = await col.deleteMany({
      $or: [
        { user_id: { $exists: false } },
        { user_id: null },
        { user_id: '' },
      ],
    });

    summary.push({ collection: name, removed: result.deletedCount || 0, skipped: false });
  }

  const totalRemoved = summary.reduce((acc, item) => acc + (item.removed || 0), 0);

  console.log('Limpieza legacy completada:');
  summary.forEach((item) => {
    if (item.skipped) {
      console.log(`- ${item.collection}: colección no encontrada`);
      return;
    }
    console.log(`- ${item.collection}: eliminados ${item.removed}`);
  });
  console.log(`Total eliminados: ${totalRemoved}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Error limpiando datos legacy:', error.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // Si falla al salir, no pasa nada
  }
  process.exit(1);
});
