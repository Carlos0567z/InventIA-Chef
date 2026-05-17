/**
 * Aviso breve abajo (no bloquea como alert)
 */
export function showToast(mensaje, tipo = 'ok') {
  if (typeof document === 'undefined' || !mensaje) return;

  const prev = document.querySelectorAll('.app-toast');
  prev.forEach((n) => n.remove());

  const el = document.createElement('div');
  el.className = `app-toast app-toast--${tipo === 'error' ? 'error' : 'ok'}`;
  el.textContent = mensaje;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  document.body.appendChild(el);

  requestAnimationFrame(() => el.classList.add('app-toast--visible'));

  const quitar = () => {
    el.classList.remove('app-toast--visible');
    const fin = () => {
      el.removeEventListener('transitionend', fin);
      el.remove();
    };
    el.addEventListener('transitionend', fin);
    setTimeout(fin, 350);
  };

  setTimeout(quitar, 2600);
}
