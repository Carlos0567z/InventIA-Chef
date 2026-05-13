const STORAGE_KEY = 'inventia_inventario';

const INVENTARIO_INICIAL = [
    {
        _id: '1a2b3c',
        nombre: 'Brócoli Ecológico',
        categoria: 'Fresco',
        cantidad: 1,
        unidad_medida: 'Unidad',
        fecha_caducidad: '26/03/2026',
        estado_alerta: 'Fresco',
        icono: 'fa-solid fa-seedling'
    },
    {
        _id: '4d5e6f',
        nombre: 'Huevos Camperos',
        categoria: 'Envasado',
        cantidad: 4,
        unidad_medida: 'Unidades',
        fecha_caducidad: 'Mañana',
        estado_alerta: 'Urgente',
        icono: 'fa-solid fa-egg'
    }
];

const isBrowser = () => typeof window !== 'undefined' && !!window.localStorage;

export const getInventario = () => {
    if (!isBrowser()) return [...INVENTARIO_INICIAL];

    const inventarioGuardado = window.localStorage.getItem(STORAGE_KEY);
    if (!inventarioGuardado) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(INVENTARIO_INICIAL));
        return [...INVENTARIO_INICIAL];
    }

    try {
        const inventario = JSON.parse(inventarioGuardado);
        return Array.isArray(inventario) ? inventario : [...INVENTARIO_INICIAL];
    } catch (error) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(INVENTARIO_INICIAL));
        return [...INVENTARIO_INICIAL];
    }
};

export const saveInventario = (inventario) => {
    if (!isBrowser()) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(inventario));
};

export const addAlimento = (alimento) => {
    const inventarioActual = getInventario();
    const nuevoInventario = [alimento, ...inventarioActual];
    saveInventario(nuevoInventario);
    return nuevoInventario;
};

export const removeAlimento = (id) => {
    const inventarioActual = getInventario();
    const nuevoInventario = inventarioActual.filter((alimento) => alimento._id !== id);
    saveInventario(nuevoInventario);
    return nuevoInventario;
};
