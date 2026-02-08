const mongoose = require('mongoose');

// esquema de la base de datos para la coleccion alimentos
const alimentoSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    nombre: { type: String, required: true },
    categoria: { type: String, default: 'Fresco' },
    cantidad: { type: Number, required: true, min: 0 },
    unidad_medida: { type: String, default: 'Unidades' },
    fecha_caducidad: { type: Date },
    metodo_ingreso: {
      type: String,
      enum: ['Manual', 'QuaggaJS_Barcode', 'TensorFlow_Vision'],
      default: 'Manual',
    },

    // Objeto anidado para los datos extraidos de la API
    datos_openfoodfacts: {
      codigo_barras: String,
      nutriscore: String,
      alergenos_detectados: [String],
    },
    estado_alerta: { type: String, default: 'Ok' },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Alimento', alimentoSchema);
