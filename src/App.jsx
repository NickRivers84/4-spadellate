/*
  4 Spadellate – Modalità Classica
  4 ristoranti fissi
  4 partecipanti fissi
*/

import React, { useState, useEffect, useRef } from "react";

/* =========================
   AUDIO FX
========================= */
const playFX = (name, volume = 0.6) => {
  const audio = new Audio(`/audio/${name}`);
  audio.volume = volume;
  audio.play().catch(() => {});
};

/* =========================
   MUSIC PLAYER
========================= */
function MusicPlayer({ enabled }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) {
      ref.current = new Audio("/audio/background.mp3");
      ref.current.loop = true;
      ref.current.volume = 0.4;
    }

    enabled ? ref.current.play().catch(() => {}) : ref.current.pause();
  }, [enabled]);

  return null;
}

/* =========================
   RANDOM PHRASE
========================= */
function RandomPhrase() {
  const phrases = [
    "Qui si spadella sul serio.",
    "Il voto pesa come il conto.",
    "La cucina non perdona.",
    "Qui decide la tavolata."
  ];

  const [text, setText] = useState(phrases[0]);

  useEffect(() => {
    const i = setInterval(() => {
      setText(phrases[Math.floor(Math.random() * phrases.length)]);
    }, 5000);
    return () => clearInterval(i);
  }, []);

  return <p className="phrase">{text}</p>;
}

/* =========================
   VOTE SCREEN
========================= */
function VoteScreen({ restaurants, onFinish }) {
  const TOTAL_PLAYERS = 4;

  const [player, setPlayer] = useState(0);
  const [rest, setRest] = useState(0);
  const [votes, setVotes] = useState([]);
  const [bonusUsed, setBonusUsed] = useState(false);
  const [scores, setScores] = useState({
    cibo: 5,
    servizio: 5,
    location: 5,
    conto: 5
  });

  const total = Object.values(scores).reduce((a, b) => a + b, 0);

  const submit = () => {
    let score = total;
    if (!bonusUsed) {
      score += 5;
      setBonusUsed(true);
    }

    const updated = [...votes, { rest, score }];
    setVotes(updated);

    let r = rest + 1;
    let p = player;

    if (r >= 4) {
      r = 0;
      p++;
    }

    if (p >= TOTAL_PLAYERS) {
      onFinish(updated);
      return;
    }

    setRest(r);
    setPlayer(p);
    setScores({ cibo: 5, servizio: 5, location: 5, conto: 5 });
    playFX("confirm.mp3");
  };

  const slider = (label, key) => (
    <div className="slider">
      <label>{label}: {scores[key]}</label>
      <input
        type="range"
        min="0"
        max="10"
        value={scores[key]}
        onChange={(e) =>
          setScores({ ...scores, [key]: Number(e.target.value) })
        }
      />
    </div>
  );

  return (
    <div className="screen vote">
      <h3>
        Giocatore {player + 1} → {restaurants[rest]}
      </h3>

      {slider("🍝 Cibo", "cibo")}
      {slider("🛎 Servizio", "servizio")}
      {slider("🏠 Location", "location")}
      {slider("💸 Conto", "conto")}

      <p className="total">
        Totale: {total}
        {!bonusUsed && " (+5 bonus)"}
      </p>

      <button onClick={submit}>Conferma voto</button>
    </div>
  );
}

/* =========================
   RANKING
========================= */
function RankingScreen({ restaurants, votes, onRestart }) {
  const scores = Array(4).fill(0);

  votes.forEach((v) => {
    scores[v.rest] += v.score;
  });

  const ranking = restaurants
    .map((name, i) => ({ name, score: scores[i] }))
    .sort((a, b) => b.score - a.score);

  return (
    <div className="screen ranking">
      <h2>🏆 Classifica finale</h2>

      {ranking.map((r, i) => (
        <div key={i} className={`rank ${i === 0 ? "winner" : ""}`}>
          {i + 1}. {r.name} — {r.score}
        </div>
      ))}

      <button onClick={onRestart}>Nuova partita</button>
    </div>
  );
}

/* =========================
   APP
========================= */
export default function App() {
  const [screen, setScreen] = useState("home");
  const [votes, setVotes] = useState([]);
  const [music, setMusic] = useState(false);

  const restaurants = [
    "La Bottega",
    "Trattoria Roma",
    "Osteria Bella",
    "Spadella"
  ];

  return (
    <div className="app">
      <MusicPlayer enabled={music} />

      {screen === "home" && (
        <div className="screen home">
          <h1>🍳 4 Spadellate</h1>
          <button onClick={() => setScreen("vote")}>
            Inizia partita 🍷
          </button>
        </div>
      )}

      {screen === "vote" && (
        <>
          <RandomPhrase />
          <VoteScreen
            restaurants={restaurants}
            onFinish={(v) => {
              setVotes(v);
              setScreen("ranking");
            }}
          />
        </>
      )}

      {screen === "ranking" && (
        <RankingScreen
          restaurants={restaurants}
          votes={votes}
          onRestart={() => setScreen("home")}
        />
      )}
    </div>
  );
}