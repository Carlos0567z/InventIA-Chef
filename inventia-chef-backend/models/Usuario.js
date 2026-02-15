const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
  nombre: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  rol: { type: String, default: 'usuario' },
  biografia: { type: String, default: '', maxLength: 300 },
  fecha_registro: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Usuario', usuarioSchema);
