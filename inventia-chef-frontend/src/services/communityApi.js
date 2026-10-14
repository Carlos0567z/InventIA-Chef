import { authHeaders } from './auth';

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.mensaje || `Error HTTP ${response.status}`);
  }
  return payload;
}

export function listRecetasComunidad(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return request(`/api/recetas-comunidad/gestionar${qs ? `?${qs}` : ''}`, {
    headers: { ...authHeaders() },
  });
}

export function getRecetaComunidad(id) {
  return request(`/api/recetas-comunidad/gestionar/${id}`, {
    headers: { ...authHeaders() },
  });
}

export function aportarRecetaComunidad(payload) {
  return request('/api/recetas-comunidad/gestionar/aportar', {
    method: 'POST',
    headers: { ...authHeaders() },
    body: JSON.stringify(payload),
  });
}

export function updateRecetaComunidad(id, payload) {
  return request(`/api/recetas-comunidad/gestionar/${id}`, {
    method: 'PUT',
    headers: { ...authHeaders() },
    body: JSON.stringify(payload),
  });
}

export function deleteRecetaComunidad(id) {
  return request(`/api/recetas-comunidad/gestionar/${id}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
}

export function listMisRecetasComunidad() {
  return request('/api/recetas-comunidad/gestionar/mis-recetas', {
    headers: { ...authHeaders() },
  });
}

// -------------------------------------------------------------
// Interacciones Sociales: Likes & Valoraciones
// -------------------------------------------------------------
export function toggleLikeReceta(id) {
  return request(`/api/recetas-comunidad/gestionar/${id}/like`, {
    method: 'POST',
    headers: { ...authHeaders() },
  });
}

export function getComentarios(recetaId) {
  return request(`/api/recetas-comunidad/gestionar/${recetaId}/comentarios`);
}

export function crearComentario(recetaId, { puntuacion, contenido }) {
  return request(`/api/recetas-comunidad/gestionar/${recetaId}/comentarios`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: JSON.stringify({ puntuacion, contenido }),
  });
}

export function responderComentario(recetaId, comentarioId, texto) {
  return request(`/api/recetas-comunidad/gestionar/${recetaId}/comentarios/${comentarioId}/respuesta`, {
    method: 'POST',
    headers: { ...authHeaders() },
    body: JSON.stringify({ texto }),
  });
}

export function eliminarComentario(recetaId, comentarioId) {
  return request(`/api/recetas-comunidad/gestionar/${recetaId}/comentarios/${comentarioId}`, {
    method: 'DELETE',
    headers: { ...authHeaders() },
  });
}

// -------------------------------------------------------------
// Perfil Público del Cocinero
// -------------------------------------------------------------
export function getCocineroPerfil(cocineroId) {
  return request(`/api/perfil/cocinero/${cocineroId}`);
}

export function getCocineroRecetas(cocineroId) {
  return request(`/api/perfil/cocinero/${cocineroId}/recetas`);
}
