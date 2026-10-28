
import "./ThinkingIndicator.css";

export default function ThinkingIndicator() {
  return (
    <div
      className="thinking-container"
      role="status"
      aria-live="polite"
      aria-label="Query Mind is preparing a response"
    >
      <div className="thinking-avatar">✦</div>

      <div className="thinking-content">
        <div className="thinking-title">Query Mind</div>

        <div className="thinking-message">
          <span className="thinking-word">Generating</span>
          <span className="thinking-cursor" aria-hidden="true" />
        </div>
      </div>
    </div>
  );
}
