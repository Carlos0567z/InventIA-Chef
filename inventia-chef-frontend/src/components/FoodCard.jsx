import React from 'react';

const FoodCard = ({ item, onDelete, onEdit }) => {
    const safeItem = item || {};

    const calcularDiasHastaCaducidad = (fecha) => {
        if (!fecha) return null;
        const parsed = new Date(fecha);
        if (Number.isNaN(parsed.getTime())) return null;

        const hoy = new Date();
        const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
        const inicioObjetivo = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
        return Math.ceil((inicioObjetivo - inicioHoy) / (1000 * 60 * 60 * 24));
    };

    const getStatusInfo = (estado) => {
        const value = String(estado || '').toLowerCase();
        if (value === 'caducado') {
            return { className: 'status-caducado', label: 'Caducado' };
        }
        if (value === 'urgente') {
            return { className: 'status-urgente', label: 'Revisar pronto' };
        }
        if (value === 'ok' || value === 'fresco') {
            return { className: 'status-ok', label: 'En fecha' };
        }
        return { className: 'status-sin-fecha', label: 'Sin fecha' };
    };

    const diasHastaCaducar = calcularDiasHastaCaducidad(safeItem.fecha_caducidad);
    const statusBase = getStatusInfo(safeItem.estado_alerta);
    const status = (() => {
        if (diasHastaCaducar === null) return statusBase;
        if (diasHastaCaducar < 0) return { className: 'status-caducado', label: 'Caducado' };
        if (diasHastaCaducar <= 3) return { className: 'status-urgente', label: 'Revisar pronto' };
        return { className: 'status-ok', label: 'En fecha' };
    })();
    const itemId = safeItem._id || '';

    const fechaCaducidadTexto = safeItem.fecha_caducidad
        ? new Date(safeItem.fecha_caducidad).toLocaleDateString('es-ES')
        : 'Sin fecha';

    const avisoCaducidad = (() => {
        if (diasHastaCaducar === null) return null;
        if (diasHastaCaducar < 0) {
            const dias = Math.abs(diasHastaCaducar);
            return {
                className: 'expired',
                texto: dias === 1 ? 'Caducado hace 1 dia' : `Caducado hace ${dias} dias`,
            };
        }
        if (diasHastaCaducar === 0) {
            return { className: 'urgent', texto: 'Caduca hoy' };
        }
        if (diasHastaCaducar === 1) {
            return { className: 'urgent', texto: 'Caduca mañana' };
        }
        if (diasHastaCaducar <= 3) {
            return { className: 'urgent', texto: `Caduca en ${diasHastaCaducar} dias` };
        }
        return null;
    })();

    const handleEditClick = (event) => {
        event.stopPropagation();
        if (typeof onEdit === 'function') onEdit(itemId);
    };

    const handleDeleteClick = (event) => {
        event.stopPropagation();
        if (typeof onDelete === 'function') onDelete(itemId);
    };

    return (
        <div className={`card food-card${avisoCaducidad ? ` has-expiry-${avisoCaducidad.className}` : ''}`}>
            <div className="card-top">
                <div className="icon-box food-icon-box">
                    <i className={safeItem.icono || 'fa-solid fa-box'}></i>
                </div>
                <span className={`status-badge food-status-badge ${status.className}`}>
                    Estado: {status.label}
                </span>
            </div>

            <div className="card-body">
                <h3>{safeItem.nombre || 'Alimento sin nombre'}</h3>
                <p className="food-meta-line">
                    <i className="fa-solid fa-weight-scale food-meta-icon"></i>
                    {' '}
                    {safeItem.cantidad ?? 0} {safeItem.unidad_medida || 'Unidades'}
                </p>
                <p className="food-meta-line">
                    <i className="fa-regular fa-calendar-check food-meta-icon"></i>
                    {' '}
                    Caduca: {fechaCaducidadTexto}
                </p>
                {avisoCaducidad && (
                    <p className={`food-expiry-hint ${avisoCaducidad.className}`}>
                        <i className="fa-solid fa-triangle-exclamation"></i>
                        {avisoCaducidad.texto}
                    </p>
                )}
            </div>

            <div className="card-actions">
                <button
                    type="button"
                    className="btn-card-action btn-edit"
                    onClick={handleEditClick}
                >
                    <i className="fa-solid fa-pen"></i> Edicion rapida
                </button>
                <button
                    type="button"
                    className="btn-card-action btn-delete"
                    onClick={handleDeleteClick}
                >
                    <i className="fa-solid fa-trash"></i> Eliminar
                </button>
            </div>
        </div>
    );
};

export default FoodCard;