const express = require('express');
const Alimento = require('../models/Alimento');
const Perfil = require('../models/Perfil');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const jwt = require('jsonwebtoken');
const { getAppSettings } = require('../services/appSettings');
const { obtenerJwtSecret } = require('../utils/jwt');

const router = express.Router();

const recetasEnCache = new Map();

const IMAGEN_FALLBACK_FIJA = 'https://images.unsplash.com/photo-1495521821757-a1efb6729352?w=500';
const IMAGEN_FALLBACK_SEGURA = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900';
const RECETAS_IA_MIN_DEFAULT = 3;
const RECETAS_IA_MAX_DEFAULT = 9;
const RECETAS_IA_DEFAULT_DEFAULT = 9;
const HF_IMAGE_MODEL = String(process.env.HF_IMAGE_MODEL || 'black-forest-labs/FLUX.1-dev').trim();

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

async function generarConFallback(prompt) {
  let ultimoError = null;
  const apiKeys = obtenerGeminiApiKeys();

  if (apiKeys.length === 0) {
    throw new Error('No hay ninguna GEMINI_API_KEY configurada en el servidor');
  }

  for (let keyIndex = 0; keyIndex < apiKeys.length; keyIndex += 1) {
    const client = new GoogleGenerativeAI(apiKeys[keyIndex]);

    for (const modelName of MODELOS_GEMINI) {
      try {
        const model = client.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const respuesta = result.response.text();
        return respuesta;
        } catch (error) {
        ultimoError = error;
        const msg = String(error?.message || error || '');
        console.error('Error modelo', modelName, 'key', keyIndex + 1, msg);

        if (/429\s+Too\s+Many\s+Requests|Quota exceeded/i.test(msg)) {
          break;
        }
      }
    }
  }

  throw ultimoError || new Error('No se ha podido generar la receta con ninguna de las claves de Gemini');
}

function extraerJsonArray(texto) {
  const sinMarkdown = texto.replace(/```json/gi, '').replace(/```/g, '').trim();
  const inicio = sinMarkdown.indexOf('[');
  const fin = sinMarkdown.lastIndexOf(']');

  if (inicio === -1 || fin === -1 || fin < inicio) {
    throw new Error('Respuesta de Gemini sin array JSON válido.');
  }

  return sinMarkdown.slice(inicio, fin + 1);
}

function capitalizar(texto) {
  return texto ? texto.charAt(0).toUpperCase() + texto.slice(1).toLowerCase() : '';
}

function generarIdNumerico(texto) {
  const input = String(texto || 'receta-ia');
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) + 100000;
}

function crearIdRecetaEstable(receta, indice) {
  const base = [
    String(receta?.title || ''),
    String(receta?.readyInMinutes || ''),
    String(receta?.servings || ''),
    String(indice || 0),
  ].join('|');

  return generarIdNumerico(base);
}

function limpiarTextoBusqueda(texto) {
  return String(texto || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizarCantidadRecetas(valor, limites) {
  const min = Number(limites?.min) || RECETAS_IA_MIN_DEFAULT;
  const max = Number(limites?.max) || RECETAS_IA_MAX_DEFAULT;
  const def = Number(limites?.def) || RECETAS_IA_DEFAULT_DEFAULT;
  const numero = Number.parseInt(String(valor ?? ''), 10);
  if (!Number.isFinite(numero)) return def;
  return Math.max(min, Math.min(max, numero));
}

function obtenerHfApiToken() {
  return String(process.env.HF_API_TOKEN || process.env.HUGGINGFACE_API_TOKEN || '').trim();
}

function construirPlaceholderPorTexto(textoBase, indice) {
  const etiquetaRaw = String(textoBase || `Receta ${indice + 1}`).trim();
  const etiqueta = etiquetaRaw.length > 42 ? `${etiquetaRaw.slice(0, 39)}...` : etiquetaRaw;
  const fondo = 'F7F3EA';
  const texto = '6C5A49';
  return `https://placehold.co/1200x800/${fondo}/${texto}?text=${encodeURIComponent(etiqueta)}&font=montserrat`;
}

function construirImagenReceta(receta, indice) {
  const titulo = String(receta?.title || `Receta ${indice + 1}`);
  return construirPlaceholderPorTexto(titulo, indice);
}

function construirRecetaFallback(id, titulo, usados, faltantes, minutos, pasosBase) {
  return {
    id,
    title: titulo,
    image: construirImagenReceta(
      {
        title: titulo,
        usedIngredients: usados.map((name) => ({ name })),
        missedIngredients: faltantes.map((name) => ({ name })),
      },
      id
    ),
    usedIngredientCount: usados.length,
    missedIngredientCount: faltantes.length,
    usedIngredients: usados.map((item) => ({ name: item })),
    missedIngredients: faltantes.map((item) => ({ name: item })),
    readyInMinutes: minutos,
    servings: 2,
    extendedIngredients: [
      ...usados.map((item) => ({ original: `1 porcion de ${item}` })),
      ...faltantes.map((item) => ({ original: `Opcional: ${item}` })),
    ],
    analyzedInstructions: [
      {
        steps: pasosBase.map((step, index) => ({ number: index + 1, step })),
      },
    ],
  };
}

function generarFallbackRecetas(
  inventarioNombres,
  cantidadObjetivo = RECETAS_IA_DEFAULT_DEFAULT,
  limites = { min: RECETAS_IA_MIN_DEFAULT, max: RECETAS_IA_MAX_DEFAULT }
) {
  const base = inventarioNombres.slice(0, 4).map((n) => n.toLowerCase());
  const principal = base.length > 0 ? base[0] : 'ingredientes de temporada';
  const secundario = base.length > 1 ? base[1] : 'verduras';

  const plantillas = [
    {
      clave: 'salteado',
      titulo: `Salteado rapido de ${capitalizar(principal)} y ${capitalizar(secundario)}`,
      faltantes: ['aceite de oliva', 'sal'],
      minutos: 20,
      pasos: [
        'Lava y corta los ingredientes principales en trozos medianos.',
        'Calienta una sarten con aceite de oliva y anade los ingredientes de la despensa.',
        'Cocina a fuego medio removiendo y ajusta con sal al final.',
      ],
    },
    {
      clave: 'crema',
      titulo: `Crema casera de ${capitalizar(principal)}`,
      faltantes: ['ajo', 'pimienta negra'],
      minutos: 30,
      pasos: [
        'Sofrie ajo picado con una cucharada de aceite.',
        'Incorpora los ingredientes principales y cocina 5 minutos.',
        'Anade agua, cocina 15 minutos y tritura hasta obtener una crema.',
      ],
    },
    {
      clave: 'ensalada',
      titulo: `Ensalada templada de ${capitalizar(principal)}`,
      faltantes: ['limon', 'hierbas secas'],
      minutos: 15,
      pasos: [
        'Prepara una base con los ingredientes de la despensa cortados finos.',
        'Alina con limon, aceite e hierbas secas.',
        'Mezcla bien y sirve al momento.',
      ],
    },
    {
      clave: 'tortilla',
      titulo: `Tortilla jugosa de ${capitalizar(principal)} al horno`,
      faltantes: ['huevo', 'cebolla'],
      minutos: 25,
      pasos: [
        'Saltea los ingredientes principales con cebolla hasta que esten tiernos.',
        'Bate los huevos, mezcla y vierte en molde apto para horno.',
        'Hornea hasta cuajar y sirve caliente.',
      ],
    },
    {
      clave: 'wok',
      titulo: `Wok aromatico de ${capitalizar(principal)} y ${capitalizar(secundario)}`,
      faltantes: ['salsa de soja', 'jengibre'],
      minutos: 18,
      pasos: [
        'Corta fino los ingredientes de la despensa.',
        'Saltea en wok muy caliente con jengibre rallado.',
        'Anade salsa de soja y cocina 2 minutos mas.',
      ],
    },
    {
      clave: 'guiso',
      titulo: `Guiso suave de ${capitalizar(principal)} con especias`,
      faltantes: ['pimenton', 'caldo vegetal'],
      minutos: 35,
      pasos: [
        'Rehoga los ingredientes con pimenton en una olla.',
        'Cubre con caldo vegetal y cocina a fuego bajo.',
        'Rectifica de sal y deja reposar antes de servir.',
      ],
    },
    {
      clave: 'pasta',
      titulo: `Pasta ligera con salsa de ${capitalizar(principal)}`,
      faltantes: ['pasta', 'albahaca'],
      minutos: 22,
      pasos: [
        'Cuece la pasta al dente en agua con sal.',
        'Tritura parte de los ingredientes principales para crear la salsa.',
        'Mezcla pasta y salsa, termina con albahaca.',
      ],
    },
    {
      clave: 'arroz',
      titulo: `Arroz meloso de ${capitalizar(principal)} y verduras`,
      faltantes: ['arroz', 'caldo'],
      minutos: 32,
      pasos: [
        'Sofrie los ingredientes de la despensa.',
        'Anade arroz y nacara un minuto.',
        'Incorpora caldo poco a poco hasta lograr textura melosa.',
      ],
    },
    {
      clave: 'tacos',
      titulo: `Tacos caseros de ${capitalizar(principal)} especiado`,
      faltantes: ['tortillas', 'comino'],
      minutos: 20,
      pasos: [
        'Cocina el relleno con especias hasta dorar.',
        'Calienta tortillas en sarten.',
        'Rellena, termina con los ingredientes frescos y sirve.',
      ],
    },
  ];

  const limiteMin = Number(limites?.min) || RECETAS_IA_MIN_DEFAULT;
  const limiteMax = Number(limites?.max) || RECETAS_IA_MAX_DEFAULT;
  const limite = Math.max(limiteMin, Math.min(limiteMax, cantidadObjetivo));
  return plantillas.slice(0, limite).map((plantilla, index) => {
    const id = generarIdNumerico(`fallback|${principal}|${secundario}|${plantilla.clave}|${index}`);
    return construirRecetaFallback(
      id,
      plantilla.titulo,
      base,
      plantilla.faltantes,
      plantilla.minutos,
      plantilla.pasos
    );
  });
}

function normalizarReceta(receta, indice) {
  const usedCount = Number(receta.usedIngredientCount) || 0;
  const missedCount = Number(receta.missedIngredientCount) || 0;
  const imagenFinal = construirImagenReceta(receta, indice);

  return {
    id: crearIdRecetaEstable(receta, indice),
    title: receta.title || `Receta ${indice + 1}`,
    image: imagenFinal || IMAGEN_FALLBACK_SEGURA,
    usedIngredientCount: usedCount,
    missedIngredientCount: missedCount,
    usedIngredients: Array.isArray(receta.usedIngredients)
      ? receta.usedIngredients
      : Array.from({ length: usedCount }, () => ({})),
    missedIngredients: Array.isArray(receta.missedIngredients)
      ? receta.missedIngredients
      : Array.from({ length: missedCount }, () => ({})),
    readyInMinutes: Number(receta.readyInMinutes) || 20,
    servings: Number(receta.servings) || 2,
    extendedIngredients: Array.isArray(receta.extendedIngredients) ? receta.extendedIngredients : [],
    analyzedInstructions: Array.isArray(receta.analyzedInstructions) ? receta.analyzedInstructions : [],
  };
}

function obtenerIngredientesProhibidos(alergias) {
  const prohibidos = new Set();

  alergias.forEach((alergia) => {
    const texto = (alergia || '').toLowerCase();

    if (texto.includes('gluten') || texto.includes('celiaco')) {
      ['trigo', 'harina', 'pan', 'pasta', 'cebada', 'centeno'].forEach((item) => prohibidos.add(item));
    }
    if (texto.includes('lactosa')) {
      ['leche', 'queso', 'mantequilla', 'nata', 'crema', 'yogur'].forEach((item) => prohibidos.add(item));
    }
    if (texto.includes('marisco')) {
      ['gamba', 'camaron', 'langostino', 'mejillon', 'calamar', 'pulpo'].forEach((item) => prohibidos.add(item));
    }
    if (texto.includes('frutos secos')) {
      ['almendra', 'nuez', 'avellana', 'pistacho', 'cacahuete', 'mani'].forEach((item) => prohibidos.add(item));
    }
    if (texto.includes('vegano')) {
      ['carne', 'pollo', 'pescado', 'huevo', 'leche', 'queso', 'mantequilla', 'miel'].forEach((item) => prohibidos.add(item));
    }
    if (texto.includes('vegetariano')) {
      ['carne', 'pollo', 'pescado', 'jamon', 'chorizo'].forEach((item) => prohibidos.add(item));
    }
  });

  return [...prohibidos];
}

function incluyeIngredienteProhibido(nombre, prohibidos) {
  const texto = (nombre || '').toLowerCase();
  return prohibidos.some((item) => texto.includes(item));
}

function extraerTagsComidaDesdePrompt(prompt) {
  const tokens = limpiarTextoBusqueda(prompt)
    .split(' ')
    .filter(Boolean)
    .filter((token) => token.length > 2)
    .filter((token) => !['plato', 'comida', 'fotografia', 'realista', 'fondo', 'limpio', 'texto', 'sin', 'luz', 'natural'].includes(token));

  const base = ['food', 'meal', ...tokens.slice(0, 3)];
  return base.join(',');
}

function extraerQueryUnsplashDesdePrompt(prompt) {
  const tags = extraerTagsComidaDesdePrompt(prompt)
    .split(',')
    .filter(Boolean)
    .slice(0, 4);

  return tags.length > 0 ? tags.join(',') : 'food,recipe,dish';
}

async function fetchImagenBuffer(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.toLowerCase().startsWith('image/')) return null;
    const arrayBuffer = await response.arrayBuffer();
    return {
      contentType,
      buffer: Buffer.from(arrayBuffer),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchImagenHuggingFace(prompt, seed) {
  const token = obtenerHfApiToken();
  if (!token) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(`https://api-inference.huggingface.co/models/${encodeURIComponent(HF_IMAGE_MODEL)}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: prompt,
        options: { wait_for_model: true, use_cache: false },
        parameters: {
          width: 1200,
          height: 800,
          seed,
          guidance_scale: 7.5,
          num_inference_steps: 24,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) return null;
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) return null;
    const arrayBuffer = await response.arrayBuffer();
    return {
      contentType,
      buffer: Buffer.from(arrayBuffer),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function obtenerContextoUsuarioDesdeToken(req) {
  try {
    const authHeader = String(req.headers.authorization || '');
    if (!authHeader.startsWith('Bearer ')) return { userId: null, perfil: null };

    const token = authHeader.slice(7).trim();
    const secret = obtenerJwtSecret();
    const payload = jwt.verify(token, secret);
    const userId = String(payload?.sub || '');
    if (!userId) return { userId: null, perfil: null };

    const perfil = await Perfil.findOne({ user_id: userId });
    return { userId, perfil };
  } catch {
    return { userId: null, perfil: null };
  }
}

router.get('/sugerencias', async (req, res) => {
  try {
    let limitesIA = {
      min: RECETAS_IA_MIN_DEFAULT,
      max: RECETAS_IA_MAX_DEFAULT,
      def: RECETAS_IA_DEFAULT_DEFAULT,
    };

    try {
      const appSettings = await getAppSettings();
      limitesIA = {
        min: Number(appSettings?.recetasIaMin) || RECETAS_IA_MIN_DEFAULT,
        max: Number(appSettings?.recetasIaMax) || RECETAS_IA_MAX_DEFAULT,
        def: Number(appSettings?.recetasIaDefault) || RECETAS_IA_DEFAULT_DEFAULT,
      };
    } catch {
      limitesIA = {
        min: RECETAS_IA_MIN_DEFAULT,
        max: RECETAS_IA_MAX_DEFAULT,
        def: RECETAS_IA_DEFAULT_DEFAULT,
      };
    }

    const cantidadObjetivo = normalizarCantidadRecetas(
      req.query.total || req.query.cantidad || req.query.count,
      limitesIA
    );
    const { userId, perfil } = await obtenerContextoUsuarioDesdeToken(req);
    const filtroInventario = userId ? { user_id: userId } : { _id: null };
    const inventario = await Alimento.find(filtroInventario);

    if (inventario.length === 0) {
      ultimasRecetasIA = [];
      return res.status(200).json([]);
    }

    const inventarioNombres = inventario
      .map((item) => (item.nombre || '').trim())
      .filter(Boolean);

    const alergias = Array.isArray(perfil?.alergias) ? perfil.alergias : [];
    const textoAlergias = alergias.length > 0 ? alergias.join(', ') : 'Ninguna';

    const ingredientesProhibidos = obtenerIngredientesProhibidos(alergias);
    const inventarioFiltrado = inventarioNombres.filter(
      (item) => !incluyeIngredienteProhibido(item, ingredientesProhibidos)
    );

    if (inventarioFiltrado.length === 0) {
      ultimasRecetasIA = [];
      return res.status(200).json([]);
    }

    const listaIngredientes = inventarioFiltrado.join(', ');

    const prompt = `
Eres un chef experto. Tengo estos ingredientes en mi despensa: ${listaIngredientes}.
RESTRICCIONES ALIMENTARIAS Y ALERGIAS DEL USUARIO: ${textoAlergias}.
ESTA ESTRICTAMENTE PROHIBIDO incluir ingredientes que violen estas restricciones. Si un ingrediente no es apto, sustituyelo por una alternativa segura.
Genera ${cantidadObjetivo} recetas creativas y reales que aprovechen estos ingredientes. Puedes anadir ingredientes basicos extra si es necesario, respetando siempre las alergias.
Devuelve UNICAMENTE un array JSON valido, sin comillas invertidas ni texto markdown extra.
Cada objeto del array debe tener esta estructura exacta:
[
  {
    "id": (un numero entero aleatorio y unico),
    "title": "Nombre de la receta apetecible en espanol",
    "image": "URL de imagen del plato acorde al titulo, o cadena vacia si no tienes una URL fiable",
    "usedIngredientCount": (numero de ingredientes de mi despensa que has usado),
    "missedIngredientCount": (numero de ingredientes nuevos que me faltan),
    "readyInMinutes": (tiempo estimado en minutos),
    "servings": (numero de raciones),
    "extendedIngredients": [ { "original": "cantidad y nombre del ingrediente en espanol" } ],
    "analyzedInstructions": [ { "steps": [ { "number": 1, "step": "Instruccion del paso 1..." } ] } ]
  }
]`;

    let recetasGeneradas = [];

    try {
      const responseText = await generarConFallback(prompt);
      const cleanJson = extraerJsonArray(responseText);
      recetasGeneradas = JSON.parse(cleanJson);
    } catch (geminiError) {
      console.error('Gemini falló o no hay cuota — uso fallback local.');
      recetasGeneradas = generarFallbackRecetas(inventarioFiltrado, cantidadObjetivo, limitesIA);
    }

    const normalizadas = Array.isArray(recetasGeneradas)
      ? recetasGeneradas.map((receta, index) => normalizarReceta(receta, index))
      : [];

    if (normalizadas.length < cantidadObjetivo) {
      const titulosExistentes = new Set(normalizadas.map((r) => limpiarTextoBusqueda(r.title)));
      const fallbackExtra = generarFallbackRecetas(inventarioFiltrado, cantidadObjetivo, limitesIA)
        .map((receta, index) => normalizarReceta(receta, index + 500))
        .filter((receta) => {
          const key = limpiarTextoBusqueda(receta.title);
          if (titulosExistentes.has(key)) return false;
          titulosExistentes.add(key);
          return true;
        });

      normalizadas.push(...fallbackExtra);
    }

    const resultadoFinal = normalizadas.slice(0, cantidadObjetivo);

    if (userId) {
      recetasEnCache.set(userId, resultadoFinal);
    }

    return res.status(200).json(resultadoFinal);
  } catch (error) {
    console.error('Error general al generar recetas:', error);
    return res.status(500).json({ mensaje: 'Vaya, parece que el chef esta ocupado. Intentalo de nuevo en un rato.' });
  }
});

router.get('/imagen', async (req, res) => {
  try {
    const titleRaw = String(req.query.title || '').trim();
    const seedRaw = Number(req.query.seed);
    const seed = Number.isFinite(seedRaw) ? Math.abs(Math.floor(seedRaw)) % 1000000 : 12345;
    return res.redirect(construirPlaceholderPorTexto(titleRaw || 'Receta Inventia', seed));
  } catch (error) {
    console.error('Error al servir imagen IA:', error?.message || error);
    const titleRaw = String(req.query.title || '').trim();
    const seedRaw = Number(req.query.seed);
    const seed = Number.isFinite(seedRaw) ? Math.abs(Math.floor(seedRaw)) % 1000000 : 12345;
    return res.redirect(construirPlaceholderPorTexto(titleRaw || 'Receta Inventia', seed));
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { userId } = await obtenerContextoUsuarioDesdeToken(req);
    const idReceta = parseInt(req.params.id, 10);
    
    const misRecetas = recetasEnCache.get(userId) || [];
    const receta = misRecetas.find((item) => item.id === idReceta);

    if (!receta) {
      return res.status(404).json({ mensaje: 'No hemos encontrado esa receta. Prueba a generarla de nuevo.' });
    }

    return res.status(200).json(receta);
  } catch (error) {
    console.error('Error al buscar el detalle IA:', error);
    return res.status(500).json({ mensaje: 'Error al obtener los pasos de la receta IA' });
  }
});

module.exports = router;
