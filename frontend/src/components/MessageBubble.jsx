export default function MessageBubble({ role, children }) {
  return <div className={`message ${role}`}><div className="message-label">{role === 'user' ? 'You' : 'SmartAssist'}</div><div className="message-text">{children}</div></div>;
}
