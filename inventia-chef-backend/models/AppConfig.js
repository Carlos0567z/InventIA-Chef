const mongoose = require('mongoose');

const appConfigSchema = new mongoose.Schema(
  {
    singletonKey: {
      type: String,
      default: 'global',
      unique: true,
      index: true,
    },
    recetasClasicasMax: {
      type: Number,
      default: 9,
      min: 3,
      max: 24,
    },
    recetasIaMin: {
      type: Number,
      default: 3,
      min: 1,
      max: 24,
    },
    recetasIaMax: {
      type: Number,
      default: 9,
      min: 1,
      max: 30,
    },
    recetasIaDefault: {
      type: Number,
      default: 9,
      min: 1,
      max: 30,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model('AppConfig', appConfigSchema);
