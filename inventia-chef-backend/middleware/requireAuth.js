const jwt = require('jsonwebtoken');
const { obtenerJwtSecret } = require('../utils/jwt');

function requireAuth(req, res, next) {
  try {
    const header = String(req.headers.authorization || '');
    if (!header.startsWith('Bearer ')) {
      return res.status(401).json({ mensaje: 'No autorizado: falta token' });
    }

    const token = header.slice(7).trim();
    const secret = obtenerJwtSecret();
    const payload = jwt.verify(token, secret);

    req.user = {
      id: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
      rol: payload.rol || 'usuario',
    };

    return next();
  } catch {
    return res.status(401).json({ mensaje: 'No autorizado: token invalido' });
  }
}

module.exports = requireAuth;
