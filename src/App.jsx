import { useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  browserLocalPersistence,
  setPersistence,
} from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "./firebase";
import "./App.css";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

async function audioExists(url) {
  try {
    const res = await fetch(url, { method: "HEAD", cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}

function useSfx() {
  const cacheRef = useRef(new Map());
  const play = async (file, volume = 0.7) => {
    const url = `/audio/${file}`;
    if (!cacheRef.current.has(url)) {
      const ok = await audioExists(url);
      cacheRef.current.set(url, ok);
    }
    if (!cacheRef.current.get(url)) return;
    try {
      const a = new Audio(url);
      a.volume = volume;
      await a.play();
    } catch {}
  };
  return { play };
}

function prettyErr(e) {
  if (!e) return "";
  const code = e.code ? String(e.code) : "";
  const msg = e.message ? String(e.message) : String(e);
  return [code, msg].filter(Boolean).join(" — ");
}

export default function App() {
  const { play: playSfx } = useSfx();

  // auth
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  // diagnostica
  const [authDiag, setAuthDiag] = useState({
    origin: "",
    redirectResult: "",
    popupResult: "",
    clickError: "",
    note: "",
  });

  const provider = useMemo(() => {
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    return p;
  }, []);

  // navigation
  const [screen, setScreen] = useState("home"); // home | setup | vote | ranking
  const [loadingCloud, setLoadingCloud] = useState(false);

  // toast
  const [saveToast, setSaveToast] = useState("");

  // setup
  const [restaurantsCount, setRestaurantsCount] = useState(4);
  const [playersCount, setPlayersCount] = useState(4);
  const [bonusEnabled, setBonusEnabled] = useState(true);
  const [musicEnabled, setMusicEnabled] = useState(false);

  const [restaurantNames, setRestaurantNames] = useState([
    "La Bottega",
    "Trattoria Roma",
    "Osteria Bella",
    "Spadella d'Oro",
    "La Brace",
    "Il Tegame",
    "Forchetta & Co",
    "Sugo Supremo",
  ]);

  const [playerNames, setPlayerNames] = useState([
    "Giocatore 1",
    "Giocatore 2",
    "Giocatore 3",
    "Giocatore 4",
    "Giocatore 5",
    "Giocatore 6",
    "Giocatore 7",
    "Giocatore 8",
  ]);

  // match
  const [voteIndex, setVoteIndex] = useState(0);
  const [votes, setVotes] = useState([]);

  // vote sliders
  const [cibo, setCibo] = useState(7);
  const [servizio, setServizio] = useState(7);
  const [location, setLocation] = useState(7);
  const [conto, setConto] = useState(7);
  const [bonusUsed, setBonusUsed] = useState(false);

  // cloud: resume + history
  const [hasCloudSave, setHasCloudSave] = useState(false);
  const [cloudHistory, setCloudHistory] = useState([]);

  // ranking reveal state
  const [revealStarted, setRevealStarted] = useState(false);
  const [revealCount, setRevealCount] = useState(0);

  // derived
  const restaurants = useMemo(
    () => restaurantNames.slice(0, restaurantsCount),
    [restaurantNames, restaurantsCount]
  );
  const players = useMemo(
    () => playerNames.slice(0, playersCount),
    [playerNames, playersCount]
  );

  const totalVotesNeeded = playersCount * restaurantsCount;
  const currentPlayer = Math.floor(voteIndex / restaurantsCount);
  const currentRestaurant = voteIndex % restaurantsCount;

  const perVoteBase = cibo + servizio + location + conto;
  const perVoteTotal = perVoteBase + (bonusEnabled && bonusUsed ? 5 : 0);

  const uid = user?.uid || null;

  const activeMatchRef = useMemo(() => {
    if (!uid) return null;
    return doc(db, "users", uid, "state", "activeMatch");
  }, [uid]);

  const historyColRef = useMemo(() => {
    if (!uid) return null;
    return collection(db, "users", uid, "history");
  }, [uid]);

  // init diag
  useEffect(() => {
    setAuthDiag((d) => ({
      ...d,
      origin: window.location.origin,
      note:
        "Se il login rimbalza: di solito è auth/unauthorized-domain oppure popup bloccato. Qui vedrai il motivo.",
    }));
  }, []);

  // ensure persistence (anche se già in firebase.js)
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  }, []);

  // handle redirect result
  useEffect(() => {
    (async () => {
      try {
        setAuthBusy(true);
        const res = await getRedirectResult(auth);
        if (res?.user) {
          setAuthDiag((d) => ({ ...d, redirectResult: "✅ Redirect OK (utente ricevuto)" }));
        } else {
          setAuthDiag((d) => ({ ...d, redirectResult: "ℹ️ Nessun redirect result" }));
        }
      } catch (e) {
        setAuthDiag((d) => ({ ...d, redirectResult: "❌ " + prettyErr(e) }));
      } finally {
        setAuthBusy(false);
      }
    })();
  }, []);

  // auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // load cloud on login
  useEffect(() => {
    if (!uid || !activeMatchRef || !historyColRef) return;
    (async () => {
      try {
        setLoadingCloud(true);
        const snap = await getDoc(activeMatchRef);
        setHasCloudSave(snap.exists());

        const qy = query(historyColRef, orderBy("endedAt", "desc"), limit(10));
        const hs = await getDocs(qy);
        setCloudHistory(hs.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingCloud(false);
      }
    })();
  }, [uid, activeMatchRef, historyColRef]);

  const resetVoteSliders = () => {
    setCibo(7);
    setServizio(7);
    setLocation(7);
    setConto(7);
    setBonusUsed(false);
  };

  const updateRestaurantName = (i, value) => {
    setRestaurantNames((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  };

  const updatePlayerName = (i, value) => {
    setPlayerNames((prev) => {
      const next = [...prev];
      next[i] = value;
      return next;
    });
  };

  // storage
  const saveActiveMatch = async (override = {}) => {
    if (!activeMatchRef) return;
    const payload = {
      restaurantsCount,
      playersCount,
      bonusEnabled,
      musicEnabled,
      restaurantNames,
      playerNames,
      voteIndex,
      votes,
      sliders: { cibo, servizio, location, conto, bonusUsed },
      screen,
      updatedAt: serverTimestamp(),
      ...override,
    };
    await setDoc(activeMatchRef, payload, { merge: true });
    setHasCloudSave(true);
    setSaveToast("✅ Partita salvata");
    setTimeout(() => setSaveToast(""), 1200);
  };

  useEffect(() => {
    if (!user || !activeMatchRef) return;
    if (screen !== "setup") return;
    const t = setTimeout(() => {
      saveActiveMatch({ screen: "setup" }).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, restaurantsCount, playersCount, bonusEnabled, musicEnabled, restaurantNames, playerNames]);

  const resumeMatch = async () => {
    if (!activeMatchRef) return;
    try {
      setLoadingCloud(true);
      const snap = await getDoc(activeMatchRef);
      if (!snap.exists()) {
        alert("Nessuna partita salvata trovata.");
        setHasCloudSave(false);
        return;
      }
      const data = snap.data();
      setRestaurantsCount(clamp(Number(data.restaurantsCount ?? 4), 4, 8));
      setPlayersCount(clamp(Number(data.playersCount ?? 4), 4, 8));
      setBonusEnabled(!!data.bonusEnabled);
      setMusicEnabled(!!data.musicEnabled);
      setRestaurantNames(data.restaurantNames ?? restaurantNames);
      setPlayerNames(data.playerNames ?? playerNames);
      setVoteIndex(Number(data.voteIndex ?? 0));
      setVotes(data.votes ?? []);
      const s = data.sliders || {};
      setCibo(Number(s.cibo ?? 7));
      setServizio(Number(s.servizio ?? 7));
      setLocation(Number(s.location ?? 7));
      setConto(Number(s.conto ?? 7));
      setBonusUsed(!!s.bonusUsed);
      setScreen("vote");
    } finally {
      setLoadingCloud(false);
    }
  };

  const saveHistory = async (finalRanking, votesCount) => {
    if (!uid) return;
    const winner = finalRanking?.[0]?.name || "—";
    const docId = String(Date.now());
    await setDoc(doc(db, "users", uid, "history", docId), {
      endedAt: serverTimestamp(),
      winner,
      ranking: finalRanking,
      votesCount,
    });
  };

  // LOGIN: popup first, redirect fallback
  const login = async () => {
    try {
      setAuthBusy(true);
      setAuthDiag((d) => ({ ...d, clickError: "", popupResult: "" }));

      try {
        const res = await signInWithPopup(auth, provider);
        if (res?.user) {
          setAuthDiag((d) => ({ ...d, popupResult: "✅ Popup OK (utente ricevuto)" }));
        } else {
          setAuthDiag((d) => ({ ...d, popupResult: "ℹ️ Popup senza utente (raro)" }));
        }
      } catch (e) {
        // se popup bloccato o policy, usiamo redirect
        setAuthDiag((d) => ({ ...d, popupResult: "❌ " + prettyErr(e) + " → fallback redirect" }));
        await signInWithRedirect(auth, provider);
        return; // redirect cambia pagina
      }
    } catch (e) {
      setAuthDiag((d) => ({ ...d, clickError: "❌ " + prettyErr(e) }));
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setScreen("home");
  };

  const startMatch = () => {
    const rOk = restaurants.every((n) => n && n.trim().length > 0);
    const pOk = players.every((n) => n && n.trim().length > 0);
    if (!rOk) return alert("Inserisci il nome di tutti i ristoranti.");
    if (!pOk) return alert("Inserisci il nome di tutti i partecipanti.");
    setVotes([]);
    setVoteIndex(0);
    resetVoteSliders();
    setScreen("vote");
    saveActiveMatch({ screen: "vote", voteIndex: 0, votes: [] }).catch(() => {});
  };

  const submitVote = () => {
    const payload = {
      player: currentPlayer,
      restaurant: currentRestaurant,
      cibo,
      servizio,
      location,
      conto,
      bonusUsed: bonusEnabled ? bonusUsed : false,
      total: perVoteTotal,
    };
    const nextVotes = [...votes, payload];
    setVotes(nextVotes);
    const nextIndex = voteIndex + 1;
    if (nextIndex >= totalVotesNeeded) {
      setRevealStarted(false);
      setRevealCount(0);
      setScreen("ranking");
      saveActiveMatch({ screen: "ranking", votes: nextVotes, voteIndex: nextIndex }).catch(() => {});
      return;
    }
    setVoteIndex(nextIndex);
    resetVoteSliders();
    saveActiveMatch({ votes: nextVotes, voteIndex: nextIndex, screen: "vote" }).catch(() => {});
  };

  const restart = () => {
    setScreen("home");
    setVotes([]);
    setVoteIndex(0);
    resetVoteSliders();
    setRevealStarted(false);
    setRevealCount(0);
    saveActiveMatch({ screen: "home" }).catch(() => {});
  };

  const ranking = useMemo(() => {
    const sums = Array(restaurantsCount).fill(0);
    for (const v of votes) sums[v.restaurant] += v.total;
    return restaurants
      .map((name, idx) => ({ name, score: sums[idx] }))
      .sort((a, b) => b.score - a.score);
  }, [votes, restaurants, restaurantsCount]);

  useEffect(() => {
    if (screen !== "ranking") return;
    if (!uid) return;
    if (votes.length === 0) return;
    saveHistory(ranking, votes.length).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  useEffect(() => {
    if (screen !== "ranking") return;
    if (!revealStarted) return;
    let cancelled = false;
    (async () => {
      await playSfx("drumroll.mp3", 0.55);
      for (let i = 1; i <= ranking.length; i++) {
        if (cancelled) return;
        setRevealCount(i);
        if (i === 1) setTimeout(() => playSfx("winner.mp3", 0.7), 250);
        await new Promise((r) => setTimeout(r, i === 1 ? 900 : 650));
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealStarted, screen]);

  if (!authReady) {
    return (
      <div className="screen center">
        <h1>🍳 4 Spadellate</h1>
        <p className="muted">Caricamento…</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="screen center">
        {saveToast && <div className="toast">{saveToast}</div>}
        <h1>🍳 4 Spadellate</h1>
        <p className="muted">Il party game da tavolata (stile TV).</p>

        <button type="button" onClick={login} disabled={authBusy}>
          {authBusy ? "Accesso in corso…" : "Accedi con Google"}
        </button>

        <div className="card" style={{ marginTop: 14, maxWidth: 720 }}>
          <h3 style={{ marginTop: 0 }}>🧪 Diagnostica login</h3>
          <p className="tiny muted" style={{ marginTop: 0 }}>
            Se rimbalza: copia queste righe.
          </p>
          <div className="tiny" style={{ textAlign: "left" }}>
            <div><strong>Origin:</strong> {authDiag.origin}</div>
            <div><strong>Popup result:</strong> {authDiag.popupResult}</div>
            <div><strong>Redirect result:</strong> {authDiag.redirectResult}</div>
            <div><strong>Click error:</strong> {authDiag.clickError}</div>
            <div className="muted" style={{ marginTop: 8 }}>{authDiag.note}</div>
          </div>
        </div>
      </div>
    );
  }

  // HOME
  if (screen === "home") {
    return (
      <div className="screen center">
        {saveToast && <div className="toast">{saveToast}</div>}
        <h1>🍳 4 Spadellate</h1>
        <p className="muted">Ciao {user.displayName}</p>

        <div className="stack">
          <button type="button" onClick={() => setScreen("setup")}>Inizia partita</button>
          {hasCloudSave && (
            <button type="button" className="secondary" onClick={resumeMatch} disabled={loadingCloud}>
              {loadingCloud ? "Carico..." : "Riprendi partita"}
            </button>
          )}
          <button type="button" className="secondary" onClick={logout}>Esci</button>
        </div>

        {cloudHistory.length > 0 && (
          <div className="card ranking" style={{ marginTop: 14 }}>
            <h3>📚 Storico vincitori</h3>
            {cloudHistory.map((h, i) => (
              <div key={h.id} className={`rankRow ${i === 0 ? "winner" : ""}`}>
                <span className="pos">{i + 1}</span>
                <span className="name">{h.winner || "—"}</span>
                <span className="score">{h.votesCount || 0} voti</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // SETUP
  if (screen === "setup") {
    return (
      <div className="screen">
        <h2>Setup partita</h2>

        <div className="card">
          <label className="row">
            <span>Ristoranti</span>
            <select value={restaurantsCount} onChange={(e) => setRestaurantsCount(clamp(Number(e.target.value), 4, 8))}>
              {[4,5,6,7,8].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>

          <label className="row">
            <span>Partecipanti</span>
            <select value={playersCount} onChange={(e) => setPlayersCount(clamp(Number(e.target.value), 4, 8))}>
              {[4,5,6,7,8].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>

          <label className="row">
            <span>Bonus speciale (+5)</span>
            <input type="checkbox" checked={bonusEnabled} onChange={(e) => setBonusEnabled(e.target.checked)} />
          </label>

          <label className="row">
            <span>Musica</span>
            <input type="checkbox" checked={musicEnabled} onChange={(e) => setMusicEnabled(e.target.checked)} />
          </label>
        </div>

        <div className="grid2">
          <div className="card">
            <h3>🍽️ Nomi ristoranti</h3>
            {Array.from({ length: restaurantsCount }).map((_, i) => (
              <input key={i} value={restaurantNames[i] || ""} onChange={(e) => updateRestaurantName(i, e.target.value)} placeholder={`Ristorante ${i+1}`} />
            ))}
          </div>
          <div className="card">
            <h3>👥 Nomi partecipanti</h3>
            {Array.from({ length: playersCount }).map((_, i) => (
              <input key={i} value={playerNames[i] || ""} onChange={(e) => updatePlayerName(i, e.target.value)} placeholder={`Partecipante ${i+1}`} />
            ))}
          </div>
        </div>

        <div className="stack">
          <button type="button" onClick={startMatch}>Avvia la cena 🍷</button>
          <button type="button" className="secondary" onClick={() => setScreen("home")}>Indietro</button>
        </div>
      </div>
    );
  }

  // VOTE
  if (screen === "vote") {
    return (
      <div className="screen">
        <h2>Votazione</h2>
        <p className="tiny muted">Voto {voteIndex + 1} / {totalVotesNeeded}</p>

        <div className="card">
          <h3>👤 {players[currentPlayer]} vota → 🍽️ {restaurants[currentRestaurant]}</h3>
        </div>

        <div className="card">
          <Slider label="🍝 Cibo" value={cibo} onChange={setCibo} />
          <Slider label="🛎 Servizio" value={servizio} onChange={setServizio} />
          <Slider label="🏠 Location" value={location} onChange={setLocation} />
          <Slider label="💸 Conto" value={conto} onChange={setConto} />

          {bonusEnabled && (
            <label className="row bonusRow">
              <span>✨ Bonus speciale (+5)</span>
              <input type="checkbox" checked={bonusUsed} onChange={(e) => setBonusUsed(e.target.checked)} />
            </label>
          )}

          <div className="totals">
            <span>Totale voto</span>
            <strong>{perVoteTotal}</strong>
          </div>

          <button type="button" onClick={submitVote}>Conferma voto</button>
          <button type="button" className="secondary" onClick={resetVoteSliders}>Reset voto</button>
          <button type="button" className="secondary" onClick={() => setScreen("home")}>Home</button>
        </div>
      </div>
    );
  }

  // RANKING
  if (screen === "ranking") {
    const visibleRows = ranking.slice(0, revealCount);
    const winner = ranking?.[0]?.name || "—";
    return (
      <div className="screen center rankingStage">
        <h1 className="stageTitle">🏆 Classifica finale</h1>

        {!revealStarted ? (
          <div className="card stageCard">
            <button type="button" onClick={() => { setRevealStarted(true); setRevealCount(0); }}>
              Mostra classifica 🎬
            </button>
          </div>
        ) : (
          <>
            <div className="card ranking rankingReveal">
              {visibleRows.map((r, i) => (
                <div key={r.name} className={`rankRow revealRow ${i === 0 ? "winner" : ""}`}>
                  <span className="pos">{i + 1}</span>
                  <span className="name">{r.name}</span>
                  <span className="score">{r.score}</span>
                </div>
              ))}
              {revealCount >= ranking.length && (
                <div className="winnerBanner">
                  <div className="winnerText">Vincitore: <strong>{winner}</strong></div>
                </div>
              )}
            </div>
            <button type="button" onClick={restart}>Nuova partita</button>
          </>
        )}
      </div>
    );
  }

  return null;
}

function Slider({ label, value, onChange }) {
  return (
    <div className="slider">
      <div className="sliderHead">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <input type="range" min="0" max="10" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}
