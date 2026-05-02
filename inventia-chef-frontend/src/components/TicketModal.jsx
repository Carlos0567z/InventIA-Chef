import { useState, useMemo } from 'react';
import { 
  FaTimes, FaDownload, FaPlus, FaTrash,
  FaCarrot, FaDrumstickBite, FaFish, FaCheese, 
  FaBreadSlice, FaBoxOpen, FaSnowflake, FaGlassMartiniAlt, 
  FaShoppingBasket 
} from 'react-icons/fa';
import '../styles/TicketModal.css';

const SECCIONES_ESTANDAR = [
  'Fruteria y Verduleria',
  'Carniceria',
  'Pescaderia',
  'Lacteos y Huevos',
  'Panaderia',
  'Despensa y Conservas',
  'Congelados',
  'Bebidas',
  'Otros',
];

const ICONS_MAP = {
  'Fruteria y Verduleria': <FaCarrot />,
  'Carniceria': <FaDrumstickBite />,
  'Pescaderia': <FaFish />,
  'Lacteos y Huevos': <FaCheese />,
  'Panaderia': <FaBreadSlice />,
  'Despensa y Conservas': <FaBoxOpen />,
  'Congelados': <FaSnowflake />,
  'Bebidas': <FaGlassMartiniAlt />,
  'Otros': <FaShoppingBasket />
};

const obtenerMarcadorArticulo = (articulo) => {
  const textoManual = String(articulo?.emoji || '').trim();
  if (textoManual && /^[\x20-\x7E]+$/.test(textoManual)) {
    return textoManual.slice(0, 2).toUpperCase();
  }

  const categoria = String(articulo?.categoria || 'Otros').trim();
  if (!categoria) return 'OT';

  const partes = categoria.split(/\s+/).filter(Boolean);
  if (partes.length === 1) {
    return partes[0].slice(0, 2).toUpperCase();
  }

  return `${partes[0][0] || 'O'}${partes[1][0] || 'T'}`.toUpperCase();
};

export default function TicketModal({
  ticket,
  onClose,
  onUpdateTicket,
  permitirEdicion = false,
}) {
  const [manualNombre, setManualNombre] = useState('');
  const [manualCantidad, setManualCantidad] = useState('1 unidad');
  const [manualCategoria, setManualCategoria] = useState('Otros');
  const [descargando, setDescargando] = useState(false);

  const agruparArticulosPorCategoria = (articulos = []) => {
    return articulos.reduce((acc, item) => {
      const categoria = item.categoria || 'Otros';
      if (!acc[categoria]) acc[categoria] = [];
      acc[categoria].push(item);
      return acc;
    }, {});
  };

  const detalleAgrupado = useMemo(() => {
    if (!ticket) return {};
    return agruparArticulosPorCategoria(ticket.articulos || []);
  }, [ticket]);

  const formatearFecha = (cadenaFecha) => {
    if (!cadenaFecha) return '';
    const opciones = { day: '2-digit', month: 'long', year: 'numeric' };
    return new Date(cadenaFecha).toLocaleDateString('es-ES', opciones);
  };

  const anadirManual = async (event) => {
    event.preventDefault();
    if (!permitirEdicion || !onUpdateTicket || !ticket) return;

    const nombre = manualNombre.trim();
    const cantidad = manualCantidad.trim() || '1 unidad';
    const categoria = manualCategoria || 'Otros';

    if (!nombre) return;

    const nuevosArticulos = [
      ...(ticket.articulos || []),
      {
        nombre,
        cantidad,
        categoria,
        emoji: '',
      },
    ];

    const ticketActualizado = { ...ticket, articulos: nuevosArticulos };
    await onUpdateTicket(ticketActualizado);

    setManualNombre('');
    setManualCantidad('1 unidad');
    setManualCategoria('Otros');
  };

  const eliminarProducto = async (indexProductoGlobal) => {
    if (!permitirEdicion || !onUpdateTicket || !ticket) return;

    const nuevosArticulos = (ticket.articulos || []).filter((_, idx) => idx !== indexProductoGlobal);
    const ticketActualizado = { ...ticket, articulos: nuevosArticulos };
    
    await onUpdateTicket(ticketActualizado);
  };

  const descargarTicketPng = async () => {
    if (!ticket) return;
    setDescargando(true);

    try {
      const grupos = agruparArticulosPorCategoria(ticket.articulos || []);
      const categorias = Object.keys(grupos);
      
      const width = 1200;
      const paddingX = 80;
      const productRowHeight = 48;
      const categoryHeaderHeight = 80;
      const categoryMarginBottom = 40;
      
      // alto total del canvas
      let contentHeight = 220; // cabecera PNG + margen
      categorias.forEach((cat) => {
        contentHeight += categoryHeaderHeight;
        contentHeight += grupos[cat].length * productRowHeight;
        contentHeight += categoryMarginBottom;
      });
      contentHeight += 100; // pie

      const height = Math.max(800, contentHeight);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 1. Fondo principal
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, height);

      // 2. Cabecera con degradado
      const headerGradient = ctx.createLinearGradient(0, 0, width, 0);
      headerGradient.addColorStop(0, '#f43f5e');
      headerGradient.addColorStop(1, '#be123c');
      
      ctx.fillStyle = headerGradient;
      ctx.fillRect(0, 0, width, 220);

      // Texto de la cabecera
      ctx.fillStyle = '#ffffff';
      ctx.font = '800 56px "Inter", system-ui, -apple-system, sans-serif';
      ctx.fillText(ticket.titulo || 'Lista de la Compra', paddingX, 100);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = '500 24px "Inter", system-ui, -apple-system, sans-serif';
      ctx.fillText(`Generada el ${formatearFecha(ticket.fecha || new Date().toISOString())}`, paddingX, 140);

      // marca arriba a la derecha
      ctx.textAlign = 'right';
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 28px "Inter", system-ui, -apple-system, sans-serif';
      ctx.fillText('INVENTIA CHEF', width - paddingX, 100);
      ctx.textAlign = 'left';

      // 3. Pintar cada categoria
      let y = 260;
      
      // sombra tarjetas
      ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;

      categorias.forEach((categoria) => {
        const items = grupos[categoria];
        const cardHeight = categoryHeaderHeight + items.length * productRowHeight + 20;
        
        // Dibujar tarjeta (blanca)
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(paddingX, y, width - paddingX * 2, cardHeight, 24);
        ctx.fill();
        
        ctx.shadowColor = 'transparent';

        // Titulo Categoria
        ctx.fillStyle = '#e11d48';
        ctx.font = '800 22px "Inter", system-ui, -apple-system, sans-serif';
        ctx.fillText(categoria.toUpperCase(), paddingX + 40, y + 50);

        // Linea separadora debajo del titulo
        ctx.strokeStyle = '#f1f5f9';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(paddingX + 40, y + 70);
        ctx.lineTo(width - paddingX - 40, y + 70);
        ctx.stroke();

        let itemY = y + 70 + 36;

        items.forEach((art, index) => {
          if (index > 0) {
            ctx.strokeStyle = '#f8fafc';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(paddingX + 40, itemY - 24);
            ctx.lineTo(width - paddingX - 40, itemY - 24);
            ctx.stroke();
          }

          ctx.fillStyle = '#fff1f2';
          ctx.beginPath();
          ctx.roundRect(paddingX + 40, itemY - 30, 40, 40, 10);
          ctx.fill();
          
          ctx.fillStyle = '#000000';
          ctx.font = '700 16px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(obtenerMarcadorArticulo(art), paddingX + 60, itemY - 3);
          ctx.textAlign = 'left';

          // Nombre del articulo
          ctx.fillStyle = '#1e293b';
          ctx.font = '600 20px "Inter", system-ui, -apple-system, sans-serif';
          ctx.fillText(art.nombre, paddingX + 100, itemY - 2);

          // linea de puntos hasta la cantidad
          const nameWidth = ctx.measureText(art.nombre).width;
          const startDots = paddingX + 120 + nameWidth;
          const endDots = width - paddingX - 200;
          
          if (startDots < endDots - 20) {
            ctx.fillStyle = '#cbd5e1';
            ctx.font = '600 16px monospace';
            let dotX = startDots;
            while(dotX < endDots) {
               ctx.fillText('.', dotX, itemY - 4);
               dotX += 14;
            }
          }

          ctx.fillStyle = '#64748b';
          ctx.font = '600 20px "Inter", system-ui, -apple-system, sans-serif';
          ctx.textAlign = 'right';
          ctx.fillText(art.cantidad || '1 unidad', width - paddingX - 40, itemY - 2);
          ctx.textAlign = 'left';

          itemY += productRowHeight;
        });

        // otra vez sombra para la siguiente categoria
        ctx.shadowColor = 'rgba(15, 23, 42, 0.08)';
        
        y += cardHeight + categoryMarginBottom;
      });

      // Pie del ticket
      ctx.shadowColor = 'transparent';
      ctx.fillStyle = '#94a3b8';
      ctx.font = '500 18px "Inter", system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Generado automaticamente por InventIA Chef • ¡Que aproveche!', width / 2, y + 20);

      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `lista-compra-${new Date(ticket.fecha || new Date()).toISOString().slice(0, 10)}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } finally {
      setDescargando(false);
    }
  };

  if (!ticket) return null;

  return (
    <div className="ticket-modal-overlay" onClick={onClose}>
      <div className="ticket-modal" onClick={(e) => e.stopPropagation()}>
        <header className="ticket-modal-header">
          <div>
            <h2>{ticket.titulo}</h2>
            <p>{formatearFecha(ticket.fecha || new Date().toISOString())}</p>
          </div>
          <button type="button" className="ticket-icon-btn" onClick={onClose}>
            <FaTimes />
          </button>
        </header>

        <div className="ticket-modal-body">
          {permitirEdicion && (
            <form className="ticket-manual-form" onSubmit={anadirManual}>
              <input
                type="text"
                placeholder="Añadir producto..."
                value={manualNombre}
                onChange={(e) => setManualNombre(e.target.value)}
                className="ticket-manual-input"
              />
              <input
                type="text"
                placeholder="Cant."
                value={manualCantidad}
                onChange={(e) => setManualCantidad(e.target.value)}
                className="ticket-manual-qty"
              />
              <select
                value={manualCategoria}
                onChange={(e) => setManualCategoria(e.target.value)}
                className="ticket-manual-select"
              >
                {SECCIONES_ESTANDAR.map((seccion) => (
                  <option key={seccion} value={seccion}>
                    {seccion}
                  </option>
                ))}
              </select>
              <button type="submit" className="ticket-manual-add-btn">
                <FaPlus /> Añadir
              </button>
            </form>
          )}

          {Object.keys(detalleAgrupado).length === 0 && (
            <div className="ticket-empty">No hay productos en la lista.</div>
          )}

          {Object.keys(detalleAgrupado).map((categoria) => (
            <section className="ticket-modal-section" key={categoria}>
              <h3>{categoria}</h3>
              <ul>
                {detalleAgrupado[categoria].map((articulo, idx) => {
                  // indice en el array global (borrar bien)
                  const globalIdx = (ticket.articulos || []).findIndex(
                    (a) => a.nombre === articulo.nombre && a.categoria === articulo.categoria
                  );

                  return (
                    <li key={`${categoria}-${articulo.nombre}-${idx}`}>
                      <span className="ticket-item-left">
                        <span className="ticket-item-icon">
                          {ICONS_MAP[categoria] || <FaShoppingBasket />}
                        </span>
                        <span>{articulo.nombre}</span>
                      </span>
                      <span className="ticket-item-right">
                        <span>{articulo.cantidad || '1 unidad'}</span>
                        {permitirEdicion && (
                          <button
                            type="button"
                            className="ticket-item-delete"
                            onClick={() => eliminarProducto(globalIdx)}
                            title="Eliminar producto"
                          >
                            <FaTrash />
                          </button>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <footer className="ticket-modal-footer">
          <button
            type="button"
            className="ticket-download-btn"
            onClick={descargarTicketPng}
            disabled={descargando}
          >
            <FaDownload /> {descargando ? 'Generando...' : 'Descargar PNG'}
          </button>
        </footer>
      </div>
    </div>
  );
}
