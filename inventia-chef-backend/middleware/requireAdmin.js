const Usuario = require('../models/Usuario');

async function requireAdmin(req, res, next) {
  try {
    const usuario = await Usuario.findById(req.user.id).select('rol').lean();
    const rol = String(usuario?.rol || req.user.rol || 'usuario').toLowerCase();
    if (rol !== 'admin') {
      return res.status(403).json({ mensaje: 'Acceso denegado: requiere rol admin' });
    }
    return next();
  } catch {
    return res.status(500).json({ mensaje: 'Error comprobando permisos' });
  }
}

module.exports = requireAdmin;
