const mongoose = require('mongoose');

const ingredienteConCantidadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  original: { type: String, default: '' }, // ej: "500g pasta"
  cantidad: { type: Number, default: 0 },
  unidad: { type: String, default: '' }, // 'g', 'kg', 'ml', 'l', 'unidad', etc.
  _id: false,
});

const versionRecetaSchema = new mongoose.Schema({
  numero_personas: { type: Number, required: true }, // 2, 4, 6, etc.
  readyInMinutes: { type: Number, default: 25 },
  servings: { type: Number, default: 2 },
  extendedIngredients: [ingredienteConCantidadSchema],
  analyzedInstructions: { type: Array, default: [] },
  _id: false,
});

const recetaComunidadSchema = new mongoose.Schema({
  id_externo: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, default: '' }, // Descripción de la receta
  image: { type: String, default: 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=500' },
  source_url: { type: String, default: '' },
  tipo: { type: String, default: 'Comunidad' },
  prompt_origen: { type: String, default: '' },
  autor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  autor_nombre: { type: String, default: '' },
  
  // Versiones múltiples: una receta puede tener versiones para 2, 4, 6 personas, etc.
  versiones: [versionRecetaSchema],
  
  // Legacy: compatibilidad con datos antiguos
  usedIngredientCount: { type: Number, default: 0 },
  missedIngredientCount: { type: Number, default: 0 },
  usedIngredients: { type: Array, default: [] },
  missedIngredients: { type: Array, default: [] },
  extendedIngredients: { type: Array, default: [] },
  analyzedInstructions: { type: Array, default: [] },
  readyInMinutes: { type: Number, default: 25 },
  servings: { type: Number, default: 2 },
  
  // Likes
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Usuario' }],
  numero_likes: { type: Number, default: 0 },
  
  // Estadísticas
  numero_comentarios: { type: Number, default: 0 },
  puntuacion_media: { type: Number, default: 0, min: 0, max: 5 },
  numero_veces_guardada: { type: Number, default: 0 },
  
  // Control
  estado: { type: String, enum: ['publicada', 'borrador', 'bloqueada'], default: 'publicada' },
  fecha_publicacion: { type: Date, default: Date.now },
  fecha_ultima_edicion: { type: Date, default: Date.now },
});

module.exports = mongoose.model('RecetaComunidad', recetaComunidadSchema);
