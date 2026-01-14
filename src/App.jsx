import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import { auth, db } from "./firebase.js";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

const provider = new GoogleAuthProvider();

// storage keys
const LOCAL_ACTIVE_KEY = "4spadellate_active_backup_v1";

// firestore paths
const activeDoc = (uid) => doc(db, "users", uid);
const matchDoc = (uid, matchId) => doc(db, "matches", uid, "items", matchId);
const historyCol = (uid) => collection(db, "history", uid, "items");

// ------- Audio helpers (non si rompono se i file non esistono) -------
async function urlExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}
async function safePlay(url, { loop = false, volume = 0.5 } = {}) {
  if (!(await urlExists(url))) return null;
  const a = new Audio(url);
  a.loop = loop;
  a.volume = volume;
  try {
    await a.play();
    return a;
  } catch {
    return null;
  }
}
async function playFX(name, volume = 0.55) {
  await safePlay(`/audio/${name}`, { loop: false, volume });
}

function newMatchId() {
  return "SPAD-" + Math.random().toString(36).slice(2, 8).toUpperCase();
}

export default function App() {
  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("loading"); // loading | login | home | setup | vote | ranking | history
  const [cloudStatus, setCloudStatus] = useState("ok"); // ok | offline

  // active match
  const [activeId, setActiveId] = useState(null);
  const [match, setMatch] = useState(null);
  const [loadingActive, setLoadingActive] = useState(false);

  // history
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // music
  const bgRef = useRef(null);
  const [musicOn, setMusicOn] = useState(false);

  // auth
  useEffect(() => {
    getRedirectResult(auth).catch(() => {});
    return onAuthStateChanged(auth, async (u) => {
      if (!u) {
        setUser(null);
        setActiveId(null);
        setMatch(null);
        setHistory([]);
        setScreen("login");
        return;
      }
      setUser(u);
      setScreen("home");
      await loadActive(u.uid);
      await loadHistory(u.uid);
    });
  }, []);

  // music start/stop
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!musicOn) {
        if (bgRef.current) {
          bgRef.current.pause();
          bgRef.current = null;
        }
        return;
      }
      if (!bgRef.current) {
        const a = await safePlay("/audio/background.mp3", {
          loop: true,
          volume: 0.35,
        });
        if (cancelled) return;
        bgRef.current = a;
      } else {
        bgRef.current.play().catch(() => {});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [musicOn]);

  // ---------- Cloud helpers ----------
  async function loadActive(uid = user?.uid) {
    if (!uid) return;
    setLoadingActive(true);
    try {
      const snap = await getDoc(activeDoc(uid));
      if (snap.exists() && snap.data()?.activeMatchId) {
        const id = snap.data().activeMatchId;
        setActiveId(id);
        const msnap = await getDoc(matchDoc(uid, id));
        setMatch(msnap.exists() ? msnap.data() : null);
      } else {
        setActiveId(null);
        setMatch(null);
      }
      setCloudStatus("ok");
    } catch {
      setCloudStatus("offline");
      // fallback locale
      const local = localStorage.getItem(LOCAL_ACTIVE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        setActiveId(parsed?.id || null);
        setMatch(parsed || null);
      } else {
        setActiveId(null);
        setMatch(null);
      }
    } finally {
      setLoadingActive(false);
    }
  }

  async function saveActive(uid, data) {
    // backup locale always
    localStorage.setItem(LOCAL_ACTIVE_KEY, JSON.stringify(data));

    try {
      await setDoc(matchDoc(uid, data.id), { ...data, updatedAt: serverTimestamp() }, { merge: true });
      await setDoc(activeDoc(uid), { activeMatchId: data.id, updatedAt: serverTimestamp() }, { merge: true });
      setCloudStatus("ok");
    } catch {
      setCloudStatus("offline");
    }
  }

  async function clearActive(uid = user?.uid) {
    localStorage.removeItem(LOCAL_ACTIVE_KEY);
    setActiveId(null);
    setMatch(null);

    if (!uid) return;
    try {
      // solo “stacca” l’attiva; il documento partita resta (storico/recupero)
      await setDoc(activeDoc(uid), { activeMatchId: null, updatedAt: serverTimestamp() }, { merge: true });
      setCloudStatus("ok");
    } catch {
      setCloudStatus("offline");
    }
  }

  async function loadHistory(uid = user?.uid) {
    if (!uid) return;
    setLoadingHistory(true);
    try {
      const q = query(historyCol(uid), orderBy("endedAt", "desc"), limit(20));
      const snaps = await getDocs(q);
      setHistory(snaps.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCloudStatus("ok");
    } catch {
      // storico non critico se offline
      setCloudStatus("offline");
    } finally {
      setLoadingHistory(false);
    }
  }

  async function pushHistory(uid, finishedMatch, ranking) {
    // salva solo un riassunto “da party”
    const winner = ranking[0]?.name || "—";
    const payload = {
      matchId: finishedMatch.id,
      winner,
      ranking,
      players: finishedMatch.settings.players,
      restaurants: finishedMatch.settings.restaurants,
      endedAt: serverTimestamp(),
    };

    try {
      const id = `${Date.now()}_${finishedMatch.id}`;
      await setDoc(doc(historyCol(uid), id), payload, { merge: true });
      setCloudStatus("ok");
    } catch {
      setCloudStatus("offline");
    }
  }

  // ---------- Screens ----------
  if (screen === "loading") {
    return (
      <div className="screen center">
        <h1>🍳 4 Spadellate</h1>
        <p className="subtitle">Carico la tavolata…</p>
      </div>
    );
  }

  if (screen === "login") {
    return (
      <div className="screen center">
        <h1>🍳 4 Spadellate</h1>
        <p className="subtitle">Accedi per salvare partite anche per mesi.</p>
        <button onClick={() => signInWithRedirect(auth, provider)}>
          Accedi con Google
        </button>
      </div>
    );
  }

  if (screen === "home") {
    const hasOngoing = !!match?.settings && match?.finished === false;

    return (
      <div className="screen center">
        <div className="topbar">
          <div>
            <h2 style={{ margin: 0 }}>
              Ciao {user?.displayName?.split(" ")[0] || "Chef"} 👋
            </h2>
            <p className="subtitle" style={{ marginTop: 6 }}>
              {cloudStatus === "offline"
                ? "⚠️ Cloud non raggiungibile: salvo localmente e sincronizzo appena torna."
                : "Stasera si giudica come in TV. Ma siete voi la giuria."}
            </p>
          </div>
          <button className="ghost" onClick={() => signOut(auth)}>
            Esci
          </button>
        </div>

        <div className="card">
          <div className="toggles">
            <label className="toggle">
              <input
                type="checkbox"
                checked={musicOn}
                onChange={async (e) => {
                  setMusicOn(e.target.checked);
                  await playFX("tap.mp3", 0.35);
                }}
              />
              Musica (se presente)
            </label>
          </div>
        </div>

        {loadingActive ? (
          <p className="subtitle">Controllo se c’è una partita in corso…</p>
        ) : (
          <>
            {hasOngoing ? (
              <>
                <button
                  onClick={async () => {
                    await playFX("confirm.mp3", 0.45);
                    setMusicOn(!!match?.settings?.music);
                    setScreen("vote");
                  }}
                >
                  Riprendi partita
                </button>
                <button
                  className="ghost"
                  onClick={async () => {
                    await playFX("tap.mp3", 0.35);
                    await clearActive();
                    setScreen("setup");
                  }}
                >
                  Nuova partita (azzera)
                </button>
              </>
            ) : (
              <button
                onClick={async () => {
                  await playFX("confirm.mp3", 0.45);
                  setScreen("setup");
                }}
              >
                Inizia partita
              </button>
            )}

            <button
              className="ghost"
              onClick={async () => {
                await playFX("tap.mp3", 0.35);
                setScreen("history");
              }}
            >
              Storico vincitori
            </button>

            {(loadingHistory && <p className="subtitle">Carico storico…</p>) ||
              (history.length === 0 && (
                <p className="subtitle">Nessuna partita conclusa ancora. Si comincia!</p>
              ))}
          </>
        )}
      </div>
    );
  }

  if (screen === "history") {
    return (
      <History
        history={history}
        loading={loadingHistory}
        onBack={() => setScreen("home")}
      />
    );
  }

  if (screen === "setup") {
    return (
      <Setup
        onBack={() => setScreen("home")}
        onStart={async (settings) => {
          const data = {
            id: newMatchId(),
            settings,
            currentRestaurant: 0,
            currentPlayer: 0,
            votes: [],
            createdAt: Date.now(),
            finished: false,
          };
          setActiveId(data.id);
          setMatch(data);
          setMusicOn(!!settings.music);

          await saveActive(user.uid, data);
          await playFX("confirm.mp3", 0.45);
          setScreen("vote");
        }}
      />
    );
  }

  if (screen === "vote") {
    if (!match?.settings) {
      return (
        <div className="screen center">
          <p className="subtitle">Non trovo la partita. Torno alla home.</p>
          <button onClick={() => setScreen("home")}>Home</button>
        </div>
      );
    }

    return (
      <Vote
        match={match}
        onHome={async () => {
          await playFX("tap.mp3", 0.35);
          setScreen("home");
        }}
        onUpdate={async (updated) => {
          setMatch(updated);
          await saveActive(user.uid, updated);
        }}
        onFinish={async (updated, ranking) => {
          const finished = { ...updated, finished: true };
          setMatch(finished);
          await saveActive(user.uid, finished);

          // stacca “attiva” e salva nello storico
          await clearActive(user.uid);
          await pushHistory(user.uid, finished, ranking);

          await playFX("winner.mp3", 0.6);
          setScreen("ranking");
        }}
        onPause={async () => {
          await playFX("tap.mp3", 0.35);
          setScreen("home");
        }}
      />
    );
  }

  if (screen === "ranking") {
    return (
      <Ranking
        match={match}
        onHome={async () => {
          await playFX("tap.mp3", 0.35);
          setScreen("home");
        }}
        onNew={async () => {
          await playFX("confirm.mp3", 0.45);
          setScreen("setup");
        }}
      />
    );
  }

  return null;
}

// -------------------- SETUP --------------------
function Setup({ onBack, onStart }) {
  const [players, setPlayers] = useState(4);
  const [restaurantsCount, setRestaurantsCount] = useState(4);
  const [bonusEnabled, setBonusEnabled] = useState(true);
  const [music, setMusic] = useState(false);

  const [names, setNames] = useState([
    "Trattoria Roma",
    "Osteria Bella",
    "La Bottega",
    "Spadella Club",
    "Il Fornello",
    "Cucina d’Autore",
    "A Tavola!",
    "Pane & Drama",
  ]);

  return (
    <div className="screen">
      <h2>Setup partita</h2>

      <div className="card">
        <label>
          Partecipanti: <b>{players}</b>
        </label>
        <input
          type="range"
          min="4"
          max="8"
          value={players}
          onChange={(e) => setPlayers(+e.target.value)}
        />

        <label>
          Ristoranti in gara: <b>{restaurantsCount}</b>
        </label>
        <input
          type="range"
          min="4"
          max="8"
          value={restaurantsCount}
          onChange={(e) => setRestaurantsCount(+e.target.value)}
        />

        <div className="toggles">
          <label className="toggle bonus">
            <input
              type="checkbox"
              checked={bonusEnabled}
              onChange={(e) => setBonusEnabled(e.target.checked)}
            />
            Bonus Special (+5) disponibile
          </label>

          <label className="toggle">
            <input
              type="checkbox"
              checked={music}
              onChange={(e) => setMusic(e.target.checked)}
            />
            Musica della serata (se presente)
          </label>
        </div>
      </div>

      <p className="subtitle">Nomi ristoranti:</p>
      {Array.from({ length: restaurantsCount }).map((_, i) => (
        <input
          key={i}
          type="text"
          value={names[i] || ""}
          onChange={(e) => {
            const copy = [...names];
            copy[i] = e.target.value;
            setNames(copy);
          }}
          placeholder={`Ristorante ${i + 1}`}
        />
      ))}

      <div className="row">
        <button
          onClick={() =>
            onStart({
              players,
              restaurants: names
                .slice(0, restaurantsCount)
                .map((s, i) => (s?.trim() ? s.trim() : `Ristorante ${i + 1}`)),
              bonusEnabled,
              music,
            })
          }
        >
          Si va a tavola 🍷
        </button>
        <button className="ghost" onClick={onBack}>
          Indietro
        </button>
      </div>
    </div>
  );
}

// -------------------- VOTE --------------------
function Vote({ match, onUpdate, onFinish, onHome, onPause }) {
  const { settings, currentRestaurant, currentPlayer, votes } = match;
  const restaurantName = settings.restaurants[currentRestaurant];

  const [scores, setScores] = useState({
    cibo: 6,
    servizio: 6,
    location: 6,
    conto: 6,
  });
  const [useBonus, setUseBonus] = useState(false);
  const [flash, setFlash] = useState(false);

  const baseTotal =
    scores.cibo + scores.servizio + scores.location + scores.conto;
  const finalTotal = baseTotal + (useBonus ? 5 : 0);

  function bump() {
    setFlash(true);
    setTimeout(() => setFlash(false), 220);
  }

  function computeRanking(allVotes) {
    const totals = Array(settings.restaurants.length).fill(0);
    allVotes.forEach((v) => {
      totals[v.restaurantIndex] += v.total ?? 0;
    });
    return settings.restaurants
      .map((name, i) => ({ name, score: totals[i] }))
      .sort((a, b) => b.score - a.score);
  }

  const submit = async () => {
    await playFX("slider.mp3", 0.25);

    const vote = {
      restaurantIndex: currentRestaurant,
      playerIndex: currentPlayer,
      ...scores,
      total: finalTotal,
      bonusApplied: !!useBonus,
    };

    const newVotes = [...votes, vote];

    let nextPlayer = currentPlayer + 1;
    let nextRestaurant = currentRestaurant;

    if (nextPlayer >= settings.players) {
      nextPlayer = 0;
      nextRestaurant += 1;
    }

    const updated = {
      ...match,
      votes: newVotes,
      currentPlayer: nextPlayer,
      currentRestaurant: nextRestaurant,
    };

    if (nextRestaurant >= settings.restaurants.length) {
      const ranking = computeRanking(newVotes);
      await onFinish(updated, ranking);
      return;
    }

    await playFX("confirm.mp3", 0.45);
    await onUpdate(updated);

    setScores({ cibo: 6, servizio: 6, location: 6, conto: 6 });
    setUseBonus(false);
  };

  const Slider = ({ label, k, emoji }) => (
    <div className="slider">
      <div className="sliderHead">
        <span>
          {emoji} {label}
        </span>
        <b>{scores[k]}</b>
      </div>
      <input
        type="range"
        min="0"
        max="10"
        value={scores[k]}
        onChange={(e) => {
          setScores({ ...scores, [k]: +e.target.value });
          bump();
        }}
      />
    </div>
  );

  return (
    <div className="screen">
      <div className="pill">
        Ristorante <b>{currentRestaurant + 1}</b> / {settings.restaurants.length} ·
        Giocatore <b>{currentPlayer + 1}</b> / {settings.players}
      </div>

      <div className="card">
        <h2 className="title">{restaurantName}</h2>
        <p className="subtitle">“Qui si spadella… e si giudica.”</p>

        <Slider label="Cibo" k="cibo" emoji="🍝" />
        <Slider label="Servizio" k="servizio" emoji="🛎️" />
        <Slider label="Location" k="location" emoji="🏠" />
        <Slider label="Conto" k="conto" emoji="💸" />

        {settings.bonusEnabled && (
          <label className="toggle bonus">
            <input
              type="checkbox"
              checked={useBonus}
              onChange={(e) => setUseBonus(e.target.checked)}
            />
            Bonus Special: <b>+5</b> (facoltativo)
          </label>
        )}

        <div className={`totale ${flash ? "flash" : ""}`}>
          Totale: <b>{baseTotal}</b>
          {useBonus ? <span className="bonusTag"> +5</span> : null}
          <span className="finalTotal"> = {finalTotal}</span>
        </div>

        <button onClick={submit}>Conferma voto</button>

        <div className="row">
          <button className="ghost" onClick={onPause}>
            Metti in pausa (salva)
          </button>
          <button className="ghost" onClick={onHome}>
            Home
          </button>
        </div>
      </div>
    </div>
  );
}

// -------------------- RANKING --------------------
function Ranking({ match, onHome, onNew }) {
  const settings = match?.settings;
  const votes = match?.votes || [];

  if (!settings) {
    return (
      <div className="screen center">
        <p className="subtitle">Nessuna classifica disponibile.</p>
        <button onClick={onHome}>Home</button>
      </div>
    );
  }

  const totals = Array(settings.restaurants.length).fill(0);
  votes.forEach((v) => (totals[v.restaurantIndex] += v.total ?? 0));

  const ranking = settings.restaurants
    .map((name, i) => ({ name, score: totals[i] }))
    .sort((a, b) => b.score - a.score);

  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    setVisibleCount(0);
    playFX("drumroll.mp3", 0.45);
  }, []);

  useEffect(() => {
    if (visibleCount < ranking.length) {
      const t = setTimeout(() => setVisibleCount((v) => v + 1), 650);
      return () => clearTimeout(t);
    }
  }, [visibleCount, ranking.length]);

  const done = visibleCount >= ranking.length;

  return (
    <div className="screen ranking">
      <h1>🏆 Il verdetto è servito</h1>
      <p className="subtitle">Screenshot-ready. Nessuna pietà.</p>

      <div className="rankingBox">
        {ranking.slice(0, visibleCount).map((r, i) => (
          <div
            key={i}
            className={`ranking-item ${done && i === 0 ? "winner" : ""}`}
            style={{ animationDelay: `${i * 120}ms` }}
          >
            <span>
              {i + 1}. {r.name}
            </span>
            <span>{r.score}</span>
          </div>
        ))}
      </div>

      {done && (
        <>
          <p className="final-badge">🍳 4 Spadellate — la sentenza è definitiva</p>
          <div className="row">
            <button onClick={onNew}>Nuova partita</button>
            <button className="ghost" onClick={onHome}>
              Home
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// -------------------- HISTORY --------------------
function History({ history, loading, onBack }) {
  return (
    <div className="screen">
      <h2>Storico vincitori</h2>
      <p className="subtitle">Le ultime 20 partite concluse.</p>

      <div className="card">
        {loading ? (
          <p className="subtitle">Carico storico…</p>
        ) : history.length === 0 ? (
          <p className="subtitle">Ancora nulla. È il momento di fare storia.</p>
        ) : (
          history.map((h) => (
            <div key={h.id} className="ranking-item">
              <span>
                🏆 <b>{h.winner}</b> · {h.players} giocatori · {h.restaurants?.length || 0} ristoranti
              </span>
              <span>⭐</span>
            </div>
          ))
        )}
      </div>

      <button className="ghost" onClick={onBack}>
        Indietro
      </button>
    </div>
  );
}
