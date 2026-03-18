const mongoose = require('mongoose');
require('dotenv').config();

const { seedAdminInventory } = require('../services/demoInventory');

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no configurada');
  }

  await mongoose.connect(process.env.MONGODB_URI);
  const result = await seedAdminInventory();
  console.log(`Inventario demo para ${result.email}: creados=${result.creados}, actualizados=${result.actualizados}, totalUsuario=${result.totalUsuario}`);

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Error sembrando inventario admin:', error.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignorar
  }
  process.exit(1);
});
