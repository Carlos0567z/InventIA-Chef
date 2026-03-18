const mongoose = require('mongoose');
require('dotenv').config();

const Usuario = require('../models/Usuario');
const { rolDefinidoPorEmail, normalizarEmail } = require('../utils/roles');

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI no configurada');
  }

  await mongoose.connect(process.env.MONGODB_URI);

  const users = await Usuario.find({});
  let updated = 0;

  for (const user of users) {
    const email = normalizarEmail(user.email);
    const nextRole = rolDefinidoPorEmail(email);
    const currRole = String(user.rol || 'usuario');

    if (currRole !== nextRole) {
      user.rol = nextRole;
      await user.save();
      updated += 1;
    }
  }

  console.log(`Roles sincronizados. Usuarios actualizados: ${updated}`);
  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Error sincronizando roles:', error.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignorar
  }
  process.exit(1);
});
