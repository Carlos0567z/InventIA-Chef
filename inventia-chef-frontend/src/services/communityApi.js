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
  return request(`/api/recetas-comunidad/gestionar${qs ? `?${qs}` : ''}`);
}

export function getRecetaComunidad(id) {
  return request(`/api/recetas-comunidad/gestionar/${id}`);
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
