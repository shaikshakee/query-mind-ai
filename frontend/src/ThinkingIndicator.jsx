
import "./ThinkingIndicator.css";

export default function ThinkingIndicator() {
  return (
    <div className="thinking-container" role="status" aria-live="polite">
      <div className="thinking-avatar">✦</div>

      <div className="thinking-content">
        <div className="thinking-title">Query Mind</div>

        <div className="thinking-message">
          <span>Thinking</span>
          <span className="thinking-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </div>
      </div>
    </div>
  );
}
