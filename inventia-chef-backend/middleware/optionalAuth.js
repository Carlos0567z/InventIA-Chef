const jwt = require('jsonwebtoken');
const { obtenerJwtSecret } = require('../utils/jwt');

function optionalAuth(req, res, next) {
  try {
    const header = String(req.headers.authorization || '');
    if (!header.startsWith('Bearer ')) {
      return next();
    }

    const token = header.slice(7).trim();
    if (!token) {
      return next();
    }

    const secret = obtenerJwtSecret();
    const payload = jwt.verify(token, secret);

    req.user = {
      id: payload.sub,
      email: payload.email,
      nombre: payload.nombre,
      rol: payload.rol || 'usuario',
    };
  } catch {
    // Si el token es invalido o expiro, simplemente continuamos sin usuario autenticado
  }
  return next();
}

module.exports = optionalAuth;
