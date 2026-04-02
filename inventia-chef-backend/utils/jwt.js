const jwt = require('jsonwebtoken');

function obtenerJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET no esta configurado en produccion');
  }
  return 'inventia-dev-secret';
}

function crearToken(usuario) {
  const secret = obtenerJwtSecret();
  return jwt.sign(
    {
      sub: usuario._id.toString(),
      email: usuario.email,
      nombre: usuario.nombre,
      rol: usuario.rol || 'usuario',
    },
    secret,
    { expiresIn: '7d' }
  );
}

module.exports = {
  obtenerJwtSecret,
  crearToken,
};
