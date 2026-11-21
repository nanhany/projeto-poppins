const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

export async function api(path, options = {}) {
  const token = localStorage.getItem('poppins_token');
  const headers = { ...(options.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers };
  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const body = response.status === 204 ? null : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error || 'Não foi possível concluir a solicitação.');
  return body;
}
