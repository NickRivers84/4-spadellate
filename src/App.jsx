import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import { auth, db } from "./firebase";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "firebase/auth";

import {
  doc,
  getDoc,
  onSnapshot,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

/* =========================
   CONFIG
========================= */
const APP_NAME = "Forchette&Polpette";
const MATCH_COLLECTION = "matches";
const LAST_CODE_KEY = "4sp_last_code";
const BUILD = "avvia-fix-nested-arrays-001";

/* =========================
   UTILS
========================= */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

function genCode(len = 6) {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}
function normalizeCode(v) {
  return (v || "").toUpperCase().trim().replace(/\s+/g, "");
}
function defaultRestaurantNames() {
  return [
    "La Bottega",
    "Trattoria Roma",
    "Osteria Bella",
    "Spadella d'Oro",
    "La Brace",
    "Il Tegame",
    "Forchetta & Co",
    "Sugo Supremo",
  ];
}
function defaultPlayerNames() {
  return [
    "Giocatore 1",
    "Giocatore 2",
    "Giocatore 3",
    "Giocatore 4",
    "Giocatore 5",
    "Giocatore 6",
    "Giocatore 7",
    "Giocatore 8",
  ];
}

/* ✅ ranking come ARRAY DI OGGETTI (NO array-in-array) */
function computeRanking(settings, votesObj) {
  const totals = Array(settings.restaurantsCount).fill(0);
  const votes = votesObj || {};
  Object.values(votes).forEach((v) => {
    if (typeof v?.restaurantIndex === "number" && typeof v?.total === "number") {
      totals[v.restaurantIndex] += v.total;
    }
  });

  return settings.restaurantNames
    .slice(0, settings.restaurantsCount)
    .map((name, i) => ({ name, score: totals[i] || 0 }))
    .sort((a, b) => b.score - a.score);
}

/* =========================
   AUDIO (safe)
========================= */
async function headOk(url) {
  try {
    const r = await fetch(url, { method: "HEAD", cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}
function useFX() {
  const cacheRef = useRef(new Map());
  const play = async (file, volume = 0.7) => {
    const url = `/audio/${file}`;
    if (!cacheRef.current.has(url)) cacheRef.current.set(url, await headOk(url));
    if (!cacheRef.current.get(url)) return;

    try {
      const a = new Audio(url);
      a.volume = volume;
      await a.play();
    } catch {}
  };
  return { play };
}
function MusicPlayer({ enabled }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current) {
      ref.current = new Audio("/audio/background.mp3");
      ref.current.loop = true;
      ref.current.volume = 0.35;
    }
    if (enabled) ref.current.play().catch(() => {});
    else ref.current.pause();
  }, [enabled]);
  return null;
}

/* =========================
   SMALL UI
========================= */
function Pill({ children }) {
  return <span className="pill">{children}</span>;
}
function TextInput({ value, onChange, placeholder }) {
  return (
    <input
      className="input"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  );
}
function Slider({ value, onChange, min = 0, max = 10, step = 1 }) {
  return (
    <input
      className="slider"
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    />
  );
}

/* =========================
   APP
========================= */
export default function App() {
  const { play } = useFX();

  // auth
  const [user, setUser] = useState(null);
  const [authBusy, setAuthBusy] = useState(true);
  const [authError, setAuthError] = useState("");

  // ui
  const [screen, setScreen] = useState("home"); // home | join | setup | vote | reveal
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  // match
  const [code, setCode] = useState(() => localStorage.getItem(LAST_CODE_KEY) || "");
  const [match, setMatch] = useState(null);
  const [matchLoading, setMatchLoading] = useState(false);
  const [matchError, setMatchError] = useState("");

  // setup draft
  const [draft, setDraft] = useState(() => ({
    restaurantsCount: 4,
    playersCount: 4,
    bonusEnabled: true,
    musicEnabled: false,
    restaurantNames: defaultRestaurantNames(),
    playerNames: defaultPlayerNames(),
  }));

  const [musicOn, setMusicOn] = useState(false);

  // vote
  const [voteScores, setVoteScores] = useState({
    cibo: 5,
    servizio: 5,
    location: 5,
    conto: 5,
  });
  const [useBonus, setUseBonus] = useState(false);

  const [startBusy, setStartBusy] = useState(false);

  const matchRef = useMemo(() => {
    const c = normalizeCode(code);
    if (!c) return null;
    return doc(db, MATCH_COLLECTION, c);
  }, [code]);

  const canStart = !!matchRef && !!normalizeCode(code);

  const showToast = (msg) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  /* -------------------------
     AUTH bootstrap
  ------------------------- */
  useEffect(() => {
    let unsub = () => {};
    (async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch {}

      try {
        await getRedirectResult(auth).catch(() => {});
      } catch {}

      unsub = onAuthStateChanged(auth, (u) => {
        setUser(u || null);
        setAuthBusy(false);
      });
    })();

    return () => unsub();
  }, []);

  const login = async () => {
    setAuthError("");
    setAuthBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      try {
        await signInWithPopup(auth, provider);
        await play("tap.mp3", 0.6);
      } catch {
        await signInWithRedirect(auth, provider);
        return;
      }
    } catch {
      setAuthError("Login non riuscito. Riprova (o usa incognito).");
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setScreen("home");
      showToast("Uscito 👋");
    } catch {}
  };

  /* -------------------------
     MATCH subscription
  ------------------------- */
  useEffect(() => {
    setMatchError("");
    setMatch(null);

    const c = normalizeCode(code);
    if (!user || !matchRef || !c) return;

    setMatchLoading(true);

    const unsub = onSnapshot(
      matchRef,
      (snap) => {
        setMatchLoading(false);
        if (!snap.exists()) {
          setMatch(null);
          setMatchError("Partita non trovata. Controlla il codice.");
          return;
        }
        const data = snap.data();
        setMatch({ id: snap.id, ...data });

        const m = !!data?.settings?.musicEnabled;
        setMusicOn(m);

        if (data?.state?.phase === "setup" && data?.settings) {
          setDraft((d) => ({
            ...d,
            ...data.settings,
            restaurantNames: Array.isArray(data.settings.restaurantNames)
              ? data.settings.restaurantNames
              : d.restaurantNames,
            playerNames: Array.isArray(data.settings.playerNames)
              ? data.settings.playerNames
              : d.playerNames,
          }));
        }
      },
      (err) => {
        setMatchLoading(false);
        setMatchError("Errore rete/permessi. Riprova.");
        console.log("Firestore onSnapshot error:", err);
      }
    );

    return () => unsub();
  }, [user, matchRef, code]);

  /* -------------------------
     Setup validation + save
  ------------------------- */
  function buildCleanedDraft() {
    const cleaned = {
      restaurantsCount: clamp(Number(draft.restaurantsCount) || 4, 4, 8),
      playersCount: clamp(Number(draft.playersCount) || 4, 4, 8),
      bonusEnabled: !!draft.bonusEnabled,
      musicEnabled: !!draft.musicEnabled,
      restaurantNames: (draft.restaurantNames || defaultRestaurantNames())
        .slice(0, 8)
        .map((s, i) => ((s || "").trim() || `Ristorante ${i + 1}`)),
      playerNames: (draft.playerNames || defaultPlayerNames())
        .slice(0, 8)
        .map((s, i) => ((s || "").trim() || `Giocatore ${i + 1}`)),
    };

    const rNeeded = cleaned.restaurantNames.slice(0, cleaned.restaurantsCount);
    const pNeeded = cleaned.playerNames.slice(0, cleaned.playersCount);

    if (rNeeded.some((x) => !x.trim())) return { ok: false, reason: "Inserisci tutti i nomi dei ristoranti." };
    if (pNeeded.some((x) => !x.trim())) return { ok: false, reason: "Inserisci tutti i nomi dei giocatori." };

    return { ok: true, settings: cleaned };
  }

  const saveSetup = async () => {
    if (!matchRef) return { ok: false, reason: "Non c'è una partita attiva. Crea/entra con un codice." };

    const res = buildCleanedDraft();
    if (!res.ok) return res;

    try {
      await setDoc(
        matchRef,
        { updatedAt: serverTimestamp(), settings: res.settings },
        { merge: true }
      );
      setMusicOn(res.settings.musicEnabled);
      await play("confirm.mp3", 0.7);
      return { ok: true };
    } catch (e) {
      console.log("saveSetup error:", e);
      return { ok: false, reason: `Errore salvando setup (${e?.code || "unknown"}).` };
    }
  };

  /* -------------------------
     create / join / leave
  ------------------------- */
  const createMatch = async () => {
    const newCode = genCode(6);
    setCode(newCode);
    localStorage.setItem(LAST_CODE_KEY, newCode);

    const initial = {
      code: newCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ownerUid: user?.uid || null,
      settings: {
        restaurantsCount: 4,
        playersCount: 4,
        bonusEnabled: true,
        musicEnabled: false,
        restaurantNames: defaultRestaurantNames(),
        playerNames: defaultPlayerNames(),
      },
      state: {
        phase: "setup",
        restaurantIndex: 0,
        playerIndex: 0,
        revealIndex: 0,
      },
      votes: {}, // ✅ MAP, non array
      ranking: [], // ✅ array di OGGETTI (vedi computeRanking)
      winner: "",
    };

    try {
      await setDoc(doc(db, MATCH_COLLECTION, newCode), initial, { merge: true });
      setDraft(initial.settings);
      setScreen("setup");
      showToast(`Codice partita: ${newCode}`);
      await play("tap.mp3", 0.6);
    } catch (e) {
      console.log("createMatch error:", e);
      showToast("Errore creando la partita. Riprova.");
    }
  };

  const joinMatchByCode = async (entered) => {
    const c = normalizeCode(entered);
    if (!c) return;

    setMatchError("");
    setMatchLoading(true);

    try {
      const ref = doc(db, MATCH_COLLECTION, c);
      const snap = await getDoc(ref);

      if (!snap.exists()) {
        setMatchLoading(false);
        setMatchError("Codice non valido: partita non trovata.");
        return;
      }

      setCode(c);
      localStorage.setItem(LAST_CODE_KEY, c);

      const data = snap.data();
      if (data?.settings) setDraft(data.settings);

      setMatchLoading(false);
      setScreen(data?.state?.phase === "setup" ? "setup" : data?.state?.phase === "voting" ? "vote" : "reveal");
      showToast(`Entrato in partita ${c}`);
      await play("tap.mp3", 0.6);
    } catch (e) {
      console.log("joinMatch error:", e);
      setMatchLoading(false);
      setMatchError("Errore entrando nella partita. Riprova.");
    }
  };

  const leaveMatch = () => {
    setCode("");
    localStorage.removeItem(LAST_CODE_KEY);
    setMatch(null);
    setScreen("home");
    showToast("Uscito dalla partita");
  };

  /* -------------------------
     START MATCH (NO addDoc, NO nested arrays)
  ------------------------- */
  const startMatch = async () => {
    if (startBusy) return;
    setStartBusy(true);

    try {
      if (!matchRef) {
        showToast("Prima crea o entra in una partita (serve un codice).");
        return;
      }

      const saved = await saveSetup();
      if (!saved.ok) {
        showToast(saved.reason || "Setup non valido.");
        return;
      }

      await updateDoc(matchRef, {
        updatedAt: serverTimestamp(),
        "state.phase": "voting",
        "state.restaurantIndex": 0,
        "state.playerIndex": 0,
        "state.revealIndex": 0,
        ranking: [],
        winner: "",
      });

      setScreen("vote");
      showToast("Si parte! 🍷");
      await play("tap.mp3", 0.6);
    } catch (e) {
      console.log("startMatch error:", e);
      showToast(`Errore avviando la partita (${e?.code || "unknown"}).`);
    } finally {
      setStartBusy(false);
    }
  };

  /* -------------------------
     VOTING
  ------------------------- */
  const liveSettings = match?.settings || draft;
  const phase = match?.state?.phase || "setup";

  const activeRestaurants = (liveSettings.restaurantNames || defaultRestaurantNames()).slice(0, liveSettings.restaurantsCount);
  const activePlayers = (liveSettings.playerNames || defaultPlayerNames()).slice(0, liveSettings.playersCount);

  const rIndex = match?.state?.restaurantIndex ?? 0;
  const pIndex = match?.state?.playerIndex ?? 0;

  const currentRestaurant = activeRestaurants[rIndex] || `Ristorante ${rIndex + 1}`;
  const currentPlayer = activePlayers[pIndex] || `Giocatore ${pIndex + 1}`;

  useEffect(() => {
    setUseBonus(false);
    setVoteScores({ cibo: 5, servizio: 5, location: 5, conto: 5 });
  }, [match?.state?.restaurantIndex, match?.state?.playerIndex, match?.state?.phase]);

  const submitVote = async () => {
    if (!matchRef || !match?.settings || !match?.state) return;

    const settings = match.settings;
    const r = match.state.restaurantIndex ?? 0;
    const p = match.state.playerIndex ?? 0;

    const totalBase = voteScores.cibo + voteScores.servizio + voteScores.location + voteScores.conto;
    const bonusPoints = settings.bonusEnabled && useBonus ? 5 : 0;
    const total = totalBase + bonusPoints;

    const key = `r${r}_p${p}`;
    const vote = {
      restaurantIndex: r,
      playerIndex: p,
      categories: { ...voteScores },
      usedBonus: !!bonusPoints,
      total,
      ts: Date.now(),
    };

    const lastRestaurant = r >= settings.restaurantsCount - 1;
    const lastPlayer = p >= settings.playersCount - 1;

    let nextR = r;
    let nextP = p;

    if (lastPlayer) {
      nextP = 0;
      nextR = r + 1;
    } else {
      nextP = p + 1;
    }

    try {
      await play("confirm.mp3", 0.75);

      const update = {
        updatedAt: serverTimestamp(),
        [`votes.${key}`]: vote,
      };

      if (lastRestaurant && lastPlayer) {
        const nextVotes = { ...(match.votes || {}), [key]: vote };
        const ranking = computeRanking(settings, nextVotes); // ✅ array di OGGETTI
        update["state.phase"] = "reveal";
        update["state.revealIndex"] = 0;
        update["ranking"] = ranking;
        update["winner"] = ranking?.[0]?.name || "";
      } else {
        update["state.phase"] = "voting";
        update["state.restaurantIndex"] = nextR;
        update["state.playerIndex"] = nextP;
      }

      await updateDoc(matchRef, update);

      if (lastRestaurant && lastPlayer) {
        setScreen("reveal");
        await play("drumroll.mp3", 0.55);
      }
    } catch (e) {
      console.log("submitVote error:", e);
      showToast(`Errore salvando voto (${e?.code || "unknown"}).`);
    }
  };

  /* -------------------------
     REVEAL (studio tv)
  ------------------------- */
  const revealTimer = useRef(null);

  const stepReveal = async () => {
    if (!matchRef || !match) return;
    const idx = match.state?.revealIndex ?? 0;
    const max = (match.ranking || []).length;
    if (idx >= max) return;

    try {
      await updateDoc(matchRef, {
        updatedAt: serverTimestamp(),
        "state.revealIndex": idx + 1,
      });

      if (idx + 1 === max) await play("winners.mp3", 0.7);
      else await play("tap.mp3", 0.5);
    } catch {}
  };

  useEffect(() => {
    if (match?.state?.phase === "reveal") {
      if (revealTimer.current) clearInterval(revealTimer.current);
      play("drumroll.mp3", 0.55);
      revealTimer.current = setInterval(() => stepReveal(), 650);
    } else {
      if (revealTimer.current) clearInterval(revealTimer.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match?.state?.phase]);

  const revealedCount = match?.state?.revealIndex ?? 0;

  /* =========================
     RENDER
========================= */
  if (authBusy) {
    return (
      <div className="app">
        <div className="shell">
          <div className="brand">
            <div className="logo">🍳</div>
            <div>
              <h1>{APP_NAME}</h1>
              <p className="muted">Caricamento…</p>
            </div>
          </div>
          <div className="card">Sto scaldando le padelle…</div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="app">
        <div className="shell">
          <div className="brand">
            <div className="logo">🍳</div>
            <div>
              <h1>{APP_NAME}</h1>
              <p className="muted">Party game stile TV.</p>
            </div>
          </div>

          <div className="card glow">
            <h2>Accedi</h2>
            <p className="muted">Serve Google per salvare partite anche per mesi.</p>
            {authError ? <div className="alert">{authError}</div> : null}
            <button className="btn primary" type="button" onClick={login} disabled={authBusy}>
              Accedi con Google
            </button>

            <div className="muted tiny" style={{ marginTop: 10 }}>
              BUILD: <span className="mono">{BUILD}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <MusicPlayer enabled={musicOn} />
      {toast ? <div className="toast">{toast}</div> : null}

      <div className="shell">
        <header className="topbar">
          <div className="brand small">
            <div className="logo">🍳</div>
            <div className="titleblock">
              <div className="title">{APP_NAME}</div>
              <div className="sub muted">
                <span className="tiny">BUILD:</span> <strong className="mono">{BUILD}</strong>{" "}
                {code ? (
                  <span style={{ marginLeft: 8 }}>
                    <Pill>Codice</Pill> <strong className="mono">{normalizeCode(code)}</strong>
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="top-actions">
            {code ? (
              <button
                className="btn ghost"
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(normalizeCode(code));
                  showToast("Codice copiato ✅");
                  await play("tap.mp3", 0.5);
                }}
              >
                Copia codice
              </button>
            ) : null}
            <button className="btn ghost" type="button" onClick={logout}>
              Esci
            </button>
          </div>
        </header>

        {matchError ? <div className="alert">{matchError}</div> : null}
        {matchLoading ? <div className="banner">Sto sincronizzando…</div> : null}

        {/* HOME */}
        {screen === "home" && (
          <div className="grid">
            <div className="card hero glow">
              <h2>Benvenuto, {user.displayName?.split(" ")[0] || "Chef"} 👨‍🍳</h2>
              <p className="muted">Crea una partita o entra con un codice.</p>

              <div className="row">
                <button className="btn primary" type="button" onClick={createMatch}>
                  Inizia una partita
                </button>
                <button className="btn" type="button" onClick={() => setScreen("join")}>
                  Entra con codice
                </button>
                <button className="btn ghost" type="button" onClick={() => setScreen("setup")}>
                  Vai al setup
                </button>
              </div>

              {code && match ? (
                <div className="row" style={{ marginTop: 12 }}>
                  <button
                    className="btn ghost"
                    type="button"
                    onClick={() => {
                      if (phase === "setup") setScreen("setup");
                      if (phase === "voting") setScreen("vote");
                      if (phase === "reveal") setScreen("reveal");
                    }}
                  >
                    Riprendi partita
                  </button>
                  <button className="btn danger" type="button" onClick={leaveMatch}>
                    Esci dalla partita
                  </button>
                </div>
              ) : null}
            </div>

            <div className="card">
              <h3>Regia</h3>
              <ul className="list">
                <li>Setup scroll + sticky</li>
                <li>Avvia cena sempre cliccabile</li>
                <li>Voti per tutti i ristoranti e tutti i giocatori</li>
                <li>Nessun nested array (fix Firestore)</li>
              </ul>
            </div>
          </div>
        )}

        {/* JOIN */}
        {screen === "join" && (
          <div className="card glow">
            <h2>Entra con codice</h2>
            <p className="muted">Inserisci il codice (6 caratteri).</p>
            <TextInput value={code} onChange={(v) => setCode(normalizeCode(v))} placeholder="Es: K7P2QH" />

            <div className="row" style={{ marginTop: 12 }}>
              <button className="btn primary" type="button" onClick={() => joinMatchByCode(code)}>
                Entra
              </button>
              <button className="btn" type="button" onClick={() => setScreen("home")}>
                Indietro
              </button>
            </div>
          </div>
        )}

        {/* SETUP */}
        {screen === "setup" && (
          <div className="setupWrap">
            <div className="card glow setupCard">
              <div className="setupScroll">
                <div className="setupSticky">
                  <div className="setupHead">
                    <h2>Setup partita</h2>
                    <div className="muted tiny">
                      {canStart ? (
                        <>
                          Codice: <strong className="mono">{normalizeCode(code)}</strong>
                        </>
                      ) : (
                        <>Nessun codice partita (crea una partita qui sotto)</>
                      )}
                    </div>
                  </div>

                  {!canStart ? (
                    <div className="alert" style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 900, marginBottom: 6 }}>Non c’è una partita attiva.</div>
                      <button className="btn primary" type="button" onClick={createMatch}>
                        Crea partita adesso (genera codice)
                      </button>
                    </div>
                  ) : null}

                  <div className="two">
                    <div className="field">
                      <div className="field-top">
                        <div className="label">Ristoranti: {draft.restaurantsCount}</div>
                        <div className="hint">4–8</div>
                      </div>
                      <Slider
                        min={4}
                        max={8}
                        value={draft.restaurantsCount}
                        onChange={(v) => setDraft((d) => ({ ...d, restaurantsCount: v }))}
                      />
                    </div>

                    <div className="field">
                      <div className="field-top">
                        <div className="label">Giocatori: {draft.playersCount}</div>
                        <div className="hint">4–8</div>
                      </div>
                      <Slider
                        min={4}
                        max={8}
                        value={draft.playersCount}
                        onChange={(v) => setDraft((d) => ({ ...d, playersCount: v }))}
                      />
                    </div>
                  </div>

                  <div className="two">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={draft.bonusEnabled}
                        onChange={(e) => setDraft((d) => ({ ...d, bonusEnabled: e.target.checked }))}
                      />
                      Bonus speciale <strong>+5</strong>
                    </label>

                    <label className="check">
                      <input
                        type="checkbox"
                        checked={draft.musicEnabled}
                        onChange={(e) => setDraft((d) => ({ ...d, musicEnabled: e.target.checked }))}
                      />
                      Musica
                    </label>
                  </div>
                </div>

                <div className="divider" />

                <h3>Nomi ristoranti</h3>
                <div className="cols">
                  {Array.from({ length: draft.restaurantsCount }).map((_, i) => (
                    <TextInput
                      key={`r-${i}`}
                      value={draft.restaurantNames?.[i] || ""}
                      onChange={(v) =>
                        setDraft((d) => {
                          const next = [...(d.restaurantNames || defaultRestaurantNames())];
                          next[i] = v;
                          return { ...d, restaurantNames: next };
                        })
                      }
                      placeholder={`Ristorante ${i + 1}`}
                    />
                  ))}
                </div>

                <h3 style={{ marginTop: 14 }}>Nomi giocatori</h3>
                <div className="cols">
                  {Array.from({ length: draft.playersCount }).map((_, i) => (
                    <TextInput
                      key={`p-${i}`}
                      value={draft.playerNames?.[i] || ""}
                      onChange={(v) =>
                        setDraft((d) => {
                          const next = [...(d.playerNames || defaultPlayerNames())];
                          next[i] = v;
                          return { ...d, playerNames: next };
                        })
                      }
                      placeholder={`Giocatore ${i + 1}`}
                    />
                  ))}
                </div>

                <div style={{ height: 110 }} />
              </div>

              <div className="setupBar">
                <button
                  className="btn"
                  type="button"
                  onClick={async () => {
                    const res = await saveSetup();
                    if (!res.ok) showToast(res.reason || "Errore setup");
                    else showToast("Setup salvato ✅");
                  }}
                  disabled={!canStart}
                >
                  Salva
                </button>

                <button
                  className="btn primary"
                  type="button"
                  onClick={startMatch}
                  disabled={!canStart || startBusy}
                >
                  {startBusy ? "Avvio…" : "Avvia la cena 🍷"}
                </button>

                <button className="btn ghost" type="button" onClick={() => setScreen("home")}>
                  Home
                </button>
              </div>
            </div>

            <div className="card">
              <h3>Condivisione</h3>
              <p className="muted">
                Codice partita: <strong className="mono">{normalizeCode(code) || "—"}</strong>
              </p>
              <div className="divider" />
              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  if (phase === "voting") setScreen("vote");
                  else showToast("La partita deve essere avviata.");
                }}
              >
                Vai al voto
              </button>
            </div>
          </div>
        )}

        {/* VOTE */}
        {screen === "vote" && (
          <div className="grid">
            <div className="card glow">
              <div className="stage">
                <div className="stage-left">
                  <h2>Voto</h2>
                  <div className="muted">
                    Ristorante <Pill>{rIndex + 1}/{liveSettings.restaurantsCount}</Pill>{" "}
                    <strong>{currentRestaurant}</strong>
                  </div>
                  <div className="muted" style={{ marginTop: 6 }}>
                    Tocca a <Pill>{pIndex + 1}/{liveSettings.playersCount}</Pill>{" "}
                    <strong>{currentPlayer}</strong>
                  </div>
                </div>
                <div className="stage-right">
                  <button className="btn ghost" type="button" onClick={() => setScreen("setup")}>
                    Setup
                  </button>
                </div>
              </div>

              <div className="divider" />

              <div className="voteGrid">
                <div className="voteRow">
                  <div className="voteLabel">🍝 Cibo</div>
                  <Slider value={voteScores.cibo} onChange={(v) => setVoteScores((s) => ({ ...s, cibo: v }))} />
                  <div className="voteVal">{voteScores.cibo}</div>
                </div>
                <div className="voteRow">
                  <div className="voteLabel">🛎 Servizio</div>
                  <Slider value={voteScores.servizio} onChange={(v) => setVoteScores((s) => ({ ...s, servizio: v }))} />
                  <div className="voteVal">{voteScores.servizio}</div>
                </div>
                <div className="voteRow">
                  <div className="voteLabel">🏠 Location</div>
                  <Slider value={voteScores.location} onChange={(v) => setVoteScores((s) => ({ ...s, location: v }))} />
                  <div className="voteVal">{voteScores.location}</div>
                </div>
                <div className="voteRow">
                  <div className="voteLabel">💸 Conto</div>
                  <Slider value={voteScores.conto} onChange={(v) => setVoteScores((s) => ({ ...s, conto: v }))} />
                  <div className="voteVal">{voteScores.conto}</div>
                </div>
              </div>

              <div className="divider" />

              <div className="row">
                {liveSettings.bonusEnabled ? (
                  <label className="check">
                    <input type="checkbox" checked={useBonus} onChange={(e) => setUseBonus(e.target.checked)} />
                    Usa Bonus +5
                  </label>
                ) : (
                  <div className="muted tiny">Bonus disattivato</div>
                )}
                <div className="spacer" />
                <div className="total">
                  Totale:{" "}
                  <strong>
                    {voteScores.cibo + voteScores.servizio + voteScores.location + voteScores.conto + (liveSettings.bonusEnabled && useBonus ? 5 : 0)}
                  </strong>
                </div>
              </div>

              <div className="row" style={{ marginTop: 12 }}>
                <button className="btn primary" type="button" onClick={submitVote}>
                  Conferma voto
                </button>
                <button className="btn" type="button" onClick={() => setScreen("home")}>
                  Home
                </button>
              </div>
            </div>

            <div className="card">
              <h3>Avanzamento</h3>
              <div className="muted">
                Ristorante: <strong>{rIndex + 1}</strong> / {liveSettings.restaurantsCount}
              </div>
              <div className="muted">
                Giocatore: <strong>{pIndex + 1}</strong> / {liveSettings.playersCount}
              </div>

              <div className="divider" />

              <div className="muted tiny">
                Voti registrati: {Object.keys(match?.votes || {}).length} / {liveSettings.restaurantsCount * liveSettings.playersCount}
              </div>

              <div className="divider" />

              <button
                className="btn ghost"
                type="button"
                onClick={() => {
                  if ((match?.state?.phase || "") === "reveal") setScreen("reveal");
                  else showToast("La classifica arriva a fine votazioni.");
                }}
              >
                Vai alla classifica
              </button>
            </div>
          </div>
        )}

        {/* REVEAL */}
        {screen === "reveal" && (
          <div className="card reveal">
            <div className="studioLights" aria-hidden="true" />
            <h2>🎬 Reveal “studio TV”</h2>
            <p className="muted">Screenshot pronto 📸</p>

            <div className="divider" />

            <div className="ranking">
              {(match?.ranking || []).slice(0, revealedCount).map((r, i) => (
                <div key={r.name + i} className={`rankItem ${i === 0 ? "winner" : ""}`}>
                  <div className="rankPos">{i + 1}</div>
                  <div className="rankName">{r.name}</div>
                  <div className="rankScore">{r.score}</div>
                </div>
              ))}
              {revealedCount === 0 ? <div className="muted tiny">Silenzio in studio…</div> : null}
            </div>

            <div className="row" style={{ marginTop: 14 }}>
              <button className="btn" type="button" onClick={stepReveal}>
                Rivela prossimo
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={async () => {
                  const max = (match?.ranking || []).length;
                  try {
                    await updateDoc(matchRef, { "state.revealIndex": max, updatedAt: serverTimestamp() });
                    await play("winners.mp3", 0.7);
                  } catch {}
                }}
              >
                Rivela tutto
              </button>
              <button className="btn ghost" type="button" onClick={() => setScreen("home")}>
                Home
              </button>
            </div>

            {match?.winner ? (
              <div className="winnerBanner">
                🏆 Vince <strong>{match.winner}</strong> — applausi della regia!
              </div>
            ) : null}
          </div>
        )}

        <footer className="footer muted">
          <span className="tiny">Utente: <strong>{user.email}</strong></span>
          <span className="tiny">{code ? <>Partita: <strong className="mono">{normalizeCode(code)}</strong></> : "—"}</span>
        </footer>
      </div>
    </div>
  );
}