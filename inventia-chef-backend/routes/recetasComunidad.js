// Re-exporta el router unificado de comunidad para asegurar compatibilidad total
// tanto si el cliente llama a /api/recetas-comunidad como a /api/recetas-comunidad/gestionar
module.exports = require('./recetasComunidadGestion');
