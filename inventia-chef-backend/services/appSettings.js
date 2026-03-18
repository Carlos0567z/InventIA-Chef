const AppConfig = require('../models/AppConfig');

const DEFAULT_APP_SETTINGS = {
  recetasClasicasMax: 9,
  recetasIaMin: 3,
  recetasIaMax: 9,
  recetasIaDefault: 9,
};

function toInt(value, fallback) {
  const parsed = Number.parseInt(String(value), 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sanitizeSettings(raw = {}) {
  const recetasClasicasMax = clamp(
    toInt(raw.recetasClasicasMax, DEFAULT_APP_SETTINGS.recetasClasicasMax),
    3,
    24
  );

  const recetasIaMin = clamp(
    toInt(raw.recetasIaMin, DEFAULT_APP_SETTINGS.recetasIaMin),
    1,
    24
  );

  const recetasIaMaxBase = clamp(
    toInt(raw.recetasIaMax, DEFAULT_APP_SETTINGS.recetasIaMax),
    1,
    30
  );
  const recetasIaMax = Math.max(recetasIaMin, recetasIaMaxBase);

  const recetasIaDefaultBase = toInt(raw.recetasIaDefault, DEFAULT_APP_SETTINGS.recetasIaDefault);
  const recetasIaDefault = clamp(recetasIaDefaultBase, recetasIaMin, recetasIaMax);

  return {
    recetasClasicasMax,
    recetasIaMin,
    recetasIaMax,
    recetasIaDefault,
  };
}

async function getAppSettings() {
  const doc = await AppConfig.findOneAndUpdate(
    { singletonKey: 'global' },
    {
      $setOnInsert: {
        singletonKey: 'global',
        ...DEFAULT_APP_SETTINGS,
      },
    },
    {
      returnDocument: 'after',
      upsert: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  return sanitizeSettings(doc || DEFAULT_APP_SETTINGS);
}

async function updateAppSettings(patch = {}) {
  const current = await getAppSettings();
  const merged = {
    ...current,
    ...patch,
  };

  const next = sanitizeSettings(merged);

  await AppConfig.updateOne(
    { singletonKey: 'global' },
    {
      $set: {
        singletonKey: 'global',
        ...next,
      },
    },
    { upsert: true }
  );

  return next;
}

module.exports = {
  DEFAULT_APP_SETTINGS,
  getAppSettings,
  updateAppSettings,
  sanitizeSettings,
};
