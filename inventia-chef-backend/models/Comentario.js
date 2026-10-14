const mongoose = require('mongoose');

const respuestaComentarioSchema = new mongoose.Schema({
  autor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true },
  autor_nombre: { type: String, required: true },
  autor_imagen: { type: String, default: '' },
  texto: { type: String, required: true, trim: true, maxlength: 400 },
  fecha: { type: Date, default: Date.now },
});

const comentarioSchema = new mongoose.Schema({
  receta_id: { type: mongoose.Schema.Types.ObjectId, ref: 'RecetaComunidad', required: true, index: true },
  autor_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
  autor_nombre: { type: String, required: true, trim: true },
  autor_imagen: { type: String, default: '' },
  contenido: { type: String, required: true, trim: true, maxlength: 600 },
  puntuacion: { type: Number, required: true, min: 1, max: 5 },
  respuestas: [respuestaComentarioSchema],
  fecha: { type: Date, default: Date.now, index: true },
});

// Helper estatico para recalcular estadisticas de una receta
comentarioSchema.statics.recalcularEstadisticasReceta = async function (recetaId) {
  const RecetaComunidad = mongoose.model('RecetaComunidad');
  const objectId = mongoose.Types.ObjectId.isValid(recetaId)
    ? new mongoose.Types.ObjectId(String(recetaId))
    : null;

  if (!objectId) return { numero_comentarios: 0, puntuacion_media: 0 };

  const stats = await this.aggregate([
    { $match: { receta_id: objectId } },
    {
      $group: {
        _id: '$receta_id',
        numero_comentarios: { $sum: 1 },
        puntuacion_media: { $avg: '$puntuacion' },
      },
    },
  ]);

  if (stats.length > 0) {
    const mediaRedondeada = Math.round(stats[0].puntuacion_media * 10) / 10;
    await RecetaComunidad.findByIdAndUpdate(objectId, {
      numero_comentarios: stats[0].numero_comentarios,
      puntuacion_media: mediaRedondeada,
    });
    return { numero_comentarios: stats[0].numero_comentarios, puntuacion_media: mediaRedondeada };
  } else {
    await RecetaComunidad.findByIdAndUpdate(objectId, {
      numero_comentarios: 0,
      puntuacion_media: 0,
    });
    return { numero_comentarios: 0, puntuacion_media: 0 };
  }
};

module.exports = mongoose.model('Comentario', comentarioSchema);
