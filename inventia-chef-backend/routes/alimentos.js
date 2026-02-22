const express = require('express');
const router = express.Router();
const Alimento = require('../models/Alimento');
const requireAuth = require('../middleware/requireAuth');

// Todos estos endpoints necesitan que el usuario haya hecho login
router.use(requireAuth);

const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

// Calcula el estado de caducidad
const calcularEstadoAlerta = (fechaCaducidad) => {
  if (!fechaCaducidad) return 'Sin fecha';

  const parsed = new Date(fechaCaducidad);
  if (Number.isNaN(parsed.getTime())) return 'Sin fecha';

  const hoy = startOfDay(new Date());
  const objetivo = startOfDay(parsed);
  const diffDias = Math.ceil((objetivo - hoy) / (1000 * 60 * 60 * 24));

  if (diffDias < 0) return 'Caducado';
  if (diffDias <= 3) return 'Urgente';
  return 'Ok';
};

// Ruta para anadir un nuevo alimento (POST /api/alimentos)
router.post('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const { nombre, cantidad, unidad_medida, categoria, fecha_caducidad, datos_openfoodfacts } = req.body;

    const nombreTrim = String(nombre || '').trim();
    if (!nombreTrim) {
      return res.status(400).json({ mensaje: 'El nombre del alimento es obligatorio' });
    }
    if (nombreTrim.length > 100) {
      return res.status(400).json({ mensaje: 'El nombre es demasiado largo' });
    }

    const cantNum = Number(cantidad);
    if (isNaN(cantNum) || cantNum < 0) {
      return res.status(400).json({ mensaje: 'La cantidad debe ser un numero positivo' });
    }

    // Calculamos el estado antes de guardar
    const estadoAlerta = calcularEstadoAlerta(fecha_caducidad);
    
    const nuevoAlimento = new Alimento({
      nombre: nombreTrim,
      cantidad: cantNum,
      unidad_medida: unidad_medida || 'Unidades',
      categoria: categoria || 'Otros',
      fecha_caducidad,
      estado_alerta: estadoAlerta,
      user_id: userId,
      datos_openfoodfacts: datos_openfoodfacts || {}
    });

    const alimentoGuardado = await nuevoAlimento.save();

    res.status(201).json(alimentoGuardado);
  } catch (error) {
    console.error('Error guardando el alimento en la base de datos:', error);
    res.status(400).json({ mensaje: 'Vaya, no se ha podido guardar el alimento. Revisa los campos.', error });
  }
});

// Ruta para obtener toda la despensa del usuario (GET /api/alimentos)
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;
    const inventarioRaw = await Alimento.find({ user_id: userId });
    
    // Recalculamos el estado por si cambio el tiempo
    const inventario = inventarioRaw.map((alimentoDoc) => {
      const alimento = alimentoDoc.toObject();
      return {
        ...alimento,
        estado_alerta: calcularEstadoAlerta(alimento.fecha_caducidad),
      };
    });
    res.status(200).json(inventario);
  } catch (error) {
    console.error('Error al leer los alimentos:', error);
    res.status(500).json({ mensaje: 'No se han podido cargar los alimentos de tu despensa.' });
  }
});

// Ruta para eliminar un alimento por su ID (DELETE /api/alimentos/:id)
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const idAlimento = req.params.id;

    const alimentoEliminado = await Alimento.findOneAndDelete({ _id: idAlimento, user_id: userId });

    if (!alimentoEliminado) {
      return res.status(404).json({ mensaje: 'No hemos encontrado ese alimento para borrar.' });
    }

    res.status(200).json({ mensaje: 'Alimento borrado con exito' });
  } catch (error) {
    console.error('Error al borrar el alimento:', error);
    res.status(500).json({ mensaje: 'Error interno al intentar borrar el producto.' });
  }
});

// Ruta para actualizar los datos de un alimento (PUT /api/alimentos/:id)
router.put('/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const idAlimento = req.params.id;

    const actual = await Alimento.findOne({ _id: idAlimento, user_id: userId });
    if (!actual) {
      return res.status(404).json({ mensaje: 'Ese alimento ya no existe o no es tuyo.' });
    }

    const { nombre, cantidad, unidad_medida, categoria, fecha_caducidad, datos_openfoodfacts } = req.body;
    
    const payload = {};
    if (nombre !== undefined) {
      const n = String(nombre).trim();
      if (!n) return res.status(400).json({ mensaje: 'El nombre no puede estar vacio' });
      if (n.length > 100) return res.status(400).json({ mensaje: 'Nombre demasiado largo' });
      payload.nombre = n;
    }
    
    if (cantidad !== undefined) {
      const c = Number(cantidad);
      if (isNaN(c) || c < 0) return res.status(400).json({ mensaje: 'La cantidad debe ser un numero positivo' });
      payload.cantidad = c;
    }

    if (unidad_medida !== undefined) payload.unidad_medida = unidad_medida;
    if (categoria !== undefined) payload.categoria = categoria;
    if (fecha_caducidad !== undefined) payload.fecha_caducidad = fecha_caducidad;
    if (datos_openfoodfacts !== undefined) payload.datos_openfoodfacts = datos_openfoodfacts;

    const tieneFechaEnRequest = Object.prototype.hasOwnProperty.call(req.body, 'fecha_caducidad');
    const fechaParaEstado = tieneFechaEnRequest ? fecha_caducidad : actual.fecha_caducidad;
    payload.estado_alerta = calcularEstadoAlerta(fechaParaEstado);

    const alimentoActualizado = await Alimento.findOneAndUpdate(
      { _id: idAlimento, user_id: userId },
      { $set: payload },
      { returnDocument: 'after' }
    );

    res.status(200).json(alimentoActualizado);
  } catch (error) {
    console.error('Error al actualizar el alimento:', error);
    res.status(500).json({ mensaje: 'Vaya, algo ha fallado al intentar actualizar el alimento.' });
  }
});

module.exports = router;
