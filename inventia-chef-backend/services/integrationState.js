let spoonacularBloqueadoHasta = 0;

function getSpoonacularBloqueadoHasta() {
  return Number(spoonacularBloqueadoHasta) || 0;
}

function setSpoonacularBloqueadoHasta(timestampMs) {
  spoonacularBloqueadoHasta = Number(timestampMs) || 0;
}

function isSpoonacularBloqueado() {
  return getSpoonacularBloqueadoHasta() > Date.now();
}

module.exports = {
  getSpoonacularBloqueadoHasta,
  setSpoonacularBloqueadoHasta,
  isSpoonacularBloqueado,
};
