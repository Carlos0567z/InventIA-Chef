/**
 * Obtiene datos del producto por código de barras vía backend (evita bloqueos del navegador al catálogo público).
 */
export const buscarProductoPorCodigo = async (codigoBarras) => {
  const codigoNormalizado = String(codigoBarras || '').trim();
  if (!codigoNormalizado) {
    return {
      encontrado: false,
      mensaje: 'Introduce un código de barras válido.',
    };
  }

  try {
    const response = await fetch(
      `/api/catalogo/codigo-barras/${encodeURIComponent(codigoNormalizado)}`
    );
    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        encontrado: false,
        mensaje:
          payload?.mensaje ||
          'No pudimos obtener la información de este código. Inténtalo de nuevo en unos instantes.',
      };
    }

    if (payload && typeof payload.encontrado === 'boolean') {
      return payload;
    }

    return {
      encontrado: false,
      mensaje: 'Algo salió mal al leer la respuesta. Prueba de nuevo.',
    };
  } catch {
    return {
      encontrado: false,
      mensaje:
        'No hay conexión o el servidor no responde. Comprueba internet y que la aplicación esté disponible.',
    };
  }
};
