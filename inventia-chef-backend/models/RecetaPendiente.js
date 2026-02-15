const mongoose = require('mongoose');

// Igual que favoritos, pero para el plan semanal
const recetaPendienteSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Usuario', required: true, index: true },
    id_externo: { type: String, required: true },
    title: String,
    image: String,
    readyInMinutes: Number,
    servings: Number,
    extendedIngredients: Array, // Crucial para calcular la compra
    analyzedInstructions: Array,
    tipo: String, // 'IA' o 'Spoonacular'
    fecha_planificada: { type: Date, default: Date.now }
});

recetaPendienteSchema.index({ user_id: 1, id_externo: 1, tipo: 1 }, { unique: true });

const RecetaPendiente = mongoose.model('RecetaPendiente', recetaPendienteSchema);

// Revisamos los indices al arrancar.
async function ensureRecetaPendienteIndexes() {
    try {
        if (mongoose.connection.readyState !== 1) {
            // Esperamos a la conexion
            mongoose.connection.once('open', ensureRecetaPendienteIndexes);
            return;
        }

        const coll = mongoose.connection.collection('recetapendientes');
        const indexes = await coll.indexes();

        for (const idx of indexes) {
            if (idx.key && idx.key.id_externo === 1 && Object.keys(idx.key).length === 1) {
                try {
                    await coll.dropIndex(idx.name);
                    console.log('Indice suelto borrado:', idx.name, 'en recetapendientes');
                } catch (dropErr) {
                    console.error('Error al borrar indice', idx.name, dropErr);
                }
            }
        }

        // Que Mongoose cree los indices del schema
        await RecetaPendiente.init();
    } catch (err) {
        console.error('Error comprobando indices de RecetaPendiente:', err);
    }
}

ensureRecetaPendienteIndexes();

module.exports = RecetaPendiente;
