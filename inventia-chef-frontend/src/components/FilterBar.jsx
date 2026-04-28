import React, { useEffect, useRef, useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import { FiFilter, FiChevronDown, FiChevronUp } from 'react-icons/fi';
import '../styles/Recetas.css';
import '../styles/inventarioHome.css';
import CustomSelect from './CustomSelect';
import RangeSlider from './RangeSlider';

// Barra busqueda + boton que abre el resto de filtros (menos intrusivo)
export default function FilterBar({
  idPrefix = 'filters',
  searchValue = '',
  onSearchChange = () => {},
  selects = [],
  sliders = [],
  ariaLabel = 'Filtros',
  placeholder = 'Tomate, pasta, pollo...',
  // en despensa los 3 selects los quiero uno debajo de otro
  stackedSelects = false,
}) {
  const anchorRef = useRef(null);
  const panelRef = useRef(null);
  const [isFixed, setIsFixed] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [fixedStyle, setFixedStyle] = useState({});
  const [mostrarOpciones, setMostrarOpciones] = useState(false);

  useEffect(() => {
    const appMain = document.querySelector('.app-main');

    const getHeaderOffset = () => {
      const header = document.querySelector('.top-header');
      const headerHeight = header?.getBoundingClientRect().height || 74;
      return headerHeight + 8;
    };

    const update = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;

      const anchorRect = anchor.getBoundingClientRect();
      const topOffset = getHeaderOffset();
      const shouldFix = anchorRect.top <= topOffset;

      const panelHeight = panel.offsetHeight;

      setIsFixed((prev) => (prev === shouldFix ? prev : shouldFix));
      
      if (!shouldFix) {
        if (anchor.style.minHeight) anchor.style.minHeight = '';
        setFixedStyle({});
        return;
      }

      anchor.style.minHeight = `${panelHeight}px`;

      const nextStyle = {
        top: `${Math.round(topOffset)}px`,
        left: `${Math.round(anchorRect.left)}px`,
        width: `${Math.max(280, Math.round(anchorRect.width))}px`,
        zIndex: 58,
      };

      setFixedStyle((prev) => {
        if (prev.top === nextStyle.top && prev.left === nextStyle.left && prev.width === nextStyle.width) return prev;
        return nextStyle;
      });

      if (window.innerHeight < panelHeight + topOffset + 150) {
        setIsCompact(true);
      } else {
        setIsCompact(false);
      }
    };

    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    if (appMain) appMain.addEventListener('scroll', update, { passive: true });

    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      if (appMain) appMain.removeEventListener('scroll', update);
    };
  }, [mostrarOpciones]); // si abro o cierro esto el panel crece y el sticky hay que recalcularlo

  // para el circulito del boton: neutralValue = "valor por defecto" de cada select
  const selectCuentaComoActivo = (s) => {
    const v = s.value;
    if (v === '' || v == null) return false;
    if (s.neutralValue !== undefined) return v !== s.neutralValue;
    if (v === 'cualquiera') return false;
    return true;
  };

  const tieneFiltrosActivos =
    selects.some(selectCuentaComoActivo) || sliders.some((sl) => sl.value < sl.max);

  return (
    <div className="inventario-filters-anchor recetas-filtros-anchor-chef" ref={anchorRef}>
      <section
        ref={panelRef}
        className={`inventario-filters card${isFixed ? ' is-fixed' : ''}${isCompact ? ' is-compact' : ''}${mostrarOpciones ? ' is-open' : ''}`}
        style={isFixed ? fixedStyle : undefined}
        aria-label={ariaLabel}
      >
        <div className="filter-search-wrapper">
          <label className="inventario-filter-search" htmlFor={`${idPrefix}-busqueda`}>
            <FaSearch />
            <input
              id={`${idPrefix}-busqueda`}
              type="search"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={placeholder}
              maxLength="100"
            />
          </label>
          <button 
            type="button" 
            className={`filter-toggle-btn ${tieneFiltrosActivos ? 'has-active' : ''}`}
            onClick={() => setMostrarOpciones(!mostrarOpciones)}
            aria-expanded={mostrarOpciones}
            aria-label="Alternar opciones de filtrado"
          >
            <FiFilter />
            <span>Filtros</span>
            {mostrarOpciones ? <FiChevronUp /> : <FiChevronDown />}
          </button>
        </div>

        {mostrarOpciones && (
          <div
            className={`inventario-filter-group animate-slide-down${stackedSelects ? ' is-stacked' : ''}`}
          >
            {selects.map((s) => (
              <CustomSelect
                key={s.id}
                value={s.value}
                onChange={s.onChange}
                options={s.options || []}
                placeholder={s.label}
                className="inventario-filter-select"
              />
            ))}
            {sliders.map((sl) => (
              <RangeSlider
                key={sl.id}
                min={sl.min}
                max={sl.max}
                value={sl.value}
                onChange={sl.onChange}
                label={sl.label}
                unit={sl.unit}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
