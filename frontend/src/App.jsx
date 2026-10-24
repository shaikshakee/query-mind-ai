
import { useEffect, useRef, useState } from 'react';
import {
  Send,
  Trash2,
  Sparkles,
  RefreshCw,
  Paperclip,
  FileText,
  Plus,
  MessageSquare,
} from 'lucide-react';

import { api } from './services/api';
import MessageBubble from './components/MessageBubble';
import ThinkingIndicator from './ThinkingIndicator';
import './QueryMind.css';

const initialMessages = [
  {
    role: 'assistant',
    content:
      'Hey! Welcome to Query Mind. 👋 Ask me anything, upload a document, or let’s explore an idea together.',
  },
];

const ACCEPTED_FILES =
  '.pdf,.docx,.txt,.md,.csv,.json,.py,.xml,.html,.htm,.log,.yaml,.yml';

function getSavedConversationId() {
  try {
    return localStorage.getItem('smartassist_conversation_id') || '';
  } catch {
    return '';
  }
}

export default function App() {
  const [showIntro, setShowIntro] = useState(true);
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [isRemovingFiles, setIsRemovingFiles] = useState(false);
  const [status, setStatus] = useState('');
  const [apiHealth, setApiHealth] = useState(null);
  const [conversationId, setConversationId] = useState(
    getSavedConversationId
  );

  const busy = isUploading || isThinking || isRemovingFiles;

  const scrollRef = useRef(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  // Query Mind opening animation
  useEffect(() => {
    const timer = setTimeout(() => setShowIntro(false), 2400);
    return () => clearTimeout(timer);
  }, []);

  // Check backend health
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

  // Scroll only the conversation, never the entire page
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, busy]);

  function saveConversationId(id) {
    if (!id) return;

    setConversationId(id);

    try {
      localStorage.setItem('smartassist_conversation_id', id);
    } catch {
      // Browser storage is optional.
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
      setStatus(error.message || 'Could not load documents.');
    }
  }

  // Upload selected documents
  async function uploadFiles() {
    if (!selectedFiles.length || busy) return;

    const id = ensureConversationId();

    setIsUploading(true);
    setStatus('');

    try {
      const result = await api.upload(selectedFiles, id);

      const uploadedDocuments = (result.documents || []).map(item =>
        typeof item === 'string' ? { filename: item } : item
      );

      setDocuments(uploadedDocuments);

      const uploadMessages = [
        ...(result.uploaded || []).map(
          item =>
            `Uploaded ${item.filename} (${item.characters} characters)`
        ),
        ...(result.errors || []),
      ];

      setStatus(uploadMessages.join('\n') || 'Upload completed.');

      setSelectedFiles([]);

      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

      await refreshDocuments(id);
    } catch (error) {
      setStatus(error.message || 'File upload failed.');
    } finally {
      setIsUploading(false);
    }
  }

  // Remove uploaded documents
  async function removeDocuments() {
    if (!conversationId || busy) return;

    setIsRemovingFiles(true);
    setStatus('');

    try {
      const result = await api.clearDocuments(conversationId);
      setDocuments([]);
      setStatus(result.message || 'Uploaded documents removed.');
    } catch (error) {
      setStatus(error.message || 'Could not remove documents.');
    } finally {
      setIsRemovingFiles(false);
    }
  }

  // Send a message to the backend
  async function sendMessage(text = question) {
    const message = text.trim();

    if (!message || busy) return;

    const id = ensureConversationId();

    setQuestion('');
    setMessages(previous => [
      ...previous,
      { role: 'user', content: message },
    ]);

    setIsThinking(true);
    setStatus('');

    try {
      const result = await api.chat(message, id);

      if (result.conversation_id) {
        saveConversationId(result.conversation_id);
      }

      setMessages(previous => [
        ...previous,
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
      setMessages(previous => [
        ...previous,
        {
          role: 'assistant',
          content: `Request failed: ${
            error.message || 'Unable to contact backend.'
          }`,
        },
      ]);

      setStatus(error.message || 'The request failed.');
    } finally {
      setIsThinking(false);
    }
  }

  // Start a new conversation
  async function clearChat() {
    if (busy) return;

    try {
      if (conversationId) {
        await api.clearChat(conversationId);
      }
    } catch (error) {
      setStatus(error.message || 'Could not clear server-side chat history.');
    }

    setMessages(initialMessages);
    setQuestion('');
    setDocuments([]);
    setSelectedFiles([]);
    setConversationId('');
    setStatus('New conversation started.');

    try {
      localStorage.removeItem('smartassist_conversation_id');
    } catch {
      // Ignore unavailable browser storage.
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    textareaRef.current?.focus();
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

  function useSuggestion(text) {
    setQuestion(text);
    textareaRef.current?.focus();
  }

  const backendOnline = apiHealth?.status === 'ok';

  return (
    <>
      {/* Opening animation */}
      {showIntro && (
        <div
          className="querymind-intro"
          role="status"
          aria-label="Opening Query Mind"
        >
          <div className="querymind-intro-orb">
            <Sparkles size={36} />
          </div>

          <div className="querymind-intro-wordmark">
            Query <span>Mind</span>
          </div>

          <p>Your thoughts, one question away.</p>

          <div className="querymind-intro-loader">
            <span />
            <span />
            <span />
          </div>

          <button
            className="querymind-skip"
            onClick={() => setShowIntro(false)}
          >
            Skip intro
          </button>
        </div>
      )}

      <div
        className={`app-shell query-mind-theme ${
          showIntro ? 'app-under-intro' : ''
        }`}
      >
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">
              <Sparkles size={23} />
            </div>

            <div>
              <strong>Query Mind</strong>
              <span>Think clearly. Explore more.</span>
            </div>
          </div>

          <button
            className="new-chat-button"
            onClick={clearChat}
            disabled={busy}
          >
            <Plus size={17} />
            New chat
          </button>

          <div className="sidebar-section-title">YOUR WORKSPACE</div>

          <div className="sidebar-card">
            <div className="tiny-label">SYSTEM STATUS</div>

            <div className="status-line">
              <span
                className={`status-dot ${backendOnline ? 'online' : ''}`}
              />

              {!backendOnline
                ? 'Backend unavailable'
                : apiHealth?.model_loaded
                  ? 'AI model ready'
                  : 'Backend connected · Model not ready'}
            </div>

            <div className="sidebar-muted">
              {apiHealth?.model || 'Qwen AI model'}
            </div>
          </div>

          <div className="sidebar-card">
            <div className="tiny-label">DOCUMENTS</div>

            <div className="status-line">
              <FileText size={15} />
              {documents.length} uploaded file
              {documents.length === 1 ? '' : 's'}
            </div>
          </div>

          <div className="sidebar-footer">
            <Sparkles size={16} />
            Curiosity meets intelligence.
          </div>
        </aside>

        {/* Main window */}
        <main className="main-area">
          <header className="topbar">
            <div>
              <div className="eyebrow">YOUR AI THINKING PARTNER</div>
              <h1>Query Mind</h1>
            </div>

            <div className="topbar-right">
              <span className="online-pill">
                <span
                  className={`status-dot ${backendOnline ? 'online' : ''}`}
                />
                {backendOnline ? 'API online' : 'API unavailable'}
              </span>

              <button
                className="quiet-button"
                onClick={refreshHealth}
                title="Refresh backend status"
              >
                <RefreshCw size={14} />
                Refresh
              </button>
            </div>
          </header>

          <div className="workspace chat-only-workspace">
            <section className="chat-panel">
              {/* macOS-style chat title bar */}
              <div className="chat-heading">
                <div className="mac-window-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>

                <div className="bot-avatar">
                  <Sparkles size={20} />
                </div>

                <div className="chat-heading-title">
                  <strong>Query Mind</strong>
                  <span>What would you like to explore today?</span>
                </div>

                <button
                  className="quiet-button clear-chat"
                  onClick={clearChat}
                  disabled={busy}
                  title="Clear conversation"
                >
                  <Trash2 size={14} />
                  Clear chat
                </button>
              </div>

              {/* Custom file picker: no overflowing native button */}
              <div className="upload-row">
                <input
                  ref={fileInputRef}
                  id="querymind-file-input"
                  className="hidden-file-input"
                  type="file"
                  multiple
                  accept={ACCEPTED_FILES}
                  onChange={event =>
                    setSelectedFiles(Array.from(event.target.files || []))
                  }
                  disabled={busy}
                />

                <div className="file-picker-area">
                  <label
                    htmlFor="querymind-file-input"
                    className={`choose-file-button ${
                      busy ? 'disabled' : ''
                    }`}
                    aria-disabled={busy}
                  >
                    <Paperclip size={16} />
                    Choose files
                  </label>

                  <span
                    className="selected-file-name"
                    title={selectedFiles.map(file => file.name).join(', ')}
                  >
                    {selectedFiles.length === 0
                      ? 'No files selected'
                      : selectedFiles.length === 1
                        ? selectedFiles[0].name
                        : `${selectedFiles.length} files selected`}
                  </span>
                </div>

                <div className="file-actions">
                  <button
                    className="primary-button"
                    onClick={uploadFiles}
                    disabled={busy || selectedFiles.length === 0}
                  >
                    <Paperclip size={16} />
                    {isUploading ? 'Uploading…' : 'Upload'}
                  </button>

                  {documents.length > 0 && (
                    <button
                      className="quiet-button danger-text"
                      onClick={removeDocuments}
                      disabled={busy}
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="file-hint">
                PDF, DOCX, TXT, MD, CSV, JSON, PY, XML, HTML and YAML
                {' · '}Maximum 8 MB per file
              </div>

              {/* Uploaded documents */}
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

              {/* Conversation: this is the scrolling area */}
              <div className="messages" ref={scrollRef}>
                {messages.map((message, index) => (
                  <MessageBubble
                    role={message.role}
                    key={`${message.role}-${index}`}
                  >
                    {message.content}
                  </MessageBubble>
                ))}

                {isThinking && <ThinkingIndicator />}

                {messages.length === 1 && !busy && (
                  <div className="querymind-suggestions">
                    <button
                      onClick={() =>
                        useSuggestion('Explain a complex topic simply.')
                      }
                    >
                      <Sparkles size={17} />
                      <span>
                        <strong>Learn something</strong>
                        <small>Explain a complex topic simply</small>
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        useSuggestion('Help me brainstorm a new project idea.')
                      }
                    >
                      <MessageSquare size={17} />
                      <span>
                        <strong>Brainstorm ideas</strong>
                        <small>Explore a new project idea</small>
                      </span>
                    </button>

                    <button
                      onClick={() =>
                        useSuggestion(
                          'Summarize the key points of my uploaded document.'
                        )
                      }
                    >
                      <FileText size={17} />
                      <span>
                        <strong>Analyze a document</strong>
                        <small>Summarize important information</small>
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {/* Fixed composer */}
              <div className="composer">
                <textarea
                  ref={textareaRef}
                  value={question}
                  onChange={event => setQuestion(event.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Message Query Mind…"
                  rows={3}
                  maxLength={5000}
                  disabled={busy}
                />

                <div className="composer-bottom">
                  <span>
                    Enter to send · Shift + Enter for a new line
                  </span>

                  <button
                    className="send-button"
                    disabled={busy || !question.trim()}
                    onClick={() => sendMessage()}
                    aria-label="Send message"
                  >
                    <Send size={17} />
                    Send
                  </button>
                </div>
              </div>
            </section>

            {status && (
              <div className="status-banner" role="status">
                {status}
              </div>
            )}
          </div>
        </main>
      </div>
    </>
  );
}
