const mongoose = require('mongoose');

async function writeSecurityAudit(evento, payload = {}) {
  const item = {
    evento,
    timestamp: new Date().toISOString(),
    ...payload,
  };

  try {
    const db = mongoose.connection?.db;
    if (db) {
      await db.collection('securityaudits').insertOne(item);
      return;
    }
  } catch {
    // Si falla la BD, lo saco por consola
  }

  // Rastro por consola si hay fallo
  console.log(`[SECURITY_AUDIT] ${JSON.stringify(item)}`);
}

module.exports = {
  writeSecurityAudit,
};
