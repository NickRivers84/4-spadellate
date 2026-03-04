import React, { useState } from "react";

export default function App() {
  const [screen, setScreen] = useState("home");
  const [votes, setVotes] = useState([]);

  const restaurants = [
    "La Bottega",
    "Trattoria Roma",
    "Osteria Bella",
    "Spadella"
  ];

  if (screen === "home") {
    return (
      <div className="app">
        <div className="screen">
          <h1>🍳 4 Spadellate</h1>
          <button onClick={() => setScreen("vote")}>
            Inizia partita
          </button>
        </div>
      </div>
    );
  }

  if (screen === "vote") {
    return (
      <div className="app">
        <div className="screen">
          <h2>Modalità Classica</h2>
          <p>4 ristoranti – 4 partecipanti</p>
          <button onClick={() => setScreen("ranking")}>
            Vai alla classifica
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="screen">
        <h2>🏆 Classifica</h2>
        <ul>
          {restaurants.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
        <button onClick={() => setScreen("home")}>
          Nuova partita
        </button>
      </div>
    </div>
  );
}
