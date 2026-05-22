/**
 * apiClient.ts
 *
 * Typed wrapper around the backend REST API.
 * When TEST_MODE is active all calls return mock data — no backend needed.
 *
 * Usage:
 *   import { api } from '@/lib/apiClient';
 *   const listings = await api.listings.list({ states: 'SC' });
 */

import { isTestMode }   from './testMode';
import * as mock        from './mockData';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

// -------------------------------------------------------------------------
// Core fetch helper
// -------------------------------------------------------------------------

async function apiFetch<T>(
  path:    string,
  options: RequestInit & {
    token?:  string;
    params?: Record<string, string | number | boolean | undefined>;
  } = {},
): Promise<T> {
  const { token, params, ...fetchOptions } = options;

  let url = `${BASE_URL}${path}`;
  if (params) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    const qsStr = qs.toString();
    if (qsStr) url += `?${qsStr}`;
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers as Record<string, string>),
  };

  const authToken = token ?? (typeof window !== 'undefined' ? getStoredToken() : null);
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res  = await fetch(url, { ...fetchOptions, headers });
  const json = await res.json();

  if (!res.ok) {
    const err  = json?.error;
    const code = err?.code   ?? 'SERVER_ERROR';
    const msg  = err?.message ?? `HTTP ${res.status}`;
    throw Object.assign(new Error(msg), { code, status: res.status });
  }

  return json.data as T;
}

function getStoredToken(): string | null {
  try {
    // Check localStorage first
    const lsKey = Object.keys(localStorage).find(k => k.endsWith('-auth-token'));
    if (lsKey) {
      const parsed = JSON.parse(localStorage.getItem(lsKey) ?? '{}');
      if (parsed?.access_token) return parsed.access_token;
    }

    // Fall back to cookie (Supabase SSR stores token in cookie)
    const cookieMatch = document.cookie
      .split('; ')
      .find(row => row.includes('-auth-token='));
    if (cookieMatch) {
      const raw = decodeURIComponent(cookieMatch.split('=').slice(1).join('='));
      // Cookie may be a JSON array [access_token, refresh_token] or a JSON object
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed[0] ?? null;
      if (parsed?.access_token) return parsed.access_token;
    }

    return null;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------------------
// Mock delay helper — makes test data feel real
// -------------------------------------------------------------------------

function delay(ms = 120): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// -------------------------------------------------------------------------
// Mock implementations (one for every real endpoint)
// -------------------------------------------------------------------------

const mockApi = {
  listings: {
    list: async (params?: any) => {
      await delay();
      let results = [...mock.MOCK_LISTINGS];
      if (params?.states) {
        const states = params.states.split(',');
        results = results.filter(l => states.includes(l.state));
      }
      if (params?.min_price) results = results.filter(l => l.price >= Number(params.min_price));
      if (params?.max_price) results = results.filter(l => l.price <= Number(params.max_price));
      if (params?.min_beds)  results = results.filter(l => (l.beds ?? 0) >= Number(params.min_beds));
      if (params?.status)    results = results.filter(l => params.status.split(',').includes(l.status));
      if (params?.city)      results = results.filter(l => l.city.toLowerCase().includes(params.city.toLowerCase()));
      return { data: results, meta: { page: 1, limit: 24, total: results.length } };
    },
    getById:      async (id: string) => { await delay(); return mock.MOCK_LISTINGS.find(l => l.id === id) ?? null; },
    save:         async () => { await delay(); return { saved: true }; },
    unsave:       async () => { await delay(); return { saved: false }; },
    saved:        async () => { await delay(); return mock.MOCK_LISTINGS.slice(0, 2); },
    createManual: async (body: any) => { await delay(); return { ...body, id: 'lst-new-' + Date.now(), source: 'manual', is_starred: false, listed_at: new Date().toISOString() }; },
    updateManual: async (_id: string, body: any) => { await delay(); return body; },
    deleteManual: async () => { await delay(); return { deleted: true }; },
    toggleStar:   async (_id: string, is_starred: boolean) => { await delay(); return { is_starred }; },
  },

  savedSearches: {
    list:         async () => { await delay(); return mock.MOCK_SAVED_SEARCHES; },
    create:       async (body: any) => { await delay(); return { ...body, id: 'ss-new-' + Date.now(), created_at: new Date().toISOString() }; },
    update:       async (_id: string, body: any) => { await delay(); return body; },
    delete:       async () => { await delay(); return { deleted: true }; },
    toggleNotify: async (_id: string, enabled: boolean) => { await delay(); return { notify_on_new_listings: enabled }; },
  },

  threads: {
    list:        async (_params?: any) => { await delay(); return mock.MOCK_THREADS; },
    get:         async (id: string) => { await delay(); const t = mock.MOCK_THREADS.find(t => t.id === id); return { thread: t, messages: mock.MOCK_MESSAGES[id] ?? [], has_more_messages: false }; },
    create:      async (body: any) => { await delay(); return { ...body, id: 'thr-new-' + Date.now(), last_message_at: new Date().toISOString() }; },
    messages:    async (id: string) => { await delay(); return mock.MOCK_MESSAGES[id] ?? []; },
    sendMessage: async (_id: string, body: any) => { await delay(); return { id: 'msg-new-' + Date.now(), ...body, sent_at: new Date().toISOString(), read_at: null }; },
    markRead:    async () => { await delay(); return { marked_read: 3 }; },
  },

  chat: {
    agentStatus:    async () => { await delay(50); return mock.MOCK_AGENT_STATUS; },
    createSession:  async (body: any) => { await delay(); return { session: { id: 'sess-new', ...body, status: 'waiting', started_at: new Date().toISOString() }, agentOnline: true }; },
    sessions:       async () => { await delay(); return []; },
    getSession:     async (id: string) => { await delay(); return { session: { id, status: 'active' }, messages: [] }; },
    join:           async () => { await delay(); return {}; },
    sendMessage:    async (_id: string, content: string) => { await delay(); return { id: 'cm-' + Date.now(), content, sender_type: 'guest', sent_at: new Date().toISOString() }; },
    close:          async () => { await delay(); return { status: 'closed' }; },
    convert:        async () => { await delay(); return { threadId: 'thr-converted-' + Date.now() }; },
    setAgentStatus: async (status: string) => { await delay(); return { status }; },
  },

  appointments: {
    types:       async () => { await delay(); return mock.MOCK_APPOINTMENT_TYPES; },
    slots:       async () => { await delay(); return mock.MOCK_SLOTS; },
    list:        async () => { await delay(); return mock.MOCK_APPOINTMENTS; },
    get:         async (id: string) => { await delay(); return mock.MOCK_APPOINTMENTS.find(a => a.id === id); },
    book:        async (body: any) => { await delay(); return { ...body, id: 'apt-new-' + Date.now(), status: 'pending', created_at: new Date().toISOString() }; },
    confirm:     async () => { await delay(); return { status: 'confirmed' }; },
    counter:     async (_id: string, body: any) => { await delay(); return { ...body, status: 'counter_proposed' }; },
    acceptCounter: async () => { await delay(); return { status: 'confirmed' }; },
    cancel:      async () => { await delay(); return { status: 'cancelled' }; },
  },

  notifications: {
    list:        async () => { await delay(); return mock.MOCK_NOTIFICATIONS; },
    markRead:    async () => { await delay(); return { read_at: new Date().toISOString() }; },
    markAllRead: async () => { await delay(); return { marked_read: 2 }; },
    subscribe:   async () => { await delay(); return { subscribed: true }; },
    unsubscribe: async () => { await delay(); return { unsubscribed: true }; },
  },

  blog: {
    list:       async (_params?: any) => { await delay(); return { data: mock.MOCK_BLOG_POSTS, meta: { total: mock.MOCK_BLOG_POSTS.length } }; },
    get:        async (id: string) => { await delay(); return mock.MOCK_BLOG_POSTS.find(p => p.id === id) ?? null; },
    getBySlug:  async (slug: string) => { await delay(); return mock.MOCK_BLOG_POSTS.find(p => p.slug === slug) ?? null; },
    drafts:     async () => { await delay(); return []; },
    create:     async (body: any) => { await delay(); return { ...body, id: 'blg-new-' + Date.now(), status: 'draft', created_at: new Date().toISOString() }; },
    update:     async (_id: string, body: any) => { await delay(); return body; },
    publish:    async (id: string) => { await delay(); return { id, status: 'published', published_at: new Date().toISOString() }; },
    unpublish:  async (id: string) => { await delay(); return { id, status: 'draft' }; },
    delete:     async () => { await delay(); return { deleted: true }; },
    uploadImage: async () => { await delay(); return { url: 'https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800' }; },
  },

  documents: {
    list:        async () => { await delay(); return []; },
    register:    async (body: any) => { await delay(); return { ...body, id: 'doc-' + Date.now() }; },
    downloadUrl: async () => { await delay(); return { url: '#' }; },
    delete:      async () => { await delay(); return { deleted: true }; },
  },

  leads: {
    list:     async () => { await delay(); return mock.MOCK_LEADS; },
    get:      async (id: string) => { await delay(); return mock.MOCK_LEADS.find(l => l.id === id); },
    update:   async (_id: string, body: any) => { await delay(); return body; },
    activity: async () => { await delay(); return { threads: mock.MOCK_THREADS.slice(0, 1), appointments: mock.MOCK_APPOINTMENTS.slice(0, 1), chat_sessions: [] }; },
    capture:  async (_body: any) => { await delay(); return { captured: true }; },
  },

  schedule: {
    getAvailability:    async () => { await delay(); return [...mock.MOCK_WEEKLY_AVAILABILITY]; },
    updateAvailability: async (_body: any) => { await delay(); return { saved: true }; },
    getBlockedDates:    async () => { await delay(); return [...mock.MOCK_BLOCKED_DATES]; },
    addBlockedDate:     async (date: string) => { await delay(); return { date }; },
    removeBlockedDate:  async (_date: string) => { await delay(); return { removed: true }; },
    getAppointmentTypes:    async () => { await delay(); return [...mock.MOCK_SCHEDULE_APPOINTMENT_TYPES]; },
    updateAppointmentType:  async (_id: string, body: any) => { await delay(); return body; },
  },
};

// -------------------------------------------------------------------------
// Real API implementations
// -------------------------------------------------------------------------

const realApi = {
  listings: {
    list: (params?: any) =>
      apiFetch<any>('/api/v1/listings', { params }),
    getById: (id: string) =>
      apiFetch<any>(`/api/v1/listings/${id}`),
    save: (id: string, listing_type = 'mls') =>
      apiFetch<any>(`/api/v1/listings/${id}/save`, { method: 'POST', body: JSON.stringify({ listing_type }) }),
    unsave: (id: string) =>
      apiFetch<any>(`/api/v1/listings/${id}/save`, { method: 'DELETE' }),
    saved: () =>
      apiFetch<any[]>('/api/v1/listings/saved'),
    createManual: (body: any) =>
      apiFetch<any>('/api/v1/listings/manual', { method: 'POST', body: JSON.stringify(body) }),
    updateManual: (id: string, body: any) =>
      apiFetch<any>(`/api/v1/listings/manual/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    deleteManual: (id: string) =>
      apiFetch<any>(`/api/v1/listings/manual/${id}`, { method: 'DELETE' }),
    toggleStar: (id: string, is_starred: boolean) =>
      apiFetch<any>(`/api/v1/listings/manual/${id}/star`, { method: 'PATCH', body: JSON.stringify({ is_starred }) }),
  },
  savedSearches: {
    list: () => apiFetch<any[]>('/api/v1/saved-searches'),
    create: (body: any) => apiFetch<any>('/api/v1/saved-searches', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => apiFetch<any>(`/api/v1/saved-searches/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    delete: (id: string) => apiFetch<any>(`/api/v1/saved-searches/${id}`, { method: 'DELETE' }),
    toggleNotify: (id: string, enabled: boolean) => apiFetch<any>(`/api/v1/saved-searches/${id}/notify`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  },
  threads: {
    list: (params?: any) => apiFetch<any[]>('/api/v1/threads', { params }),
    get: (id: string) => apiFetch<any>(`/api/v1/threads/${id}`),
    create: (body: any) => apiFetch<any>('/api/v1/threads', { method: 'POST', body: JSON.stringify(body) }),
    messages: (id: string, params?: any) => apiFetch<any[]>(`/api/v1/threads/${id}/messages`, { params }),
    sendMessage: (id: string, body: any) => apiFetch<any>(`/api/v1/threads/${id}/messages`, { method: 'POST', body: JSON.stringify(body) }),
    markRead: (id: string) => apiFetch<any>(`/api/v1/threads/${id}/read-all`, { method: 'POST' }),
  },
  chat: {
    agentStatus: () => apiFetch<any>('/api/v1/chat/agent-status'),
    createSession: (body: any) => apiFetch<any>('/api/v1/chat/sessions', { method: 'POST', body: JSON.stringify(body) }),
    sessions: (params?: any) => apiFetch<any[]>('/api/v1/chat/sessions', { params }),
    getSession: (id: string) => apiFetch<any>(`/api/v1/chat/sessions/${id}`),
    join: (id: string) => apiFetch<any>(`/api/v1/chat/sessions/${id}/join`, { method: 'POST' }),
    sendMessage: (id: string, content: string) => apiFetch<any>(`/api/v1/chat/sessions/${id}/messages`, { method: 'POST', body: JSON.stringify({ content }) }),
    close: (id: string) => apiFetch<any>(`/api/v1/chat/sessions/${id}/close`, { method: 'PATCH' }),
    convert: (id: string, subject?: string) => apiFetch<any>(`/api/v1/chat/sessions/${id}/convert`, { method: 'POST', body: JSON.stringify({ subject }) }),
    setAgentStatus: (status: string) => apiFetch<any>('/api/v1/chat/agent-status', { method: 'PATCH', body: JSON.stringify({ status }) }),
  },
  appointments: {
    types: () => apiFetch<any[]>('/api/v1/appointments/appointment-types'),
    slots: (params: any) => apiFetch<any[]>('/api/v1/appointments/availability', { params }),
    list: (params?: any) => apiFetch<any[]>('/api/v1/appointments', { params }),
    get: (id: string) => apiFetch<any>(`/api/v1/appointments/${id}`),
    book: (body: any) => apiFetch<any>('/api/v1/appointments', { method: 'POST', body: JSON.stringify(body) }),
    confirm: (id: string) => apiFetch<any>(`/api/v1/appointments/${id}/confirm`, { method: 'PATCH' }),
    counter: (id: string, body: any) => apiFetch<any>(`/api/v1/appointments/${id}/counter`, { method: 'PATCH', body: JSON.stringify(body) }),
    acceptCounter: (id: string) => apiFetch<any>(`/api/v1/appointments/${id}/accept-counter`, { method: 'PATCH' }),
    cancel: (id: string, body?: any) => apiFetch<any>(`/api/v1/appointments/${id}/cancel`, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  },
  notifications: {
    list: (params?: any) => apiFetch<any[]>('/api/v1/notifications', { params }),
    markRead: (id: string) => apiFetch<any>(`/api/v1/notifications/${id}/read`, { method: 'PATCH' }),
    markAllRead: () => apiFetch<any>('/api/v1/notifications/read-all', { method: 'POST' }),
    subscribe: (subscription: any) => apiFetch<any>('/api/v1/push/subscribe', { method: 'POST', body: JSON.stringify(subscription) }),
    unsubscribe: (endpoint: string) => apiFetch<any>('/api/v1/push/subscribe', { method: 'DELETE', body: JSON.stringify({ endpoint }) }),
  },
  blog: {
    list: (params?: any) => apiFetch<any>('/api/v1/blog', { params }),
    get: (id: string) => apiFetch<any>(`/api/v1/blog/id/${id}`),
    getBySlug: (slug: string) => apiFetch<any>(`/api/v1/blog/${slug}`),
    drafts: () => apiFetch<any[]>('/api/v1/blog/drafts'),
    create: (body: any) => apiFetch<any>('/api/v1/blog', { method: 'POST', body: JSON.stringify(body) }),
    update: (id: string, body: any) => apiFetch<any>(`/api/v1/blog/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    publish: (id: string) => apiFetch<any>(`/api/v1/blog/${id}/publish`, { method: 'PATCH' }),
    unpublish: (id: string) => apiFetch<any>(`/api/v1/blog/${id}/unpublish`, { method: 'PATCH' }),
    delete: (id: string) => apiFetch<any>(`/api/v1/blog/${id}`, { method: 'DELETE' }),
    uploadImage: (file_path: string) => apiFetch<any>('/api/v1/blog/images', { method: 'POST', body: JSON.stringify({ file_path }) }),
  },
  documents: {
    list: () => apiFetch<any[]>('/api/v1/documents'),
    register: (body: any) => apiFetch<any>('/api/v1/documents', { method: 'POST', body: JSON.stringify(body) }),
    downloadUrl: (id: string) => apiFetch<any>(`/api/v1/documents/${id}/download`),
    delete: (id: string) => apiFetch<any>(`/api/v1/documents/${id}`, { method: 'DELETE' }),
  },
  leads: {
    list: (params?: any) => apiFetch<any[]>('/api/v1/leads', { params }),
    get: (id: string) => apiFetch<any>(`/api/v1/leads/${id}`),
    update: (id: string, body: any) => apiFetch<any>(`/api/v1/leads/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    activity: (id: string) => apiFetch<any>(`/api/v1/leads/${id}/activity`),
    capture: (body: { email: string; name?: string; source?: string; context?: string }) =>
      apiFetch<any>('/api/v1/leads/capture', { method: 'POST', body: JSON.stringify(body) }),
  },

  schedule: {
    getAvailability:    () => apiFetch<any[]>('/api/v1/appointments/availability/windows'),
    updateAvailability: (body: any) => apiFetch<any>('/api/v1/appointments/availability/windows', { method: 'PUT', body: JSON.stringify({ windows: body }) }),
    getBlockedDates:    () => apiFetch<any[]>('/api/v1/appointments/availability/blocks').then((rows: any[]) => rows.map((r: any) => r.blocked_date)),
    addBlockedDate:     (date: string) => apiFetch<any>('/api/v1/appointments/availability/blocks', { method: 'POST', body: JSON.stringify({ blocked_date: date }) }),
    removeBlockedDate:  (id: string) => apiFetch<any>(`/api/v1/appointments/availability/blocks/${id}`, { method: 'DELETE' }),
    getAppointmentTypes:   () => apiFetch<any[]>('/api/v1/appointments/appointment-types'),
    updateAppointmentType: (id: string, body: any) => apiFetch<any>(`/api/v1/appointments/appointment-types/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  },
};

// -------------------------------------------------------------------------
// Export — transparently switches between real and mock
// -------------------------------------------------------------------------

export function getApi() {
  if (isTestMode()) return mockApi;
  return realApi;
}

// Convenience alias used throughout the app
export const api = new Proxy({} as typeof realApi, {
  get(_target, section: string) {
    const client = isTestMode() ? mockApi : realApi;
    return (client as any)[section];
  },
});

// Named alias for server-side imports in pages
export const apiClient = api;
