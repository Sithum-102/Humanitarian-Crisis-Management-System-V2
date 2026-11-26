const BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5122').replace(/\/$/, '');
const TIMEOUT_MS = 30000;
const TOKEN_KEY = 'humanaid_token';

const endpoints = {
  incidents: 'incidents',
  requests: 'emergencyrequests',
  operations: 'operations',
  resources: 'resources',
  shelters: 'shelters',
  volunteers: 'volunteers',
  organizations: 'organizations',
  users: 'users'
};

export const keys = Object.keys(endpoints);
export const API_BASE = BASE;

/** Error carrying the HTTP status so the UI can react to 401/403 without string matching. */
export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let unauthorizedHandler = null;
/** App registers a callback that runs when an authenticated request comes back 401. */
export function onUnauthorized(handler) { unauthorizedHandler = handler; }

export function getToken() {
  try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; }
}
function setToken(token) {
  try { sessionStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ }
}
export function clearToken() {
  try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
}

function messageFrom(payload, status) {
  if (payload?.message) return payload.message;
  if (payload?.errors && typeof payload.errors === 'object') {
    const first = Object.values(payload.errors).flat()[0];
    if (first) return String(first);
  }
  if (payload?.detail || payload?.title) return payload.detail || payload.title;
  if (status === 401) return 'Session expired or invalid. Please sign in again.';
  if (status === 403) return 'Your role does not permit this action.';
  if (status === 429) return 'Too many attempts. Please wait a minute and try again.';
  if (status >= 500) return 'The server hit an unexpected error. Please try again.';
  return `Request failed (${status})`;
}

export async function api(path, { method = 'GET', body, token = getToken() } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response;

  try {
    response = await fetch(`${BASE}/api/${path}`, {
      method,
      signal: controller.signal,
      headers: {
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
  } catch (error) {
    throw new ApiError(
      error.name === 'AbortError'
        ? 'The server took too long to respond. Please try again.'
        : `Cannot reach the API at ${BASE}. Is the backend running?`
    );
  } finally {
    clearTimeout(timer);
  }

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    // A 401 on a signed-in request means the token is gone/expired; a 401 from login is just bad credentials.
    if (response.status === 401 && token && unauthorizedHandler) unauthorizedHandler();
    throw new ApiError(messageFrom(payload, response.status), response.status);
  }
  return payload;
}

export async function login(email, password) {
  const result = await api('auth/login', { method: 'POST', body: { email, password }, token: null });
  setToken(result.token);
  return result;
}

export async function register(name, email, password) {
  const result = await api('auth/register', { method: 'POST', body: { name, email, password }, token: null });
  setToken(result.token);
  return result;
}

export function health() { return api('health', { token: null }); }

/**
 * Loads every registry in parallel. A failing registry no longer blanks the whole app:
 * the others still load and the failures are reported in `errors`.
 */
export async function loadData(role) {
  const entries = await Promise.all(keys.map(async key => {
    if (key === 'users' && role !== 'Admin') return { key, rows: [] };
    try {
      const rows = (await api(endpoints[key])).map(item => fromApi(key, item));
      return { key, rows };
    } catch (error) {
      if (error.status === 401) throw error;
      return { key, rows: [], error: error.message };
    }
  }));

  const failed = entries.filter(entry => entry.error);

  return {
    data: Object.fromEntries(entries.map(entry => [entry.key, entry.rows])),
    failed: failed.map(entry => entry.key),
    errors: [...new Set(failed.map(entry => entry.error))]
  };
}

export function save(key, form, id) {
  return api(`${endpoints[key]}${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: toApi(key, form) });
}

export function remove(key, id) { return api(`${endpoints[key]}/${id}`, { method: 'DELETE' }); }

// Frontend field names differ from the API for a few registries; map them here only.
export function fromApi(key, row) {
  if (key === 'incidents') return { ...row, people: row.peopleAffected };
  if (key === 'requests') return { ...row, requester: row.requesterName, need: row.description };
  if (key === 'operations') return { ...row, name: row.title, area: row.location };
  if (key === 'shelters') return { ...row, occupied: row.occupancy };
  if (key === 'volunteers') return { ...row, availability: row.status };
  return row;
}

export function toApi(key, form) {
  const value = { ...form };
  delete value.id;
  if (key === 'incidents') { value.peopleAffected = Number(value.people || 0); delete value.people; }
  if (key === 'requests') {
    value.requesterName = value.requester; value.description = value.need;
    value.category ||= 'General'; value.location ||= '';
    delete value.requester; delete value.need;
  }
  if (key === 'operations') { value.title = value.name; value.location = value.area; delete value.name; delete value.area; }
  if (key === 'shelters') { value.occupancy = Number(value.occupied || 0); delete value.occupied; }
  if (key === 'volunteers') { value.status = value.availability; delete value.availability; }
  if (key === 'users') { value.password = value.password || null; }
  return value;
}
