/**
 * Drop-in replacement for @base44/sdk client — talks to the local MySQL
 backend (server/index.js). No Base44 SDK dependency.
 * Set VITE_API_URL to point at the backend (default http://localhost:4000/api).
 */
const API = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
const TOKEN_KEY = 'kp_token';

const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
const setToken = (t) => (t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY));

async function request(path, { method = 'GET', body, headers } = {}) {
  const h = { ...headers };
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    if (body instanceof FormData) {
      payload = body;
    } else {
      h['Content-Type'] = 'application/json';
      payload = JSON.stringify(body);
    }
  }
  const res = await fetch(`${API}${path}`, { method, headers: h, body: payload });
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    const err = new Error((data && data.error) || res.statusText || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function entityApi(name) {
  return {
    async list(sort, limit) {
      const q = new URLSearchParams();
      if (sort) q.set('sort', sort);
      if (limit) q.set('limit', limit);
      return request(`/entities/${name}?${q.toString()}`);
    },
    async filter(query, sort, limit) {
      const q = new URLSearchParams();
      if (query) q.set('filter', JSON.stringify(query));
      if (sort) q.set('sort', sort);
      if (limit) q.set('limit', limit);
      return request(`/entities/${name}?${q.toString()}`);
    },
    async get(id) { return request(`/entities/${name}/${id}`); },
    async create(data) { return request(`/entities/${name}`, { method: 'POST', body: data }); },
    async bulkCreate(arr) { return request(`/entities/${name}/bulk`, { method: 'POST', body: arr }); },
    async update(id, data) { return request(`/entities/${name}/${id}`, { method: 'PUT', body: data }); },
    async delete(id) { return request(`/entities/${name}/${id}`, { method: 'DELETE' }); },
    async deleteMany(query) { return request(`/entities/${name}/deleteMany`, { method: 'POST', body: query }); },
    async updateMany(query, update) { return request(`/entities/${name}/updateMany`, { method: 'POST', body: { filter: query, set: update } }); },
    async bulkUpdate(arr) { return request(`/entities/${name}/bulkUpdate`, { method: 'POST', body: arr }); },
    subscribe() { return () => {}; },
    async schema() { return request(`/entities/${name}/schema`); },
  };
}

const entities = new Proxy({}, { get: (_, name) => entityApi(String(name)) });

const auth = {
  async me() {
    if (!getToken()) throw Object.assign(new Error('not authenticated'), { status: 401 });
    return request('/auth/me');
  },
  isAuthenticated() { return Promise.resolve(!!getToken()); },
  async login(email, password) { const r = await request('/auth/login', { method: 'POST', body: { email, password } }); setToken(r.token); return r; },
  async register(data) { const r = await request('/auth/register', { method: 'POST', body: data }); setToken(r.token); return r; },
  async updateMe(data) { return request('/auth/me', { method: 'PUT', body: data }); },
  logout(redirectUrl) { setToken(null); if (redirectUrl) window.location.href = redirectUrl; else window.location.reload(); },
  redirectToLogin(nextUrl) { window.location.href = '/login' + (nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : ''); },
};

const users = {
  async inviteUser(email, role) { return request('/users/invite', { method: 'POST', body: { email, role } }); },
};

const integrations = {
  Core: {
    async UploadFile({ file }) {
      const fd = new FormData();
      fd.append('file', file);
      return request('/uploads', { method: 'POST', body: fd });
    },
    async UploadPrivateFile({ file }) { return this.UploadFile({ file }); },
    async InvokeLLM(body) { return request('/integrations/llm', { method: 'POST', body }); },
    async SendEmail(body) { return request('/integrations/email', { method: 'POST', body }); },
    async GenerateImage(body) { return request('/integrations/image', { method: 'POST', body }); },
    async GenerateSpeech(body) { return request('/integrations/speech', { method: 'POST', body }); },
    async GenerateVideo(body) { return request('/integrations/video', { method: 'POST', body }); },
    async TranscribeAudio(body) { return request('/integrations/transcribe', { method: 'POST', body }); },
    async ExtractDataFromUploadedFile(body) { return { status: 'error', output: null }; },
    async CreateFileSignedUrl(body) { return body; },
  },
};

const analytics = { track: () => request('/analytics/track', { method: 'POST', body: {} }).catch(() => {}) };

export const base44 = { entities, auth, users, integrations, analytics, asServiceRole: null };
Object.defineProperty(base44, 'asServiceRole', { get: () => base44 });