const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || ''
).trim().replace(/\/$/, '');

// Must match API_ACCESS_TOKEN configured on the backend. Keep secrets out of
// source control; configure VITE_API_ACCESS_TOKEN in the frontend environment.
const API_TOKEN = (import.meta.env.VITE_API_ACCESS_TOKEN || '').trim();

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (API_TOKEN) headers.set('Authorization', `Bearer ${API_TOKEN}`);

  // Do not set Content-Type for FormData; the browser adds its boundary.
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  let data = {};
  if (contentType.includes('application/json')) {
    data = await response.json();
  }

  if (!response.ok) {
    throw new Error(
      data.detail || data.message || `Request failed (${response.status})`
    );
  }

  return data;
}

export const api = {
  // Public health endpoint, intentionally does not require the API token.
  health: () => request('/api/health'),

  chat: (message, conversationId = '') =>
    request('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        conversation_id: conversationId || null,
      }),
    }),

  upload: (files, conversationId) => {
    const form = new FormData();
    for (const file of files) form.append('files', file);

    return request(
      `/api/upload?conversation_id=${encodeURIComponent(conversationId)}`,
      { method: 'POST', body: form }
    );
  },

  documents: conversationId =>
    request(`/api/documents?conversation_id=${encodeURIComponent(conversationId)}`),

  clearDocuments: conversationId =>
    request(
      `/api/documents?conversation_id=${encodeURIComponent(conversationId)}`,
      { method: 'DELETE' }
    ),

  clearChat: (conversationId = '') =>
    request('/api/clear-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId || null }),
    }),
};
