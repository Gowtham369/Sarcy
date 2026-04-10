import { useState, useRef, useEffect } from "react";
import "./ChatWindow.css";

const VIBE_EMOJIS = {
  dry: "😐",
  savage: "💀",
  theatrical: "🎭",
  british: "🎩",
  gen_z: "💅",
};

export default function ChatWindow({
  history, onSend, loading, vibe, vibeLabel,
  model, models, onModelChange, onVibeChange, backendUrl
}) {
  const [input, setInput] = useState("");
  const [vibes, setVibes] = useState({});
  const [showVibeMenu, setShowVibeMenu] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetch(`${backendUrl}/vibes`)
      .then(r => r.json())
      .then(setVibes)
      .catch(() => {});
  }, [backendUrl]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [history, loading]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    onSend(input.trim());
    setInput("");
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="chat-container">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-brand">🎭 sarcast.ai</div>
        <div className="chat-controls">
          {/* Vibe selector */}
          <div className="vibe-selector">
            <button
              className="vibe-btn"
              onClick={() => setShowVibeMenu(!showVibeMenu)}
            >
              {VIBE_EMOJIS[vibe]} {vibeLabel}
            </button>
            {showVibeMenu && (
              <div className="vibe-dropdown">
                {Object.entries(vibes).map(([key, label]) => (
                  <button
                    key={key}
                    className={`vibe-option ${vibe === key ? "active" : ""}`}
                    onClick={() => { onVibeChange(key, label); setShowVibeMenu(false); }}
                  >
                    {VIBE_EMOJIS[key]} {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Model selector */}
          <select
            className="model-select"
            value={model}
            onChange={e => onModelChange(e.target.value)}
          >
            {models.map(m => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {history.length === 0 && (
          <div className="chat-empty">
            <div className="empty-icon">🎭</div>
            <p>Go ahead. Ask something obvious.<br/>I dare you.</p>
          </div>
        )}
        {history.map((msg, i) => (
          <div key={i} className={`message message-${msg.role}`}>
            <div className="message-bubble">
              {msg.role === "assistant" && (
                <span className="message-vibe">{VIBE_EMOJIS[vibe]}</span>
              )}
              <p>{msg.content}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="message message-assistant">
            <div className="message-bubble loading-bubble">
              <span className="message-vibe">{VIBE_EMOJIS[vibe]}</span>
              <div className="typing-dots">
                <span /><span /><span />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="chat-input-area">
        <textarea
          className="chat-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="Ask something. I'll judge you for it."
          rows={1}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={loading || !input.trim()}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
