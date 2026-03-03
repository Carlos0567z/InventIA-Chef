const express = require('express');
const router = express.Router();
const RecetaPendiente = require('../models/RecetaPendiente');
const Alimento = require('../models/Alimento');
const Historial = require('../models/Historial');
const requireAuth = require('../middleware/requireAuth');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODELOS_GEMINI = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];

function obtenerGeminiApiKeys() {
  const multi = String(process.env.GEMINI_API_KEYS || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);

  if (multi.length > 0) return multi;

  const single = String(process.env.GEMINI_API_KEY || '').trim();
  return single ? [single] : [];
}

router.use(requireAuth);

const SECCIONES_ESTANDAR = [
  'Fruteria y Verduleria',
  'Carniceria',
  'Pescaderia',
  'Lacteos y Huevos',
  'Panaderia',
  'Despensa y Conservas',
  'Congelados',
  'Bebidas',
  'Otros'
];

const EMOJI_POR_PALABRA = [
  { regex: /(tomate|cebolla|zanahoria|lechuga|patata|papa|ajo|pepino|pimiento|brocoli|espinaca|fruta|manzana|platano|banana|lima|limon|naranja|aguacate)/i, emoji: '🥬' },
  { regex: /(pollo|ternera|cerdo|carne|jamon|pavo|chuleta|salchicha)/i, emoji: '🥩' },
  { regex: /(atun|salmon|merluza|bacalao|pescado|gamba|langostino|marisco)/i, emoji: '🐟' },
  { regex: /(leche|queso|yogur|yogurt|huevo|nata|mantequilla)/i, emoji: '🧀' },
  { regex: /(pan|barra|hogaza|baguette|mollete|tostada)/i, emoji: '🍞' },
  { regex: /(arroz|pasta|fideo|lenteja|garbanzo|alubia|frijol|harina|aceite|vinagre|azucar|sal|salsa|tomate triturado)/i, emoji: '🥫' },
  { regex: /(helado|congelado)/i, emoji: '🧊' },
  { regex: /(agua|zumo|jugo|refresco|bebida|cafe|te)/i, emoji: '🥤' }
];

function normalizarCategoria(categoria) {
  const c = String(categoria || '').toLowerCase();

  if (/fruta|verdura|hortaliza|fruter|verduler/i.test(c)) return 'Fruteria y Verduleria';
  if (/carn|charcut|embutid/i.test(c)) return 'Carniceria';
  if (/pesc|marisc/i.test(c)) return 'Pescaderia';
  if (/lact|huevo|queso/i.test(c)) return 'Lacteos y Huevos';
  if (/pan|bolleri|pasteler/i.test(c)) return 'Panaderia';
  if (/despensa|conserva|seco|arroz|pasta|legumbre|aceite|salsa|especia/i.test(c)) return 'Despensa y Conservas';
  if (/congel/i.test(c)) return 'Congelados';
  if (/bebida|refresco|zumo|agua/i.test(c)) return 'Bebidas';

  return 'Otros';
}

function categoriaDesdeNombre(nombre) {
  const n = String(nombre || '').toLowerCase();

  if (/(tomate|cebolla|zanahoria|lechuga|patata|papa|ajo|pepino|pimiento|brocoli|espinaca|fruta|manzana|platano|banana|lima|limon|naranja|aguacate)/i.test(n)) {
    return 'Fruteria y Verduleria';
  }
  if (/(pollo|ternera|cerdo|carne|jamon|pavo|chuleta|salchicha)/i.test(n)) return 'Carniceria';
  if (/(atun|salmon|merluza|bacalao|pescado|gamba|langostino|marisco)/i.test(n)) return 'Pescaderia';
  if (/(leche|queso|yogur|yogurt|huevo|nata|mantequilla)/i.test(n)) return 'Lacteos y Huevos';
  if (/(pan|barra|hogaza|baguette|mollete|tostada)/i.test(n)) return 'Panaderia';
  if (/(arroz|pasta|fideo|lenteja|garbanzo|alubia|frijol|harina|aceite|vinagre|azucar|sal|salsa|tomate triturado|pimienta|pimenton|oregano|comino|hierbas|especia)/i.test(n)) return 'Despensa y Conservas';
  if (/(helado|congelado)/i.test(n)) return 'Congelados';
  if (/(agua|zumo|jugo|refresco|bebida|cafe|te)/i.test(n)) return 'Bebidas';

  return 'Otros';
}

function emojiDesdeNombre(nombre) {
  const n = String(nombre || '');
  const match = EMOJI_POR_PALABRA.find((r) => r.regex.test(n));
  return match ? match.emoji : '🛒';
}

function extraerArrayJson(texto) {
  const limpio = String(texto || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    return JSON.parse(limpio);
  } catch {
    const ini = limpio.indexOf('[');
    const fin = limpio.lastIndexOf(']');
    if (ini !== -1 && fin !== -1 && fin > ini) {
      const posibleArray = limpio.slice(ini, fin + 1);
      return JSON.parse(posibleArray);
    }
    throw new Error('No se pudo extraer JSON de la respuesta');
  }
}

function normalizarSalida(lista) {
  const porSeccion = {};
  SECCIONES_ESTANDAR.forEach((s) => {
    porSeccion[s] = [];
  });

  (Array.isArray(lista) ? lista : []).forEach((bloque) => {
    const categoriaRaw = bloque?.categoria || 'Otros';
    const seccion = normalizarCategoria(categoriaRaw);
    const productos = Array.isArray(bloque?.productos) ? bloque.productos : [];

    productos.forEach((p) => {
      const nombre = String(p?.nombre || '').trim();
      if (!nombre) return;
      porSeccion[seccion].push({
        nombre,
        cantidad_aproximada: String(p?.cantidad_aproximada || '1 unidad'),
        emoji: String(p?.emoji || emojiDesdeNombre(nombre))
      });
    });
  });

  return SECCIONES_ESTANDAR
    .map((seccion) => ({ categoria: seccion, productos: porSeccion[seccion] }))
    .filter((bloque) => bloque.productos.length > 0);
}

function limpiarNombreIngrediente(texto) {
  const t = String(texto || '').toLowerCase();
  const sinParentesis = t.replace(/\([^)]*\)/g, ' ');
  const sinCantidades = sinParentesis
    .replace(/\d+[\d\s\/.]*\s?(kg|g|gr|gramos|ml|l|litros|cucharadas?|cucharaditas?|tazas?|unidades?|uds?)?/gi, ' ')
    .replace(/\b(de|la|el|los|las|al|a|y|con|para|opcional|optional|fresh|fresco|fresca|finamente|picado|picada)\b/gi, ' ')
    .replace(/[^a-zA-Z\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return sinCantidades.split(' ').slice(0, 3).join(' ').trim();
}

function construirFallback(pendientes, inventario) {
  const inventarioTxt = inventario.map((i) => String(i.nombre || '').toLowerCase());
  const contador = {};

  pendientes
    .flatMap((r) => Array.isArray(r.extendedIngredients) ? r.extendedIngredients : [])
    .forEach((ing) => {
      const base = limpiarNombreIngrediente(ing?.name || ing?.original || '');
      if (!base) return;

      const yaEnInventario = inventarioTxt.some((item) => item.includes(base) || base.includes(item));
      if (yaEnInventario) return;

      contador[base] = (contador[base] || 0) + 1;
    });

  const porSeccion = {};
  SECCIONES_ESTANDAR.forEach((s) => {
    porSeccion[s] = [];
  });

  Object.entries(contador).forEach(([nombre, veces]) => {
    const categoria = categoriaDesdeNombre(nombre);
    porSeccion[categoria].push({
      nombre,
      cantidad_aproximada: `${veces} unidad${veces > 1 ? 'es' : ''}`,
      emoji: emojiDesdeNombre(nombre)
    });
  });

  return SECCIONES_ESTANDAR
    .map((categoria) => ({ categoria, productos: porSeccion[categoria] }))
    .filter((bloque) => bloque.productos.length > 0);
}

async function generarConFallback(prompt) {
  let ultimoError = null;
  const apiKeys = obtenerGeminiApiKeys();

  if (apiKeys.length === 0) {
    throw new Error('Falta la API KEY de Gemini en el servidor');
  }

  for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex += 1) {
    const client = new GoogleGenerativeAI(apiKeys[keyIndex]);

    for (const modelName of MODELOS_GEMINI) {
      try {
        const model = client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        return result.response.text();
      } catch (error) {
        ultimoError = error;
        const msg = String(error?.message || error || '');
        console.warn('Error modelo', modelName, 'key', keyIndex + 1, msg);
        if (/429\s+Too\s+Many\s+Requests|Quota exceeded/i.test(msg)) {
          break;
        }
      }
    }
  }

  throw ultimoError || new Error('No se ha podido contactar con Gemini');
}

async function guardarTicketIA(lista, pendientes, userId) {
  const articulos = (Array.isArray(lista) ? lista : []).flatMap((bloque) => {
    const categoria = bloque?.categoria || 'Otros';
    const productos = Array.isArray(bloque?.productos) ? bloque.productos : [];
    return productos.map((p) => ({
      nombre: String(p?.nombre || ''),
      cantidad: String(p?.cantidad_aproximada || '1 unidad'),
      precio: 0,
      categoria,
      emoji: String(p?.emoji || '🛒')
    }));
  }).filter((a) => a.nombre);

  if (articulos.length === 0) return null;

  const ticket = new Historial({
    user_id: userId,
    titulo: `Compra Inteligente - ${pendientes.length} recetas`,
    tipo: 'ticket_ia',
    origen: 'compra-inteligente',
    total: 0,
    articulos
  });

  await ticket.save();
  return ticket;
}

router.post('/generar', async (req, res) => {
  try {
    const userId = req.user.id;
    const pendientes = await RecetaPendiente.find({ user_id: userId });
    const inventario = await Alimento.find({ user_id: userId });

    if (pendientes.length === 0) {
      return res.status(200).json({ lista: [], ticketId: null });
    }

    const todosIngredientesNecesarios = pendientes
      .flatMap(r => (r.extendedIngredients || []).map(ing => ing.original || ing.name || ''))
      .filter(ing => ing.length > 0)
      .join('; ');

    const inventarioActual = inventario
      .map(item => item.nombre)
      .join(', ');

    if (obtenerGeminiApiKeys().length === 0) {
      const listaFallback = construirFallback(pendientes, inventario);
      const ticket = await guardarTicketIA(listaFallback, pendientes, userId);
      return res.status(200).json({ lista: listaFallback, ticketId: ticket?._id || null });
    }

    const prompt = `
    Eres un experto en gestion de cocinas. Ayudame a hacer la lista de la compra.
    
    RECETAS QUE VOY A HACER:
    ${todosIngredientesNecesarios}

    LO QUE YA TENGO EN MI DESPENSA (No lo incluyas en la lista):
    ${inventarioActual || 'Nada, esta vacia'}

    INSTRUCCIONES:
    1. Mira que me falta segun las recetas.
    2. Suma las cantidades si se repiten ingredientes.
    3. Devuelve solo un array JSON con categorias, productos y emojis.
    4. Categorias validas: Fruteria y Verduleria, Carniceria, Pescaderia, Lacteos y Huevos, Panaderia, Despensa y Conservas, Congelados, Bebidas, Otros.

    FORMATO JSON:
    [
      {
        "categoria": "Nombre Categoria",
        "productos": [
          { "nombre": "Producto", "cantidad_aproximada": "2 unidades", "emoji": "🍎" }
        ]
      }
    ]`;

    try {
      const responseText = await generarConFallback(prompt);

      const listaParseada = extraerArrayJson(responseText);
      const listaNormalizada = normalizarSalida(listaParseada);

      if (!Array.isArray(listaNormalizada) || listaNormalizada.length === 0) {
        const listaFallback = construirFallback(pendientes, inventario);
        const ticket = await guardarTicketIA(listaFallback, pendientes, userId);
        return res.status(200).json({ lista: listaFallback, ticketId: ticket?._id || null });
      }

      const ticket = await guardarTicketIA(listaNormalizada, pendientes, userId);
      return res.status(200).json({ lista: listaNormalizada, ticketId: ticket?._id || null });
    } catch (iaError) {
      console.warn('Gemini falló, usando fallback:', iaError.message);
      const listaFallback = construirFallback(pendientes, inventario);
      const ticket = await guardarTicketIA(listaFallback, pendientes, userId);
      return res.status(200).json({ lista: listaFallback, ticketId: ticket?._id || null });
    }
  } catch (error) {
    console.error('Error en compra inteligente:', error);
    res.status(500).json({
      mensaje: 'No hemos podido generar la lista en este momento.',
      error: error.message
    });
  }
});

module.exports = router;
