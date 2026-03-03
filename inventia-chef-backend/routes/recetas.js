const express = require('express');
const translateLib = require('translate');
const Alimento = require('../models/Alimento');
const requireAuth = require('../middleware/requireAuth');
const {
  getSpoonacularBloqueadoHasta,
  setSpoonacularBloqueadoHasta,
  isSpoonacularBloqueado,
} = require('../services/integrationState');
const { getAppSettings } = require('../services/appSettings');

const router = express.Router();
const translate = typeof translateLib === 'function' ? translateLib : translateLib.default;
const RECETAS_CLASICAS_MAX_DEFAULT = 9;

router.use(requireAuth);
translate.engine = 'google';

// Recetas de backup por usuario
const recetasBackupPorUsuario = new Map();

// Limpia los titulos que llegan raros de la API
const limpiarTituloReceta = (titulo) => {
  if (!titulo || typeof titulo !== 'string') return 'Receta';

  let limpio = titulo.trim();

  // Quitar palabras comunes en ingles
  limpio = limpio.replace(/^(what to make for dinner tonight\??:?\s*)/i, '');
  limpio = limpio.replace(/^(easy\s+)/i, '');
  limpio = limpio.replace(/^(quick\s+)/i, '');
  limpio = limpio.replace(/^(simple\s+)/i, '');
  limpio = limpio.replace(/^\?+\s*/i, '');
  limpio = limpio.replace(/^["']+\s*/i, '');

  // Quitar espacios repetidos
  limpio = limpio.replace(/\s+/g, ' ').trim();

  // Limitar largo del titulo
  if (limpio.length > 60) {
    limpio = limpio.substring(0, 57) + '...';
  }

  // Capitalizar la primera letra
  limpio = limpio
    .split(' ')
    .map((word) => {
      if (word.length > 1) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }
      return word.toUpperCase();
    })
    .join(' ');

  return limpio || 'Receta';
};

const CATALOGO_FALLBACK_BASE = [
  {
    id: 910001,
    title: 'Tortilla de tomate y cebolla',
    image: 'https://images.unsplash.com/photo-1510693206972-df098062cb71?w=900',
    pantryCandidates: ['tomate', 'cebolla', 'huevo'],
    extraIngredients: ['aceite de oliva', 'sal'],
    minutes: 20,
    servings: 2,
    steps: [
      'Pica tomate y cebolla en cubos pequenos.',
      'Bate los huevos con una pizca de sal.',
      'Sofrie cebolla y tomate, agrega huevo y cocina hasta cuajar.',
    ],
  },
  {
    id: 910002,
    title: 'Salteado rapido de verduras',
    image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?w=900',
    pantryCandidates: ['calabacin', 'pimiento', 'cebolla', 'zanahoria'],
    extraIngredients: ['aceite de oliva', 'sal', 'pimienta'],
    minutes: 18,
    servings: 2,
    steps: [
      'Corta las verduras en tiras del mismo tamano.',
      'Calienta aceite y saltea a fuego alto 6-8 minutos.',
      'Ajusta con sal y pimienta antes de servir.',
    ],
  },
  {
    id: 910003,
    title: 'Pasta con tomate y queso',
    image: 'https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?w=900',
    pantryCandidates: ['pasta', 'tomate', 'queso'],
    extraIngredients: ['ajo', 'aceite de oliva', 'oregano'],
    minutes: 22,
    servings: 2,
    steps: [
      'Cuece la pasta en agua con sal hasta que este al dente.',
      'Prepara una salsa con tomate y ajo en sarten.',
      'Mezcla pasta, salsa y queso rallado.',
    ],
  },
  {
    id: 910004,
    title: 'Ensalada de garbanzos',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900',
    pantryCandidates: ['garbanzos', 'tomate', 'pepino', 'cebolla'],
    extraIngredients: ['aceite de oliva', 'limon', 'sal'],
    minutes: 12,
    servings: 2,
    steps: [
      'Lava garbanzos cocidos y escurre bien.',
      'Mezcla con tomate, pepino y cebolla picados.',
      'Alina con limon, aceite y sal.',
    ],
  },
  {
    id: 910005,
    title: 'Arroz salteado con huevo',
    image: 'https://images.unsplash.com/photo-1603133872878-684f208fb84b?w=900',
    pantryCandidates: ['arroz', 'huevo', 'zanahoria', 'cebolla'],
    extraIngredients: ['salsa de soja', 'aceite'],
    minutes: 20,
    servings: 2,
    steps: [
      'Cocina el arroz y deja enfriar unos minutos.',
      'Saltea cebolla y zanahoria, agrega huevo batido.',
      'Incorpora el arroz y termina con salsa de soja.',
    ],
  },
  {
    id: 910006,
    title: 'Crema de calabaza casera',
    image: 'https://images.unsplash.com/photo-1547592180-85f173990554?w=900',
    pantryCandidates: ['calabaza', 'cebolla', 'patata'],
    extraIngredients: ['caldo vegetal', 'aceite de oliva', 'sal'],
    minutes: 30,
    servings: 3,
    steps: [
      'Sofrie cebolla y anade calabaza y patata troceadas.',
      'Cubre con caldo y cocina 20 minutos.',
      'Tritura hasta obtener una crema fina.',
    ],
  },
  {
    id: 910007,
    title: 'Lentejas estofadas rapidas',
    image: 'https://images.unsplash.com/photo-1516100882582-96c3a05fe590?w=900',
    pantryCandidates: ['lentejas', 'cebolla', 'zanahoria'],
    extraIngredients: ['pimenton', 'aceite de oliva', 'sal'],
    minutes: 35,
    servings: 3,
    steps: [
      'Sofrie cebolla y zanahoria picadas con aceite.',
      'Anade lentejas y cubre con agua.',
      'Cocina hasta que esten tiernas y ajusta con sal y pimenton.',
    ],
  },
  {
    id: 910008,
    title: 'Pollo al horno con verduras',
    image: 'https://images.unsplash.com/photo-1518492104633-130d0cc84637?w=900',
    pantryCandidates: ['pollo', 'patata', 'cebolla'],
    extraIngredients: ['aceite de oliva', 'romero', 'sal'],
    minutes: 40,
    servings: 3,
    steps: [
      'Corta patata y cebolla en trozos medianos.',
      'Coloca el pollo y las verduras en bandeja, alina con aceite y sal.',
      'Hornea hasta dorar y terminar de cocinar.',
    ],
  },
  {
    id: 910009,
    title: 'Revuelto de setas y huevo',
    image: 'https://images.unsplash.com/photo-1512058564366-18510be2db19?w=900',
    pantryCandidates: ['setas', 'huevo', 'ajo'],
    extraIngredients: ['aceite de oliva', 'perejil', 'sal'],
    minutes: 14,
    servings: 2,
    steps: [
      'Saltea ajo y setas a fuego medio-alto.',
      'Incorpora huevo batido y remueve hasta cuajar.',
      'Termina con perejil picado y una pizca de sal.',
    ],
  },
  {
    id: 910010,
    title: 'Cuscus con verduras salteadas',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=900',
    pantryCandidates: ['cuscus', 'pimiento', 'calabacin'],
    extraIngredients: ['aceite de oliva', 'limon', 'sal'],
    minutes: 16,
    servings: 2,
    steps: [
      'Hidrata el cuscus con agua caliente y sal.',
      'Saltea las verduras en sarten con aceite.',
      'Mezcla todo y termina con zumo de limon.',
    ],
  },
  {
    id: 910011,
    title: 'Merluza en sarten con ajo y limon',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=900',
    pantryCandidates: ['merluza', 'ajo', 'limon'],
    extraIngredients: ['aceite de oliva', 'perejil', 'sal'],
    minutes: 18,
    servings: 2,
    steps: [
      'Seca y sala los lomos de merluza.',
      'Cocina en sarten con aceite y ajo laminado.',
      'Anade limon y perejil al final para aromatizar.',
    ],
  },
  {
    id: 910012,
    title: 'Avena cremosa con fruta',
    image: 'https://images.unsplash.com/photo-1517673400267-0251440c45dc?w=900',
    pantryCandidates: ['avena', 'leche', 'platano'],
    extraIngredients: ['canela', 'miel'],
    minutes: 10,
    servings: 1,
    steps: [
      'Calienta la leche y anade avena poco a poco.',
      'Cocina removiendo hasta obtener textura cremosa.',
      'Sirve con platano, canela y un toque de miel.',
    ],
  },
];

function normalizarTexto(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function hayMatchIngrediente(aRaw, bRaw) {
  const a = normalizarTexto(aRaw);
  const b = normalizarTexto(bRaw);
  return a.includes(b) || b.includes(a);
}

function construirRecetaFallbackDeterminista(base, inventarioOriginal) {
  const todosLosIngredientes = [...base.pantryCandidates, ...base.extraIngredients];
  
  const usados = todosLosIngredientes.filter((candidate) =>
    inventarioOriginal.some((item) => hayMatchIngrediente(item, candidate))
  );

  const faltantes = todosLosIngredientes.filter(
    (candidate) => !usados.some((u) => hayMatchIngrediente(u, candidate))
  );
  const ingredientesReceta = [...base.pantryCandidates, ...base.extraIngredients];

  return {
    id: base.id,
    title: base.title,
    image: base.image,
    usedIngredientCount: usados.length,
    missedIngredientCount: faltantes.length,
    usedIngredients: usados.map((item) => ({ name: item })),
    missedIngredients: faltantes.map((item) => ({ name: item })),
    readyInMinutes: base.minutes,
    servings: base.servings,
    extendedIngredients: ingredientesReceta.map((item) => ({ original: `1 porcion de ${item}` })),
    analyzedInstructions: [
      {
        steps: base.steps.map((step, index) => ({ number: index + 1, step })),
      },
    ],
    localFallback: true,
  };
}

function crearVarianteRecetaFallback(recetaBase, indiceGlobal, ronda) {
  const sufijos = ['version chef', 'edicion casera', 'toque mediterraneo', 'modo rapido'];
  const sufijo = sufijos[indiceGlobal % sufijos.length];
  const minutosExtra = (indiceGlobal % 3) * 5;
  const idVariante = Number(recetaBase.id) + (ronda * 100000);

  return {
    ...recetaBase,
    id: idVariante,
    title: `${recetaBase.title} (${sufijo})`,
    readyInMinutes: Number(recetaBase.readyInMinutes || 0) + minutosExtra,
    analyzedInstructions: Array.isArray(recetaBase.analyzedInstructions)
      ? recetaBase.analyzedInstructions.map((bloque) => {
        const pasos = Array.isArray(bloque?.steps) ? [...bloque.steps] : [];
        return {
          ...bloque,
          steps: pasos,
        };
      })
      : [],
  };
}

function generarFallbackRecetas(inventarioNombres, maxRecetas = RECETAS_CLASICAS_MAX_DEFAULT) {
  const inventario = Array.isArray(inventarioNombres) ? inventarioNombres.filter(Boolean) : [];

  const rankeadas = CATALOGO_FALLBACK_BASE
    .map((base) => {
      const receta = construirRecetaFallbackDeterminista(base, inventario);
      const score = Number(receta.usedIngredientCount || 0);
      return { receta, score };
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.receta.id - b.receta.id;
    });

  const recetasBase = rankeadas.map((item) => item.receta);
  if (maxRecetas <= recetasBase.length) {
    return recetasBase.slice(0, maxRecetas);
  }

  const resultado = [...recetasBase];
  let indiceGlobal = 0;

  while (resultado.length < maxRecetas && recetasBase.length > 0) {
    const recetaOriginal = recetasBase[indiceGlobal % recetasBase.length];
    const ronda = Math.floor(indiceGlobal / recetasBase.length) + 1;
    resultado.push(crearVarianteRecetaFallback(recetaOriginal, indiceGlobal, ronda));
    indiceGlobal += 1;
  }

  return resultado.slice(0, maxRecetas);
}

function construirDetalleFallback(base) {
  return {
    id: base.id,
    title: base.title,
    image: base.image,
    readyInMinutes: base.minutes,
    servings: base.servings,
    extendedIngredients: [...base.pantryCandidates, ...base.extraIngredients].map((item) => ({
      original: `1 porcion de ${item}`,
      name: item,
    })),
    analyzedInstructions: [
      {
        steps: base.steps.map((step, index) => ({ number: index + 1, step })),
      },
    ],
    usedIngredientCount: base.pantryCandidates.length,
    missedIngredientCount: base.extraIngredients.length,
    usedIngredients: base.pantryCandidates.map((item) => ({ name: item })),
    missedIngredients: base.extraIngredients.map((item) => ({ name: item })),
    localFallback: true,
  };
}

function obtenerDetalleFallbackPorId(idSolicitado) {
  const base = CATALOGO_FALLBACK_BASE.find((item) => String(item.id) === String(idSolicitado));
  return base ? construirDetalleFallback(base) : null;
}

function calcularProximoResetDiario() {
  const ahora = new Date();
  const proximo = new Date(ahora);
  proximo.setHours(24, 0, 0, 0);
  return proximo.getTime();
}

function spoonacularSigueBloqueado() {
  return isSpoonacularBloqueado();
}

function marcarBloqueoCuotaSpoonacular() {
  setSpoonacularBloqueadoHasta(calcularProximoResetDiario());
}

router.get('/sugerencias', async (req, res) => {
  let recetasClasicasMax = RECETAS_CLASICAS_MAX_DEFAULT;

  try {
    try {
      const appSettings = await getAppSettings();
      recetasClasicasMax = Number(appSettings?.recetasClasicasMax) || RECETAS_CLASICAS_MAX_DEFAULT;
    } catch {
      // si falla, usamos el maximo por defecto
      recetasClasicasMax = RECETAS_CLASICAS_MAX_DEFAULT;
    }

    const userId = req.user.id;
    const inventario = await Alimento.find({ user_id: userId });
    if (inventario.length === 0) {
      recetasBackupPorUsuario.delete(userId);
      return res.status(200).json([]);
    }

    const ingredientes = inventario.map((item) => (item.nombre || '').trim()).filter(Boolean);

    if (!process.env.SPOONACULAR_API_KEY) {
      return res.status(503).json({
        codigo: 'SPOONACULAR_NOT_CONFIGURED',
        mensaje: 'SPOONACULAR_API_KEY no esta configurada en el backend.',
      });
    }

    if (spoonacularSigueBloqueado()) {
      const fallback = generarFallbackRecetas(ingredientes, recetasClasicasMax);
      recetasBackupPorUsuario.set(userId, fallback);
      res.set('X-Recetas-Source', 'fallback-quota-memory');
      return res.status(200).json(fallback);
    }

    const ingredientesEnIngles = await Promise.all(
      ingredientes.map(async (nombre) => {
        try {
          return await translate(nombre, 'en');
        } catch {
          return nombre;
        }
      })
    );

    const spoonacularUrl = `https://api.spoonacular.com/recipes/findByIngredients?ingredients=${encodeURIComponent(
      ingredientesEnIngles.join(',')
    )}&number=${recetasClasicasMax}&ranking=2&language=es&apiKey=${process.env.SPOONACULAR_API_KEY}`;

    const apiResponse = await fetch(spoonacularUrl);
    if (!apiResponse.ok) {
      const detalle = await apiResponse.text();
      console.error('Error Spoonacular /sugerencias:', apiResponse.status, detalle);

      if (apiResponse.status === 402 || apiResponse.status === 429) {
        marcarBloqueoCuotaSpoonacular();
        const fallback = generarFallbackRecetas(ingredientes, recetasClasicasMax);
        recetasBackupPorUsuario.set(userId, fallback);
        res.set('X-Recetas-Source', 'fallback-quota');
        return res.status(200).json(fallback);
      }

      return res.status(502).json({
        codigo: 'SPOONACULAR_UNAVAILABLE',
        mensaje: 'No se pudieron obtener recetas desde Spoonacular.',
      });
    }

    const recetas = await apiResponse.json();
    
    // Limpiar títulos de todas las recetas
    const recetasLimpias = recetas.map((receta) => ({
      ...receta,
      title: limpiarTituloReceta(receta.title),
    }));
    
    recetasBackupPorUsuario.delete(userId);
    res.set('X-Recetas-Source', 'spoonacular');
    return res.status(200).json(recetasLimpias);
  } catch (error) {
    console.error('Error en /api/recetas/sugerencias:', error);

    return res.status(500).json({
      codigo: 'RECETAS_INTERNAL_ERROR',
      mensaje: 'Error interno al obtener sugerencias.',
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const idSolicitado = String(req.params.id || '');
    const userId = req.user.id;

    // Miramos si la receta estaba en el backup de este usuario
    const misRecetasBackup = recetasBackupPorUsuario.get(userId) || [];
    const recetaFallback = misRecetasBackup.find((item) => String(item.id) === idSolicitado);
    if (recetaFallback) {
      return res.status(200).json(recetaFallback);
    }

    const detalleFallbackCatalogo = obtenerDetalleFallbackPorId(idSolicitado);
    if (detalleFallbackCatalogo) {
      return res.status(200).json(detalleFallbackCatalogo);
    }

    if (!process.env.SPOONACULAR_API_KEY) {
      return res.status(503).json({
        codigo: 'SPOONACULAR_NOT_CONFIGURED',
        mensaje: 'SPOONACULAR_API_KEY no esta configurada en el backend.',
      });
    }

    if (spoonacularSigueBloqueado()) {
      return res.status(503).json({
        codigo: 'SPOONACULAR_QUOTA_EXCEEDED',
        mensaje: 'La cuota de Spoonacular está agotada temporalmente.',
        disponible_desde: new Date(getSpoonacularBloqueadoHasta()).toISOString(),
      });
    }

    const spoonacularUrl = `https://api.spoonacular.com/recipes/${req.params.id}/information?language=es&apiKey=${process.env.SPOONACULAR_API_KEY}`;
    const apiResponse = await fetch(spoonacularUrl);

    if (!apiResponse.ok) {
      const detalle = await apiResponse.text();
      console.error('Error Spoonacular /:id:', apiResponse.status, detalle);

      if (apiResponse.status === 402 || apiResponse.status === 429) {
        marcarBloqueoCuotaSpoonacular();
      }

      if (apiResponse.status === 402 || apiResponse.status === 429) {
        return res.status(503).json({
          codigo: 'SPOONACULAR_QUOTA_EXCEEDED',
          mensaje: 'La cuota de Spoonacular está agotada temporalmente.',
          disponible_desde: new Date(getSpoonacularBloqueadoHasta()).toISOString(),
        });
      }

      return res.status(502).json({
        codigo: 'SPOONACULAR_UNAVAILABLE',
        mensaje: 'No se pudo obtener el detalle de Spoonacular.',
      });
    }

    const detalleReceta = await apiResponse.json();
    return res.status(200).json(detalleReceta);
  } catch (error) {
    console.error('Error en /api/recetas/:id:', error);
    return res.status(500).json({ mensaje: 'Error al obtener detalle de receta' });
  }
});

module.exports = router;
