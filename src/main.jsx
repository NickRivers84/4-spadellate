import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

/* =========================
   SERVICE WORKER + SMART UPDATE
========================= */

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => {

        // Quando trova una nuova versione
        registration.onupdatefound = () => {
          const newWorker = registration.installing;

          newWorker.onstatechange = () => {
            if (
              newWorker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              // Nuova versione disponibile
              showUpdateBanner(registration);
            }
          };
        };

      })
      .catch((err) => {
        console.log("SW registration failed:", err);
      });
  });
}

/* =========================
   UPDATE BANNER LOGIC
========================= */

function showUpdateBanner(registration) {
  const banner = document.getElementById("updateBanner");
  const btn = document.getElementById("updateBtn");

  if (!banner || !btn) return;

  banner.classList.remove("hidden");

  btn.onclick = () => {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: "SKIP_WAITING" });
    }
    window.location.reload();
  };
}