
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


  streamChat: async (message, conversationId = '', onChunk = () => {}, onMeta = () => {}) => {
    const response = await fetch(`${API_BASE}/api/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify({
        message,
        conversation_id: conversationId || null,
      }),
    });

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      let detail = `Request failed (${response.status})`;
      try {
        const data = contentType.includes('application/json')
          ? await response.json()
          : {};
        detail = data.detail || data.message || detail;
      } catch {}
      throw new Error(detail);
    }
    if (!response.body) throw new Error('Streaming response is not supported by this browser.');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finished = false;

    while (!finished) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const rawEvent of events) {
        let eventName = 'message';
        const dataLines = [];
        for (const line of rawEvent.split('\n')) {
          if (line.startsWith('event:')) eventName = line.slice(6).trim();
          else if (line.startsWith('data:')) dataLines.push(line.slice(5).trim());
        }
        if (!dataLines.length) continue;
        const payload = JSON.parse(dataLines.join('\n'));
        if (eventName === 'meta') onMeta(payload);
        else if (eventName === 'error') throw new Error(payload.detail || 'Streaming failed.');
        else if (eventName === 'done') finished = true;
        else if (payload.text) onChunk(payload.text);
      }
    }
  },
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
