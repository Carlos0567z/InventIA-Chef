const express = require('express');
const requireAuth = require('../middleware/requireAuth');
const Alimento = require('../models/Alimento');

const router = express.Router();
router.use(requireAuth);

const OFF_URL = (codigo) =>
  `https://world.openfoodfacts.org/api/v0/product/${encodeURIComponent(codigo)}.json`;

function normalizarCodigoBarras(c) {
  return String(c || '').trim().replace(/\s+/g, '');
}

function codigosCoinciden(escaneado, guardado) {
  const a = normalizarCodigoBarras(escaneado);
  const b = normalizarCodigoBarras(guardado);
  if (!a || !b) return false;
  if (a === b) return true;
  const sinCeros = (s) => {
    const t = s.replace(/^0+/, '');
    return t.length ? t : '0';
  };
  return sinCeros(a) === sinCeros(b);
}

function codigoBarrasValido(codigo) {
  const c = String(codigo || '').trim();
  if (c.length < 4 || c.length > 64) return false;
  return /^[0-9A-Za-z_-]+$/.test(c);
}

function productoNormalizado(producto) {
  return {
    encontrado: true,
    nombre: producto.product_name_es || producto.product_name || 'Producto sin nombre',
    marca: producto.brands || 'Marca desconocida',
    imagen: producto.image_url || null,
    nutriscore: producto.nutriscore_grade ? String(producto.nutriscore_grade).toUpperCase() : 'N/A',
    ingredientes: producto.ingredients_text_es || producto.ingredients_text || 'Sin información',
  };
}

async function buscarEnDespensaPorCodigo(userId, codigo) {
  const locales = await Alimento.find({
    user_id: userId,
    'datos_openfoodfacts.codigo_barras': { $exists: true, $nin: [null, ''] },
  })
    .sort({ updatedAt: -1 })
    .lean();

  return (
    locales.find((doc) => codigosCoinciden(codigo, doc.datos_openfoodfacts?.codigo_barras)) || null
  );
}

function jsonDesdeDespensa(enDespensa) {
  return {
    encontrado: true,
    nombre: enDespensa.nombre,
    marca: 'Tu despensa',
    imagen: null,
    nutriscore: enDespensa.datos_openfoodfacts?.nutriscore || 'N/A',
    ingredientes: '',
    fuente: 'despensa',
    categoria: enDespensa.categoria || 'Envasado',
  };
}

router.get('/codigo-barras/:codigo', async (req, res) => {
  const codigo = String(req.params.codigo || '').trim();

  if (!codigoBarrasValido(codigo)) {
    return res.status(400).json({
      encontrado: false,
      mensaje: 'Ese código no es válido. Comprueba que esté bien leído o escríbelo a mano.',
    });
  }

  try {
    const response = await fetch(OFF_URL(codigo), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'InventIA-Chef/1.0 (https://github.com/Carlos0567z/InventIA-Chef)',
      },
    });

    if (!response.ok) {
      const enDespensaHttp = await buscarEnDespensaPorCodigo(req.user.id, codigo);
      if (enDespensaHttp) {
        return res.status(200).json(jsonDesdeDespensa(enDespensaHttp));
      }
      return res.status(200).json({
        encontrado: false,
        mensaje:
          'Ahora mismo no pudimos consultar la ficha del producto. Espera un poco y vuelve a intentarlo.',
      });
    }

    const data = await response.json();

    if (data.status === 1 && data.product) {
      return res.status(200).json(productoNormalizado(data.product));
    }

    const enDespensa = await buscarEnDespensaPorCodigo(req.user.id, codigo);

    if (enDespensa) {
      return res.status(200).json(jsonDesdeDespensa(enDespensa));
    }

    return res.status(200).json({
      encontrado: false,
      mensaje:
        'No encontramos información para este código. Puedes escribir el nombre del producto tú mismo y guardarlo igualmente.',
    });
  } catch (err) {
    console.error('catalogo codigo-barras:', err.message || err);
    try {
      const enDespensaErr = await buscarEnDespensaPorCodigo(req.user.id, codigo);
      if (enDespensaErr) {
        return res.status(200).json(jsonDesdeDespensa(enDespensaErr));
      }
    } catch (e) {
      console.error('catalogo despensa fallback:', e.message || e);
    }
    return res.status(200).json({
      encontrado: false,
      mensaje:
        'Hubo un problema al consultar la ficha del producto. Comprueba tu conexión e inténtalo de nuevo.',
    });
  }
});

module.exports = router;
