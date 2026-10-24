
const API_BASE = (
  import.meta.env.VITE_API_BASE_URL || ''
).trim().replace(/\/$/, '');

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : {};

  if (!response.ok) {
    throw new Error(
      data.detail || data.message || `Request failed (${response.status})`
    );
  }

  return data;
}

export const api = {
  health: () => request('/health'),

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

    for (const file of files) {
      form.append('files', file);
    }

    return request(
      `/api/upload?conversation_id=${encodeURIComponent(conversationId)}`,
      {
        method: 'POST',
        body: form,
      }
    );
  },

  documents: conversationId =>
    request(
      `/api/documents?conversation_id=${encodeURIComponent(conversationId)}`
    ),

  clearDocuments: conversationId =>
    request(
      `/api/documents?conversation_id=${encodeURIComponent(conversationId)}`,
      { method: 'DELETE' }
    ),

  clearChat: (conversationId = '') =>
    request('/api/clear-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        conversation_id: conversationId || null,
      }),
    }),
};
