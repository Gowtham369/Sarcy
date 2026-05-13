import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("Render error caught by ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d0d0d",
          color: "#f0f0f0",
          fontFamily: "'DM Mono', monospace",
          gap: "16px",
          padding: "24px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "3rem" }}>🎭</div>
          <h2 style={{ fontFamily: "'Syne', sans-serif", color: "#e8ff47", fontSize: "1.4rem" }}>
            Something crashed (how embarrassing)
          </h2>
          <p style={{ color: "#888", maxWidth: "400px", lineHeight: 1.6 }}>
            An unexpected error occurred. Reload the page to try again — the app is too mortified to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "8px",
              padding: "10px 24px",
              background: "#e8ff47",
              color: "#0d0d0d",
              border: "none",
              borderRadius: "8px",
              fontFamily: "'DM Mono', monospace",
              fontWeight: "bold",
              cursor: "pointer",
              fontSize: "0.9rem",
            }}
          >
            Reload
          </button>
          {this.state.error && (
            <details style={{ marginTop: "16px", color: "#555", fontSize: "0.75rem", maxWidth: "500px" }}>
              <summary style={{ cursor: "pointer", color: "#666" }}>Error details</summary>
              <pre style={{ marginTop: "8px", whiteSpace: "pre-wrap", textAlign: "left" }}>
                {this.state.error.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
