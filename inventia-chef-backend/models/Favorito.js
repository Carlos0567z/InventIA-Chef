const mongoose = require('mongoose');

const favoritoSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  id_externo: { type: String, required: true },
  title: String,
  image: String,
  readyInMinutes: Number,
  servings: Number,
  extendedIngredients: Array,
  analyzedInstructions: Array,
  tipo: { type: String, default: 'Spoonacular' },
  fecha_guardado: {
    type: Date,
    default: Date.now,
  },
});

favoritoSchema.index({ user_id: 1, id_externo: 1, tipo: 1 }, { unique: true });

module.exports = mongoose.model('Favorito', favoritoSchema);
