const mongoose = require('mongoose');

const historialSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  titulo: {
    type: String,
    default: 'Compra en Supermercado',
  },
  tipo: {
    type: String,
    default: 'compra',
  },
  origen: {
    type: String,
    default: 'manual',
  },
  fecha: {
    type: Date,
    default: Date.now,
  },
  total: {
    type: Number,
    default: 0,
  },
  articulos: [
    {
      nombre: String,
      cantidad: String,
      precio: Number,
      categoria: String,
      emoji: String,
    },
  ],
});

module.exports = mongoose.model('Historial', historialSchema);
