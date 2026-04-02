const ROLE_BY_EMAIL = {
  'prueba@gmail.com': 'admin',
  'test@test.com': 'admin',
  'carlosalmendras66@gmail.com': 'admin',
};

function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function rolDefinidoPorEmail(email) {
  const key = normalizarEmail(email);
  return ROLE_BY_EMAIL[key] || 'usuario';
}

module.exports = {
  rolDefinidoPorEmail,
  normalizarEmail,
};
