import { useEffect, useMemo, useRef, useState } from "react";
import {
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  onAuthStateChanged,
  signOut,
  setPersistence,
  browserLocalPersistence,
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

const BUILD_ID = "vercel-auth-fix-006";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

function describeEl(el) {
  if (!el) return "—";
  const tag = (el.tagName || "").toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls =
    el.className && typeof el.className === "string"
      ? "." + el.className.trim().split(/\s+/).slice(0, 4).join(".")
      : "";
  const txt =
    typeof el.textContent === "string"
      ? el.textContent.trim().replace(/\s+/g, " ").slice(0, 60)
      : "";
  return `${tag}${id}${cls}${txt ? ` — "${txt}"` : ""}`;
}

export default function App() {
  const { play: playSfx } = useSfx();

  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const loginMode = "redirect";

  const provider = useMemo(() => {
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    return p;
  }, []);

  const [authDiag, setAuthDiag] = useState({
    build: BUILD_ID,
    mode: loginMode,
    origin: "",
    ua: "",
    // react capture
    reactPointerCaptureAt: "",
    reactPointerTarget: "—",
    reactClickCaptureAt: "",
    reactClickTarget: "—",
    // native capture (document)
    nativePointerAt: "",
    nativePointerTarget: "—",
    nativeClickAt: "",
    nativeClickTarget: "—",
    elementFromPoint: "—",
    xy: "—",
    // button + login
    buttonPointerDownAt: "",
    loginStartAt: "",
    redirectResult: "",
    clickError: "",
  });

  useEffect(() => {
    setAuthDiag((d) => ({
      ...d,
      origin: window.location.origin,
      ua: navigator.userAgent,
      build: BUILD_ID,
      mode: loginMode,
    }));
  }, []);

  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  }, []);

  useEffect(() => {
    const onPointerDown = (e) => {
      const x = typeof e.clientX === "number" ? e.clientX : -1;
      const y = typeof e.clientY === "number" ? e.clientY : -1;
      const efp = x >= 0 && y >= 0 ? document.elementFromPoint(x, y) : null;

      setAuthDiag((d) => ({
        ...d,
        nativePointerAt: new Date().toISOString(),
        nativePointerTarget: describeEl(e.target),
        elementFromPoint: describeEl(efp),
        xy: x >= 0 && y >= 0 ? `${x},${y}` : "—",
      }));
    };

    const onClick = (e) => {
      setAuthDiag((d) => ({
        ...d,
        nativeClickAt: new Date().toISOString(),
        nativeClickTarget: describeEl(e.target),
      }));
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await getRedirectResult(auth);
        if (res?.user) {
          setAuthDiag((d) => ({ ...d, redirectResult: "✅ Redirect OK (utente ricevuto)" }));
        } else {
          setAuthDiag((d) => ({ ...d, redirectResult: "ℹ️ Nessun redirect result" }));
        }
      } catch (e) {
        setAuthDiag((d) => ({ ...d, redirectResult: "❌ " + prettyErr(e) }));
      }
    })();
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthReady(true);
      setAuthBusy(false);
    });
    return () => unsub();
  }, []);

  const [screen, setScreen] = useState("home");
  const [loadingCloud, setLoadingCloud] = useState(false);
  const [saveToast, setSaveToast] = useState("");

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

  const [voteIndex, setVoteIndex] = useState(0);
  const [votes, setVotes] = useState([]);

  const [cibo, setCibo] = useState(7);
  const [servizio, setServizio] = useState(7);
  const [location, setLocation] = useState(7);
  const [conto, setConto] = useState(7);
  const [bonusUsed, setBonusUsed] = useState(false);

  const [hasCloudSave, setHasCloudSave] = useState(false);
  const [cloudHistory, setCloudHistory] = useState([]);

  const [revealStarted, setRevealStarted] = useState(false);
  const [revealCount, setRevealCount] = useState(0);

  const restaurants = useMemo(() => restaurantNames.slice(0, restaurantsCount), [restaurantNames, restaurantsCount]);
  const players = useMemo(() => playerNames.slice(0, playersCount), [playerNames, playersCount]);

  const totalVotesNeeded = playersCount * restaurantsCount;
  const currentPlayer = Math.floor(voteIndex / restaurantsCount);
  const currentRestaurant = voteIndex % restaurantsCount;

  const perVoteBase = cibo + servizio + location + conto;
  const perVoteTotal = perVoteBase + (bonusEnabled && bonusUsed ? 5 : 0);

  const uid = user?.uid || null;
  const activeMatchRef = useMemo(() => (uid ? doc(db, "users", uid, "state", "activeMatch") : null), [uid]);
  const historyColRef = useMemo(() => (uid ? collection(db, "users", uid, "history") : null), [uid]);

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

  const login = async () => {
    const now = new Date().toISOString();
    setAuthDiag((d) => ({
      ...d,
      loginStartAt: now,
      clickError: "",
      redirectResult: "⏳ Redirect in corso…",
    }));

    try {
      setAuthBusy(true);
      await signInWithRedirect(auth, provider);
    } catch (e) {
      setAuthDiag((d) => ({ ...d, clickError: "❌ " + prettyErr(e) }));
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

  const resumeMatch = async () => {
    if (!activeMatchRef) return;
    try {
      setLoadingCloud(true);
      const snap = await getDoc(activeMatchRef);
      if (!snap.exists()) return alert("Nessuna partita salvata trovata.");
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

  const ranking = useMemo(() => {
    const sums = Array(restaurantsCount).fill(0);
    for (const v of votes) sums[v.restaurant] += v.total;
    return restaurants.map((name, idx) => ({ name, score: sums[idx] })).sort((a, b) => b.score - a.score);
  }, [votes, restaurants, restaurantsCount]);

  useEffect(() => {
    if (screen !== "ranking") return;
    if (!uid) return;
    if (votes.length === 0) return;
    const winner = ranking?.[0]?.name || "—";
    const docId = String(Date.now());
    setDoc(doc(db, "users", uid, "history", docId), {
      endedAt: serverTimestamp(),
      winner,
      ranking,
      votesCount: votes.length,
    }).catch(() => {});
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
        await wait(i === 1 ? 900 : 650);
      }
    })();
    return () => {
      cancelled = true;
    };
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
      <div
        className="screen center"
        onPointerDownCapture={(e) => {
          setAuthDiag((d) => ({
            ...d,
            reactPointerCaptureAt: new Date().toISOString(),
            reactPointerTarget: describeEl(e.target),
          }));
        }}
        onClickCapture={(e) => {
          setAuthDiag((d) => ({
            ...d,
            reactClickCaptureAt: new Date().toISOString(),
            reactClickTarget: describeEl(e.target),
          }));
        }}
      >
        {saveToast && <div className="toast">{saveToast}</div>}
        <h1>🍳 4 Spadellate</h1>
        <p className="muted">Clicca il bottone sotto (redirect). Poi torni qui loggato.</p>

        <div className="loginZone">
          <button
            type="button"
            className="primaryBig"
            disabled={authBusy}
            onPointerDown={() => setAuthDiag((d) => ({ ...d, buttonPointerDownAt: new Date().toISOString() }))}
            onClick={login}
          >
            {authBusy ? "Vai su Google…" : "Accedi con Google"}
          </button>
        </div>

        <details className="diagBox">
          <summary>🧪 Diagnostica login (apri solo se rimbalza)</summary>
          <div className="diagText">
            <div><strong>BUILD:</strong> {BUILD_ID}</div>
            <div><strong>Mode:</strong> {loginMode}</div>
            <div><strong>Origin:</strong> {authDiag.origin}</div>
            <div><strong>UserAgent:</strong> {authDiag.ua}</div>

            <hr />

            <div><strong>NATIVE target:</strong> {authDiag.nativePointerTarget || "—"}</div>
            <div><strong>elementFromPoint:</strong> {authDiag.elementFromPoint || "—"} <span className="muted">({authDiag.xy})</span></div>

            <hr />

            <div><strong>button pointerdown:</strong> {authDiag.buttonPointerDownAt || "—"}</div>
            <div><strong>login-start:</strong> {authDiag.loginStartAt || "—"}</div>
            <div><strong>Redirect result:</strong> {authDiag.redirectResult || "—"}</div>
            <div><strong>Click error:</strong> {authDiag.clickError || "—"}</div>
          </div>
        </details>
      </div>
    );
  }

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

  if (screen === "setup") {
    return (
      <div className="screen">
        <h2>Setup partita</h2>

        <div className="card">
          <label className="row">
            <span>Ristoranti</span>
            <select value={restaurantsCount} onChange={(e) => setRestaurantsCount(clamp(Number(e.target.value), 4, 8))}>
              {[4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>

          <label className="row">
            <span>Partecipanti</span>
            <select value={playersCount} onChange={(e) => setPlayersCount(clamp(Number(e.target.value), 4, 8))}>
              {[4, 5, 6, 7, 8].map((n) => <option key={n} value={n}>{n}</option>)}
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
              <input key={i} value={restaurantNames[i] || ""} onChange={(e) => updateRestaurantName(i, e.target.value)} placeholder={`Ristorante ${i + 1}`} />
            ))}
          </div>

          <div className="card">
            <h3>👥 Nomi partecipanti</h3>
            {Array.from({ length: playersCount }).map((_, i) => (
              <input key={i} value={playerNames[i] || ""} onChange={(e) => updatePlayerName(i, e.target.value)} placeholder={`Partecipante ${i + 1}`} />
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

  if (screen === "vote") {
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
            <button type="button" onClick={() => { setScreen("home"); setVotes([]); setVoteIndex(0); }}>
              Nuova partita
            </button>
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
