import { Component } from "react"
import "./App.css"

export default class ErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary:", error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="errorBoundary">
          <div className="errorBoundaryContent">
            <h1>Qualcosa è andato storto</h1>
            <p>Ricarica la pagina per riprovare.</p>
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
