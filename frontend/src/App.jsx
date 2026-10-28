
import { useEffect, useRef, useState } from 'react';
import ThinkingIndicator from './ThinkingIndicator';
import './QueryMind.css';
import './QueryMindGlass.css';
import {
  Bot,
  Send,
  Trash2,
  Sparkles,
  RefreshCw,
  Paperclip,
  FileText,
} from 'lucide-react';

import { api } from './services/api';
import MessageBubble from './components/MessageBubble';

const initialMessages = [
  {
    role: 'assistant',
    content:
      'Hey! Welcome to Query Mind. Ask a question or upload a document and I’ll help you explore it.',
  },
];

function getSavedConversationId() {
  try {
    return localStorage.getItem('smartassist_conversation_id') || '';
  } catch {
    return '';
  }
}

export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [thinking, setThinking] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [apiHealth, setApiHealth] = useState(null);
  const [conversationId, setConversationId] = useState(
    getSavedConversationId
  );

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    const introTimer = setTimeout(() => setShowIntro(false), 2200);
    return () => clearTimeout(introTimer);
  }, []);

  useEffect(() => {
    let cancelled = false;

    api.health()
      .then(result => {
        if (!cancelled) setApiHealth(result);
      })
      .catch(() => {
        if (!cancelled) setApiHealth(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  function saveConversationId(id) {
    if (!id) return;

    setConversationId(id);

    try {
      localStorage.setItem('smartassist_conversation_id', id);
    } catch {
      // Chat can continue if browser storage is unavailable.
    }
  }

  function ensureConversationId() {
    const id =
      conversationId ||
      (globalThis.crypto?.randomUUID?.() ??
        `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`);

    saveConversationId(id);
    return id;
  }

  async function refreshDocuments(id = conversationId) {
    if (!id) {
      setDocuments([]);
      return;
    }

    try {
      const result = await api.documents(id);
      setDocuments(result.documents || []);
    } catch (error) {
      setStatus(error.message || 'Could not load uploaded files.');
    }
  }

  async function uploadFiles() {
    if (!selectedFiles.length || busy) return;

    const id = ensureConversationId();

    setBusy(true);
    setStatus('Uploading and extracting document text…');

    try {
      const result = await api.upload(selectedFiles, id);

      setDocuments(
        (result.documents || []).map(filename => {
          if (typeof filename === 'string') {
            return { filename };
          }
          return filename;
        })
      );

      const messages = [
        ...(result.uploaded || []).map(
          item =>
            `Uploaded ${item.filename} (${item.characters} characters)`
        ),
        ...(result.errors || []),
      ];

      setStatus(messages.join('\n') || 'Upload completed.');

      setSelectedFiles([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      setStatus(error.message || 'File upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function removeDocuments() {
    if (!conversationId || busy) return;

    try {
      const result = await api.clearDocuments(conversationId);
      setDocuments([]);
      setStatus(result.message || 'Uploaded documents removed.');
    } catch (error) {
      setStatus(error.message || 'Could not remove documents.');
    }
  }

  async function sendMessage() {
    const message = question.trim();

    if (!message || busy) return;

    const id = ensureConversationId();

    setQuestion('');
    setMessages(old => [...old, { role: 'user', content: message }]);
    setBusy(true);
    setThinking(true);
    setStatus('Query Mind is thinking…');

    try {
      const result = await api.chat(message, id);

      if (result.conversation_id) {
        saveConversationId(result.conversation_id);
      }

      setMessages(old => [
        ...old,
        {
          role: 'assistant',
          content: result.answer || 'No answer was returned.',
        },
      ]);

      setStatus(
        result.web_search_used
          ? 'Answer generated using web search.'
          : 'Answer generated.'
      );
    } catch (error) {
      setMessages(old => [
        ...old,
        {
          role: 'assistant',
          content: `Request failed: ${error.message || 'Unable to contact backend.'}`,
        },
      ]);

      setStatus(error.message || 'The request failed.');
    } finally {
      setBusy(false);
      setThinking(false);
    }
  }

  async function clearChat() {
    if (busy) return;

    try {
      await api.clearChat(conversationId);
    } catch (error) {
      setStatus(error.message || 'Could not clear server-side chat history.');
    }

    setMessages(initialMessages);
    setQuestion('');
    setDocuments([]);
    setSelectedFiles([]);
    setStatus('Chat cleared.');
    setConversationId('');

    try {
      localStorage.removeItem('smartassist_conversation_id');
    } catch {
      // Ignore unavailable browser storage.
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function onKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  async function refreshHealth() {
    try {
      const result = await api.health();
      setApiHealth(result);
      setStatus('Backend status refreshed.');
    } catch {
      setApiHealth(null);
      setStatus('Cannot connect to the backend. Check that it is running.');
    }
  }

  return (
    <>
    {showIntro && (
      <div className="querymind-intro" role="status" aria-label="Opening Query Mind">
        <div className="querymind-intro-orb"><Sparkles size={34} /></div>
        <div className="querymind-intro-wordmark">Query <span>Mind</span></div>
        <p>Your thoughts, one question away.</p>
        <div className="querymind-intro-loader"><span /><span /><span /></div>
        <button className="querymind-skip" onClick={() => setShowIntro(false)}>Skip intro</button>
      </div>
    )}
    <div className={`app-shell query-mind-theme ${showIntro ? 'app-under-intro' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Bot size={24} />
          </div>
          <div>
            <strong>Query Mind</strong>
            <span>Think clearly. Explore more.</span>
          </div>
        </div>

        <div className="sidebar-card">
          <div className="tiny-label">SYSTEM STATUS</div>

          <div className="status-line">
            <span
              className={`status-dot ${
                apiHealth?.status === 'ok' ? 'online' : ''
              }`}
            />

            {apiHealth?.status !== 'ok'
              ? 'Backend not connected'
              : apiHealth.model_loaded
                ? 'Backend connected · Model ready'
                : 'Backend connected · Model loading'}
          </div>

          <div className="sidebar-muted">
            {apiHealth?.model || 'Qwen AI model'}
          </div>
        </div>

        <div className="sidebar-card">
          <div className="tiny-label">ACCESS</div>
          <div className="signed-email">Open chat · No email login</div>
        </div>

        <div className="sidebar-footer">
          <Sparkles size={16} /> Curiosity, meet intelligence
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div>
            <div className="eyebrow">YOUR AI THINKING PARTNER</div>
            <h1>Query Mind</h1>
          </div>

          <div className="topbar-right">
            <span className="online-pill">
              <span
                className={`status-dot ${
                  apiHealth?.status === 'ok' ? 'online' : ''
                }`}
              />
              {apiHealth?.status === 'ok'
                ? 'API online'
                : 'API unavailable'}
            </span>

            <button
              className="quiet-button"
              onClick={refreshHealth}
              title="Refresh backend status"
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </header>

        <div className="workspace chat-only-workspace">
          <section className="chat-panel">
            <div className="chat-heading">
              <div className="bot-avatar">
                <Bot size={20} />
              </div>

              <div>
                <strong>Query Mind</strong>
                <span>
                  Ask anything or bring a document to explore
                </span>
              </div>

              <button
                className="quiet-button clear-chat"
                onClick={clearChat}
                disabled={busy}
              >
                <Trash2 size={14} /> Clear chat
              </button>
            </div>

            <div className="upload-row">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.txt,.md,.csv,.json,.py,.xml,.html,.htm,.log,.yaml,.yml"
                onChange={event =>
                  setSelectedFiles(
                    Array.from(event.target.files || [])
                  )
                }
                disabled={busy}
              />

              <button
                className="primary-button"
                onClick={uploadFiles}
                disabled={busy || selectedFiles.length === 0}
              >
                <Paperclip size={16} /> Upload files
              </button>

              {documents.length > 0 && (
                <button
                  className="quiet-button danger-text"
                  onClick={removeDocuments}
                  disabled={busy}
                >
                  <Trash2 size={14} /> Remove files
                </button>
              )}
            </div>

            <div className="file-hint">
              PDF, DOCX, TXT, MD, CSV, JSON, PY, XML, HTML and YAML ·
              Maximum 8 MB per file
            </div>

            {documents.length > 0 && (
              <div className="document-list">
                {documents.map((doc, index) => (
                  <div
                    className="document-item"
                    key={doc.filename || index}
                  >
                    <FileText size={15} />
                    <span>{doc.filename}</span>
                    {doc.characters != null && (
                      <small>
                        {Number(doc.characters).toLocaleString()} chars
                      </small>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="messages" ref={scrollRef}>
              {messages.map((message, index) => (
                <MessageBubble
                  role={message.role}
                  key={`${message.role}-${index}`}
                >
                  {message.content}
                </MessageBubble>
              ))}

              {thinking && <ThinkingIndicator />}
            </div>

            <div className="composer">
              <textarea
                value={question}
                onChange={event => setQuestion(event.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Ask Query Mind anything… (Enter to send, Shift+Enter for a new line)"
                rows={3}
                maxLength={5000}
                disabled={busy}
              />

              <div className="composer-bottom">
                <span>AI responses may need verification.</span>

                <button
                  className="send-button"
                  disabled={busy || !question.trim()}
                  onClick={sendMessage}
                >
                  <Send size={17} /> Send
                </button>
              </div>
            </div>
          </section>

          {status && <div className="status-banner">{status}</div>}
        </div>
      </main>
    </div>
    </>
  );
}
