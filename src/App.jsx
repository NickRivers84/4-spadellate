import React, { useState } from "react";

export default function App() {
  const [screen, setScreen] = useState("home");
  const [mode, setMode] = useState(null);

  const [players, setPlayers] = useState(4);
  const [restaurantsCount, setRestaurantsCount] = useState(4);

  const [restaurants, setRestaurants] = useState([
    "La Bottega",
    "Trattoria Roma",
    "Osteria Bella",
    "Spadella"
  ]);

  /* =========================
     RESET CONFIG
  ========================== */
  const startClassic = () => {
    setMode("classic");
    setPlayers(4);
    setRestaurantsCount(4);
    setRestaurants([
      "La Bottega",
      "Trattoria Roma",
      "Osteria Bella",
      "Spadella"
    ]);
    setScreen("game");
  };

  const startOneShot = () => {
    setMode("oneshot");
    setRestaurantsCount(1);
    setRestaurants(["Ristorante Unico"]);
    setScreen("setupPlayers");
  };

  const startCustom = () => {
    setMode("custom");
    setScreen("setupCustom");
  };

  /* =========================
     HOME
  ========================== */
  if (screen === "home") {
    return (
      <div className="app home-bg">
        <div className="card">
          <h1 className="title">🍳 4 Spadellate</h1>
          <p className="subtitle">
            Scegli la modalità di gioco
          </p>

          <button className="primary-btn" onClick={startClassic}>
            Modalità Classica
          </button>

          <button
            className="secondary-btn"
            onClick={startOneShot}
            style={{ marginTop: "12px" }}
          >
            Modalità One Shot
          </button>

          <button
            className="secondary-btn"
            onClick={startCustom}
            style={{ marginTop: "12px" }}
          >
            Modalità Personalizzata
          </button>
        </div>
      </div>
    );
  }

  /* =========================
     SETUP ONE SHOT
  ========================== */
  if (screen === "setupPlayers") {
    return (
      <div className="app home-bg">
        <div className="card">
          <h2>One Shot</h2>
          <p>Numero partecipanti</p>

          <input
            type="range"
            min="2"
            max="8"
            value={players}
            onChange={(e) => setPlayers(Number(e.target.value))}
          />

          <p>{players} giocatori</p>

          <button
            className="primary-btn"
            onClick={() => setScreen("game")}
          >
            Inizia
          </button>

          <button
            className="secondary-btn"
            onClick={() => setScreen("home")}
            style={{ marginTop: "12px" }}
          >
            Indietro
          </button>
        </div>
      </div>
    );
  }

  /* =========================
     SETUP PERSONALIZZATA
  ========================== */
  if (screen === "setupCustom") {
    return (
      <div className="app home-bg">
        <div className="card">
          <h2>Modalità Personalizzata</h2>

          <p>Giocatori</p>
          <input
            type="range"
            min="2"
            max="8"
            value={players}
            onChange={(e) => setPlayers(Number(e.target.value))}
          />
          <p>{players} giocatori</p>

          <p>Ristoranti</p>
          <input
            type="range"
            min="2"
            max="8"
            value={restaurantsCount}
            onChange={(e) => {
              const value = Number(e.target.value);
              setRestaurantsCount(value);
              setRestaurants(
                Array.from(
                  { length: value },
                  (_, i) => `Ristorante ${i + 1}`
                )
              );
            }}
          />
          <p>{restaurantsCount} ristoranti</p>

          <button
            className="primary-btn"
            onClick={() => setScreen("game")}
          >
            Inizia
          </button>

          <button
            className="secondary-btn"
            onClick={() => setScreen("home")}
            style={{ marginTop: "12px" }}
          >
            Indietro
          </button>
        </div>
      </div>
    );
  }

  /* =========================
     GAME
  ========================== */
  if (screen === "game") {
    return (
      <div className="app home-bg">
        <div className="card">
          <h2>
            {mode === "classic" && "Modalità Classica"}
            {mode === "oneshot" && "Modalità One Shot"}
            {mode === "custom" && "Modalità Personalizzata"}
          </h2>

          <p>{players} giocatori</p>
          <p>{restaurantsCount} ristoranti</p>

          <ul style={{ padding: 0, listStyle: "none" }}>
            {restaurants.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>

          <button
            className="primary-btn"
            onClick={() => setScreen("ranking")}
          >
            Vai alla classifica
          </button>
        </div>
      </div>
    );
  }

  /* =========================
     RANKING
  ========================== */
  return (
    <div className="app home-bg">
      <div className="card">
        <h2>🏆 Classifica Finale</h2>
        <p>Classifica simulata</p>

        <button
          className="primary-btn"
          onClick={() => setScreen("home")}
        >
          Nuova partita
        </button>
      </div>
    </div>
  );
}
