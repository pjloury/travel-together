// Use environment variable for production, fallback to localhost for dev
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('token');

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // Handle 401 — token expired or invalid
  if (response.status === 401) {
    // Don't clear token for public endpoints that don't need auth
    if (token) {
      localStorage.removeItem('token');
      // Only redirect if we're not already on a public page
      const path = window.location.pathname;
      if (path !== '/login' && path !== '/register' && path !== '/discover' && !path.startsWith('/join')) {
        window.location.href = '/login';
        return; // Stop execution
      }
    }
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Request failed');
  }

  return data;
}

export const api = {
  get: (endpoint) => request(endpoint),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
};

export default api;
