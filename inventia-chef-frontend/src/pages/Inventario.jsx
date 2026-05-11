import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBoxOpen, FaCamera, FaChartPie, FaClock, FaLeaf, FaPlus, FaShieldAlt } from 'react-icons/fa';
import FoodCard from '../components/FoodCard';
import '../styles/inventarioHome.css';
import PageHeader from '../components/PageHeader';
import FilterBar from '../components/FilterBar';
import CustomSelect from '../components/CustomSelect';

const Inventario = () => {
    const navigate = useNavigate();

    // El estado empieza vacio porque los datos tardan unos milisegundos en llegar
    const [alimentos, setAlimentos] = useState([]);
    const [alimentoEditandoRapido, setAlimentoEditandoRapido] = useState(null);
    const [busqueda, setBusqueda] = useState('');
    const [filtroEstado, setFiltroEstado] = useState('todos');
    const [filtroCategoria, setFiltroCategoria] = useState('todas');
    const [orden, setOrden] = useState('caducidad');

    const parseDate = (value) => {
        if (!value || typeof value !== 'string') return null;
        const iso = new Date(value);
        if (!Number.isNaN(iso.getTime())) return iso;

        const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
        if (!match) return null;

        const [, day, month, year] = match;
        const parsed = new Date(Number(year), Number(month) - 1, Number(day));
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const formatDateForInput = (value) => {
        if (!value) return '';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) return '';

        const yyyy = parsed.getFullYear();
        const mm = String(parsed.getMonth() + 1).padStart(2, '0');
        const dd = String(parsed.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const normalizarEstado = (estado) => {
        const value = String(estado || '').toLowerCase();
        if (value === 'caducado') return 'caducado';
        if (value === 'urgente') return 'urgente';
        if (value === 'fresco' || value === 'ok') return 'fresco';
        return 'otros';
    };

    const resumen = useMemo(() => {
        const total = alimentos.length;
        const urgentes = alimentos.filter((alimento) => ['urgente', 'caducado'].includes(String(alimento.estado_alerta || '').toLowerCase())).length;
        const frescos = alimentos.filter((alimento) => ['fresco', 'ok'].includes(String(alimento.estado_alerta || '').toLowerCase())).length;
        const categorias = new Set(alimentos.map((alimento) => alimento.categoria || 'Sin categoría')).size;

        return {
            total,
            urgentes,
            frescos,
            categorias,
        };
    }, [alimentos]);

    const nextExpiry = useMemo(() => {
        const futureItems = alimentos
            .map((alimento) => ({
                ...alimento,
                parsedDate: parseDate(alimento.fecha_caducidad),
            }))
            .filter((alimento) => alimento.parsedDate)
            .sort((a, b) => a.parsedDate - b.parsedDate);

        return futureItems[0] || null;
    }, [alimentos]);

    const nextExpiryLabel = nextExpiry?.fecha_caducidad
        ? new Date(nextExpiry.fecha_caducidad).toLocaleDateString('es-ES')
        : 'Sin fecha';

    const categoriasDisponibles = useMemo(() => {
        const categorias = new Set(alimentos.map((item) => String(item.categoria || 'Sin categoría').trim() || 'Sin categoría'));
        return Array.from(categorias).sort((a, b) => a.localeCompare(b));
    }, [alimentos]);

    const alimentosFiltrados = useMemo(() => {
        const texto = busqueda.trim().toLowerCase();

        const filtrados = alimentos.filter((item) => {
            const nombre = String(item.nombre || '').toLowerCase();
            const categoria = String(item.categoria || 'Sin categoría').toLowerCase();
            const unidad = String(item.unidad_medida || '').toLowerCase();
            const estado = normalizarEstado(item.estado_alerta).toLowerCase();
            
            const codigoBarras = String(item.datos_openfoodfacts?.codigo_barras || '').toLowerCase();

            const coincideTexto = !texto || 
                nombre.includes(texto) || 
                categoria.includes(texto) || 
                unidad.includes(texto) ||
                estado.includes(texto) ||
                codigoBarras.includes(texto);

            const coincideEstado = filtroEstado === 'todos' || normalizarEstado(item.estado_alerta) === filtroEstado;
            const coincideCategoria = filtroCategoria === 'todas' || String(item.categoria || 'Sin categoría') === filtroCategoria;
            
            return coincideTexto && coincideEstado && coincideCategoria;
        });

        return filtrados.sort((a, b) => {
            if (orden === 'nombre') {
                return String(a.nombre || '').localeCompare(String(b.nombre || ''));
            }

            if (orden === 'cantidad') {
                return Number(b.cantidad || 0) - Number(a.cantidad || 0);
            }

            const fechaA = parseDate(a.fecha_caducidad);
            const fechaB = parseDate(b.fecha_caducidad);
            if (!fechaA && !fechaB) return String(a.nombre || '').localeCompare(String(b.nombre || ''));
            if (!fechaA) return 1;
            if (!fechaB) return -1;
            return fechaA - fechaB;
        });
    }, [alimentos, busqueda, filtroEstado, filtroCategoria, orden]);

    // useEffect se ejecuta automaticamente al abrir esta pagina
    useEffect(() => {
        const cargarDespensa = async () => {
            try {
                const response = await fetch('/api/alimentos');
                if (response.ok) {
                    const datosReales = await response.json();
                    setAlimentos(datosReales);
                } else {
                    console.error('Error en la respuesta del servidor');
                }
            } catch (error) {
                console.error('Error al conectar con el backend:', error);
            }
        };

        cargarDespensa();
    }, []);

    // Funcion para eliminar un alimento de la base de datos y de la vista
    const handleDelete = async (id) => {
        const confirmar = window.confirm('Seguro que quieres eliminar este alimento de tu despensa?');

        // si el usuario dice que si, lo borramos de la base de datos
        if (confirmar) {
            try {
                const response = await fetch(`/api/alimentos/${id}`, {
                    method: 'DELETE'
                });

                if (response.ok) {
                    const nuevoInventario = alimentos.filter((alimento) => alimento._id !== id);
                    setAlimentos(nuevoInventario);
                } else {
                    console.error('Error del servidor al intentar eliminar');
                }
            } catch (error) {
                console.error('Error de conexion con el backend:', error);
            }
        }
    };

    const handleEdit = (id) => {
        // buscamos el alimento por id
        const alimentoAEditar = alimentos.find((a) => a._id === id);
        if (!alimentoAEditar) return;

        setAlimentoEditandoRapido({
            _id: alimentoAEditar._id,
            nombre: alimentoAEditar.nombre,
            cantidad: alimentoAEditar.cantidad,
            unidad_medida: alimentoAEditar.unidad_medida || 'Unidades',
            fecha_caducidad: formatDateForInput(alimentoAEditar.fecha_caducidad),
            codigo_barras: alimentoAEditar.datos_openfoodfacts?.codigo_barras || '',
        });
    };

    const handleChangeEditRapido = (e) => {
        const { name, value } = e.target;
        setAlimentoEditandoRapido({
            ...alimentoEditandoRapido,
            [name]: name === 'cantidad' ? Number(value) : value
        });
    };

    const actualizarAlimentoEnLista = (alimentoActualizado) => {
        const nuevoInventario = alimentos.map((alimento) =>
            alimento._id === alimentoActualizado._id ? alimentoActualizado : alimento
        );
        setAlimentos(nuevoInventario);
    };

    const enviarActualizacion = async (payload) => {
        const { _id, ...cuerpo } = payload;
        const response = await fetch(`/api/alimentos/${_id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(cuerpo)
        });

        if (!response.ok) {
            throw new Error(`Error HTTP ${response.status}`);
        }

        return response.json();
    };

    const handleActualizarRapido = async (e) => {
        e.preventDefault();
        try {
            const orig = alimentos.find((a) => a._id === alimentoEditandoRapido._id);
            const prev = orig?.datos_openfoodfacts || {};
            const cod = String(alimentoEditandoRapido.codigo_barras || '').trim();
            const habiaDatosOff = prev && Object.keys(prev).length > 0;

            const base = {
                nombre: alimentoEditandoRapido.nombre,
                cantidad: alimentoEditandoRapido.cantidad,
                unidad_medida: alimentoEditandoRapido.unidad_medida,
                fecha_caducidad: alimentoEditandoRapido.fecha_caducidad
                    ? new Date(`${alimentoEditandoRapido.fecha_caducidad}T00:00:00`).toISOString()
                    : null,
            };

            if (habiaDatosOff || cod) {
                base.datos_openfoodfacts = {
                    codigo_barras: cod,
                    nutriscore: prev.nutriscore || 'N/A',
                    alergenos_detectados: Array.isArray(prev.alergenos_detectados) ? prev.alergenos_detectados : [],
                };
            }

            const alimentoActualizado = await enviarActualizacion({
                _id: alimentoEditandoRapido._id,
                ...base,
            });
            actualizarAlimentoEnLista(alimentoActualizado);
            setAlimentoEditandoRapido(null);
        } catch (error) {
            console.error('Error al actualizar:', error);
        }
    };


    return (
        <section className="view-section active inventario-home">
            <PageHeader
                kicker="Despensa"
                title="Gestiona tu despensa"
                description="Visualiza rápido, filtra y actúa sobre tu inventario sin distracciones."
            >
                <div className="page-hero-stats">
                    <div>
                        <strong>{resumen.total}</strong>
                        <span>Productos</span>
                    </div>
                    <div>
                        <strong>{resumen.categorias}</strong>
                        <span>Categorías</span>
                    </div>
                    <div>
                        <strong>{resumen.urgentes}</strong>
                        <span>Alertas</span>
                    </div>
                </div>
            </PageHeader>

            <FilterBar
                idPrefix="inventario"
                searchValue={busqueda}
                onSearchChange={setBusqueda}
                placeholder="Buscar por nombre o categoría..."
                ariaLabel="Filtros de inventario"
                stackedSelects
                selects={[
                    {
                        id: 'inventario-estado',
                        value: filtroEstado,
                        onChange: setFiltroEstado,
                        neutralValue: 'todos',
                        options: [
                            { value: 'todos', label: 'Todos los estados' },
                            { value: 'caducado', label: 'Caducado' },
                            { value: 'urgente', label: 'Urgente' },
                            { value: 'fresco', label: 'Fresco/En fecha' },
                            { value: 'otros', label: 'Otros' },
                        ],
                    },
                    {
                        id: 'inventario-categoria',
                        value: filtroCategoria,
                        onChange: setFiltroCategoria,
                        neutralValue: 'todas',
                        options: [
                            { value: 'todas', label: 'Todas las categorías' },
                            ...categoriasDisponibles.map((c) => ({ value: c, label: c })),
                        ],
                    },
                    {
                        id: 'inventario-orden',
                        value: orden,
                        onChange: setOrden,
                        neutralValue: 'caducidad',
                        options: [
                            { value: 'caducidad', label: 'Orden: Próxima caducidad' },
                            { value: 'nombre', label: 'Orden: Nombre' },
                            { value: 'cantidad', label: 'Orden: Cantidad' },
                        ],
                    },
                ]}
            />

            <div className="view-header inventario-list-header">
                <div className="view-title">
                    <h2>Productos en despensa</h2>
                    <p>
                        {alimentosFiltrados.length} resultados sobre {resumen.total} productos.
                        {nextExpiry && (
                            <span className="next-expiry-hint">
                                <FaClock /> Próxima caducidad: <strong>{nextExpiry.nombre}</strong> ({nextExpiryLabel})
                            </span>
                        )}
                    </p>
                </div>
                <div className="inventario-header-actions">
                    <button
                        className="inventario-secondary-btn"
                        onClick={() => navigate('/compra-inteligente')}
                    >
                        <FaBoxOpen /> Compras
                    </button>
                    <button
                        className="action-btn inventario-primary-btn"
                        onClick={() => navigate('/escaner')}
                    >
                        <FaCamera /> Escanear producto
                    </button>
                </div>
            </div>

            <div className="grid-cards inventario-grid">
                {alimentosFiltrados.length > 0 ? (
                    alimentosFiltrados.map((alimento) => (
                        <FoodCard
                            key={alimento._id}
                            item={alimento}
                            onDelete={handleDelete}
                            onEdit={handleEdit}
                        />
                    ))
                ) : alimentos.length === 0 ? (
                    <div className="inventario-empty-state">
                        <FaBoxOpen className="inventario-empty-icon" />
                        <h3>Tu despensa esta vacia</h3>
                        <p>Anade productos manualmente o escanealos para empezar a organizar tu cocina.</p>
                        <button className="action-btn inventario-primary-btn" onClick={() => navigate('/escaner')}>
                            <FaCamera /> Empezar a escanear
                        </button>
                    </div>
                ) : (
                    <div className="inventario-empty-state">
                        <FaShieldAlt className="inventario-empty-icon" />
                        <h3>No hay resultados con esos filtros</h3>
                        <p>Prueba a limpiar busqueda o cambiar estado y categoria para ver mas productos.</p>
                        <button
                            className="inventario-secondary-btn"
                            onClick={() => {
                                setBusqueda('');
                                setFiltroEstado('todos');
                                setFiltroCategoria('todas');
                                setOrden('caducidad');
                            }}
                        >
                            Limpiar filtros
                        </button>
                    </div>
                )}
            </div>

            {alimentoEditandoRapido && (
                <div className="inventario-modal-overlay">
                    <div className="card inventario-modal-card">
                        <div className="inventario-modal-head">
                            <h3>Edicion rapida</h3>
                            <button
                                onClick={() => setAlimentoEditandoRapido(null)}
                                className="inventario-modal-close"
                            >
                                <i className="fa-solid fa-xmark"></i>
                            </button>
                        </div>

                        <form onSubmit={handleActualizarRapido} className="inventario-quick-form">
                            <div>
                                <label className="inventario-quick-label">Nombre</label>
                                <input
                                    type="text"
                                    name="nombre"
                                    value={alimentoEditandoRapido.nombre || ''}
                                    onChange={handleChangeEditRapido}
                                    required
                                    className="inventario-quick-input"
                                />
                            </div>

                            <div>
                                <label className="inventario-quick-label">Codigo de barras (opcional)</label>
                                <input
                                    type="text"
                                    name="codigo_barras"
                                    inputMode="numeric"
                                    autoComplete="off"
                                    value={alimentoEditandoRapido.codigo_barras || ''}
                                    onChange={handleChangeEditRapido}
                                    className="inventario-quick-input"
                                    placeholder="Para que el escaner lo encuentre despues"
                                />
                            </div>

                            <div className="inventario-quick-grid">
                                <div>
                                    <label className="inventario-quick-label">Cantidad</label>
                                    <input
                                        type="number"
                                        name="cantidad"
                                        value={alimentoEditandoRapido.cantidad ?? 0}
                                        onChange={handleChangeEditRapido}
                                        min="0"
                                        className="inventario-quick-input"
                                    />
                                </div>
                                <div>
                                    <label className="inventario-quick-label">Unidad</label>
                                    <CustomSelect
                                        value={alimentoEditandoRapido.unidad_medida || 'Unidades'}
                                        onChange={(val) => setAlimentoEditandoRapido({...alimentoEditandoRapido, unidad_medida: val})}
                                        options={[
                                            { value: 'Unidades', label: 'Unidades' },
                                            { value: 'Gramos', label: 'Gramos' },
                                            { value: 'Kilos', label: 'Kilos' },
                                            { value: 'Litros', label: 'Litros' }
                                        ]}
                                    />
                                </div>
                                <div>
                                    <label className="inventario-quick-label">Caducidad</label>
                                    <input
                                        type="date"
                                        name="fecha_caducidad"
                                        value={alimentoEditandoRapido.fecha_caducidad || ''}
                                        onChange={handleChangeEditRapido}
                                        className="inventario-quick-input"
                                    />
                                </div>
                            </div>

                            <button type="submit" className="action-btn inventario-primary-btn inventario-quick-submit">
                                Guardar cambios
                            </button>
                        </form>
                    </div>
                </div>
            )}

        </section>
    );
};

export default Inventario;