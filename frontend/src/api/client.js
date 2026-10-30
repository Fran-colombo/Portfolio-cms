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
    const detail = data?.detail;
    let message = 'Request failed';
    if (typeof detail === 'string') {
      message = detail;
    } else if (Array.isArray(detail)) {
      const text = detail
        .map((item) => item?.msg)
        .filter(Boolean)
        .join('. ');
      message = text.includes('valid email') ? 'El email no es válido' : text || message;
    } else if (detail) {
      message = JSON.stringify(detail);
    }
    throw new Error(message);
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
  totpSetup: (pendingToken) =>
    request('/api/auth/totp/setup', {
      method: 'POST',
      body: JSON.stringify({ pending_token: pendingToken }),
    }),
  verifyTotp: (pendingToken, code) =>
    request('/api/auth/totp/verify', {
      method: 'POST',
      body: JSON.stringify({ pending_token: pendingToken, code }),
    }),
  me: () => request('/api/auth/me'),
  getUsers: () => request('/api/admin/users'),
  createUser: (payload) =>
    request('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateUser: (id, payload) =>
    request(`/api/admin/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteUser: (id) =>
    request(`/api/admin/users/${id}`, {
      method: 'DELETE',
    }),
  resetUserTotp: (id) =>
    request(`/api/admin/users/${id}/reset-totp`, {
      method: 'POST',
    }),
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
