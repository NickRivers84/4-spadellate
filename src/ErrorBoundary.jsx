import { Component } from "react"
import "./App.css"

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary:", error, info)
  }

  render() {
    if (this.state.hasError) {
      const err = this.state.error
      const isDev = typeof import.meta !== "undefined" && import.meta.env?.DEV
      return (
        <div className="errorBoundary">
          <div className="errorBoundaryContent">
            <h1>Qualcosa è andato storto</h1>
            <p>Ricarica la pagina per riprovare.</p>
            {isDev && err && (
              <pre className="errorBoundaryDebug" style={{ textAlign: "left", fontSize: "12px", overflow: "auto", maxHeight: "200px", marginTop: "12px", padding: "8px", background: "#fff3", borderRadius: "8px" }}>
                {err.message}
                {err.stack && "\n\n" + err.stack}
              </pre>
            )}
            <button type="button" onClick={() => window.location.reload()}>
              Ricarica
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
