const Usuario = require('../models/Usuario');
const Alimento = require('../models/Alimento');

const ADMIN_EMAIL = 'prueba@gmail.com';

const DEMO_ALIMENTOS = [
  { nombre: 'Tomate', categoria: 'Fresco', cantidad: 8, unidad_medida: 'Unidades' },
  { nombre: 'Cebolla', categoria: 'Fresco', cantidad: 6, unidad_medida: 'Unidades' },
  { nombre: 'Pimiento Rojo', categoria: 'Fresco', cantidad: 3, unidad_medida: 'Unidades' },
  { nombre: 'Ajo', categoria: 'Fresco', cantidad: 2, unidad_medida: 'Unidades' },
  { nombre: 'Patata', categoria: 'Fresco', cantidad: 10, unidad_medida: 'Unidades' },
  { nombre: 'Pasta', categoria: 'Despensa', cantidad: 2, unidad_medida: 'Unidades' },
  { nombre: 'Arroz', categoria: 'Despensa', cantidad: 1, unidad_medida: 'Kilos' },
  { nombre: 'Huevos', categoria: 'Fresco', cantidad: 12, unidad_medida: 'Unidades' },
  { nombre: 'Queso', categoria: 'Lacteos', cantidad: 1, unidad_medida: 'Unidades' },
  { nombre: 'Leche', categoria: 'Lacteos', cantidad: 2, unidad_medida: 'Litros' },
];

async function seedAdminInventory() {
  const user = await Usuario.findOne({ email: ADMIN_EMAIL });
  if (!user) {
    throw new Error(`No existe el usuario ${ADMIN_EMAIL}`);
  }

  let creados = 0;
  let actualizados = 0;

  for (const item of DEMO_ALIMENTOS) {
    const existente = await Alimento.findOne({
      user_id: user._id,
      nombre: item.nombre,
    });

    if (existente) {
      existente.categoria = item.categoria;
      existente.cantidad = item.cantidad;
      existente.unidad_medida = item.unidad_medida;
      existente.metodo_ingreso = 'Manual';
      await existente.save();
      actualizados += 1;
    } else {
      await Alimento.create({
        user_id: user._id,
        nombre: item.nombre,
        categoria: item.categoria,
        cantidad: item.cantidad,
        unidad_medida: item.unidad_medida,
        metodo_ingreso: 'Manual',
      });
      creados += 1;
    }
  }

  const total = await Alimento.countDocuments({ user_id: user._id });

  return {
    email: ADMIN_EMAIL,
    creados,
    actualizados,
    totalUsuario: total,
  };
}

module.exports = {
  seedAdminInventory,
};
