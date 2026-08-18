const TOKEN_KEY = 'portfolio_admin_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function request(path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('The server did not respond. Check that the backend is running.');
    }
    throw new Error('Could not reach the API. Check that the backend is running.');
  } finally {
    clearTimeout(timeoutId);
  }

  if (response.status === 204) {
    return null;
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message = data?.detail || 'Request failed';
    throw new Error(typeof message === 'string' ? message : JSON.stringify(message));
  }

  return data;
}

export const api = {
  getProjects: () => request('/api/projects'),
  getIncomingProjects: () => request('/api/projects/incoming'),
  getProject: (slug) => request(`/api/projects/${slug}`),
  getAdminProjects: () => request('/api/admin/projects'),
  login: (email, password) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  me: () => request('/api/auth/me'),
  createProject: (payload) =>
    request('/api/projects', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateProject: (id, payload) =>
    request(`/api/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  deleteProject: (id) =>
    request(`/api/projects/${id}`, {
      method: 'DELETE',
    }),
  togglePublish: (id) =>
    request(`/api/projects/${id}/publish`, {
      method: 'PATCH',
    }),
};
