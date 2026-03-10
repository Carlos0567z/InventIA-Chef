const mongoose = require('mongoose');
require('dotenv').config();

/** Todas las colecciones de dominio de la app (nombres reales en MongoDB). */
const COLLECTIONS = [
  'usuarios',
  'perfils',
  'alimentos',
  'favoritos',
  'recetapendientes',
  'historials',
  'listacompras',
  'recetacomunidads',
  'comentarios',
  'notificacions',
  'cocineroprofiles',
  'appconfigs',
  'securityaudits',
];

function wantsConfirm() {
  const argv = process.argv.slice(2);
  if (argv.includes('--yes')) return true;
  if (String(process.env.RESET_DATABASE_CONFIRM || '').toUpperCase() === 'YES') return true;
  return false;
}

async function run() {
  if (!wantsConfirm()) {
    console.error(
      'Para vaciar la base de datos ejecuta con --yes o RESET_DATABASE_CONFIRM=YES (MongoDB se vacía por completo en las colecciones de la app).'
    );
    process.exit(1);
  }

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI no está configurada.');
    process.exit(1);
  }

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const existing = new Set(
    (await db.listCollections({}, { nameOnly: true }).toArray()).map((c) => c.name)
  );

  const summary = [];

  for (const name of COLLECTIONS) {
    if (!existing.has(name)) {
      summary.push({ name, deleted: 0, skipped: 'no existe' });
      continue;
    }
    const r = await db.collection(name).deleteMany({});
    summary.push({ name, deleted: r.deletedCount || 0, skipped: false });
  }

  console.log('Base de datos vaciada (colecciones de la app):');
  summary.forEach((row) => {
    if (row.skipped) {
      console.log(`- ${row.name}: omitida (${row.skipped})`);
      return;
    }
    console.log(`- ${row.name}: eliminados ${row.deleted} documentos`);
  });

  const total = summary.reduce((acc, row) => acc + (typeof row.deleted === 'number' ? row.deleted : 0), 0);
  console.log(`Total documentos eliminados: ${total}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Error:', error.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignorar
  }
  process.exit(1);
});
