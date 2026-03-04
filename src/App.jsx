import React, { useState, useEffect } from "react";

export default function App() {
  const [screen, setScreen] = useState("home");
  const [mode, setMode] = useState(null);
  const [players, setPlayers] = useState(4);
  const [restaurants, setRestaurants] = useState([]);
  const [votes, setVotes] = useState({});
  const [currentPlayer, setCurrentPlayer] = useState(0);
  const [currentRestaurant, setCurrentRestaurant] = useState(0);

  /* ================= SALVATAGGIO AUTOMATICO ================= */

  useEffect(() => {
    const saved = localStorage.getItem("spadellate_save");
    if (saved) {
      const data = JSON.parse(saved);
      setScreen(data.screen);
      setMode(data.mode);
      setPlayers(data.players);
      setRestaurants(data.restaurants);
      setVotes(data.votes);
      setCurrentPlayer(data.currentPlayer);
      setCurrentRestaurant(data.currentRestaurant);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "spadellate_save",
      JSON.stringify({
        screen,
        mode,
        players,
        restaurants,
        votes,
        currentPlayer,
        currentRestaurant
      })
    );
  }, [screen, mode, players, restaurants, votes, currentPlayer, currentRestaurant]);

  const resetGame = () => {
    localStorage.removeItem("spadellate_save");
    setScreen("home");
  };

  /* ================= MODALITÀ ================= */

  const startClassic = () => {
    setMode("classic");
    setPlayers(4);
    setRestaurants([
      "La Bottega",
      "Trattoria Roma",
      "Osteria Bella",
      "Spadella"
    ]);
    setVotes({});
    setCurrentPlayer(0);
    setCurrentRestaurant(0);
    setScreen("vote");
  };

  const startOneShot = () => {
    setMode("oneshot");
    setRestaurants(["Ristorante Unico"]);
    setVotes({});
    setCurrentPlayer(0);
    setScreen("setupOneShot");
  };

  const startCustom = () => {
    setMode("custom");
    setVotes({});
    setScreen("setupCustom");
  };

  /* ================= HOME ================= */

  if (screen === "home") {
    return (
      <div className="app bg-home fade">
        <div className="card">
          <h1>🍳 4 Spadellate</h1>
          <button className="primary-btn" onClick={startClassic}>
            Modalità Classica
          </button>
          <button className="secondary-btn" onClick={startOneShot}>
            Modalità One Shot
          </button>
          <button className="secondary-btn" onClick={startCustom}>
            Modalità Personalizzata
          </button>
        </div>
      </div>
    );
  }

  /* ================= ONE SHOT SETUP ================= */

  if (screen === "setupOneShot") {
    return (
      <div className="app bg-home fade">
        <div className="card">
          <h2>One Shot</h2>
          <input
            type="range"
            min="2"
            max="8"
            value={players}
            onChange={(e) => setPlayers(Number(e.target.value))}
          />
          <p>{players} giocatori</p>
          <button className="primary-btn" onClick={() => setScreen("vote")}>
            Inizia
          </button>
        </div>
      </div>
    );
  }

  /* ================= PERSONALIZZATA ================= */

  if (screen === "setupCustom") {
    return (
      <div className="app bg-home fade">
        <div className="card">
          <h2>Personalizzata</h2>

          <p>Giocatori</p>
          <input
            type="range"
            min="2"
            max="8"
            value={players}
            onChange={(e) => setPlayers(Number(e.target.value))}
          />

          <p>Ristoranti</p>
          <input
            type="range"
            min="2"
            max="8"
            onChange={(e) =>
              setRestaurants(
                Array.from(
                  { length: Number(e.target.value) },
                  (_, i) => `Ristorante ${i + 1}`
                )
              )
            }
          />

          <button className="primary-btn" onClick={() => setScreen("vote")}>
            Inizia
          </button>
        </div>
      </div>
    );
  }

  /* ================= VOTAZIONE ================= */

  if (screen === "vote") {
    const currentRest = restaurants[currentRestaurant];

    const submitVote = (value) => {
      const updated = { ...votes };
      if (!updated[currentRest]) updated[currentRest] = [];
      updated[currentRest].push(value);
      setVotes(updated);

      if (mode === "oneshot") {
        if (currentPlayer + 1 >= players) {
          setScreen("ranking");
        } else {
          setCurrentPlayer(currentPlayer + 1);
        }
      } else {
        if (currentRestaurant + 1 < restaurants.length) {
          setCurrentRestaurant(currentRestaurant + 1);
        } else if (currentPlayer + 1 < players) {
          setCurrentPlayer(currentPlayer + 1);
          setCurrentRestaurant(0);
        } else {
          setScreen("ranking");
        }
      }
    };

    return (
      <div className="app bg-vote fade">
        <div className="card">
          <h2>
            Giocatore {currentPlayer + 1}
            <br />
            {currentRest}
          </h2>

          <div className="vote-grid">
            {[...Array(10)].map((_, i) => (
              <button
                key={i}
                className="vote-btn"
                onClick={() => submitVote(i + 1)}
              >
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ================= CLASSIFICA ================= */

  const ranking = Object.entries(votes)
    .map(([name, v]) => ({
      name,
      avg: v.reduce((a, b) => a + b, 0) / v.length
    }))
    .sort((a, b) => b.avg - a.avg);

  return (
    <div className="app bg-result fade">
      <div className="card">
        <h2>🏆 Verdetto Finale</h2>

        {ranking.map((r, i) => (
          <p key={i}>
            {i + 1}. {r.name} – {r.avg.toFixed(2)}
          </p>
        ))}

        <button className="primary-btn" onClick={resetGame}>
          Nuova partita
        </button>
      </div>
    </div>
  );
}
