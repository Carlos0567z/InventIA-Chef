const mongoose = require('mongoose');

const perfilSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true,
  },
  nombre: {
    type: String,
    default: '',
  },
  email: {
    type: String,
    default: '',
  },
  alergias: {
    type: [String],
    default: [],
  },
  imagen_perfil: {
    type: String,
    default: '',
  },
  imagen_banner: {
    type: String,
    default: '',
  },
  biografia: {
    type: String,
    default: '',
  },
});

module.exports = mongoose.model('Perfil', perfilSchema);
