// src/ErrorBoundary.jsx
import React from "react";

/**
 * Capture toute erreur de rendu et l'affiche SUR LA PAGE (au lieu d'un écran
 * blanc). Indépendant des filtres de la console DevTools.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.error) {
      const e = this.state.error;
      return (
        <div style={{ padding: 24, fontFamily: "system-ui", maxWidth: 820, margin: "40px auto" }}>
          <h2 style={{ color: "#dc2626", marginBottom: 12 }}>Une erreur a empêché l'affichage</h2>
          <pre style={{
            background: "#fff5f5", border: "1px solid #fecaca", borderRadius: 8,
            padding: 16, whiteSpace: "pre-wrap", fontSize: 13, color: "#7f1d1d", overflow: "auto",
          }}>
            {String(e?.stack || e?.message || e)}
          </pre>
        </div>
      );
    }
    return this.props.children;
  }
}
