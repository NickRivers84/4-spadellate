import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import { auth, db } from "./firebase";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  doc,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

/* =========================
   App config
========================= */
const APP_NAME = "Forchette&Polpette";
const BUILD = "modes-no-autoresume-002";
const LS_LAST_CODE = "fpp_last_match_code";

/* =========================
   Helpers
========================= */
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function genCode(len = 6) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // evita 0/O/I/1
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function ensureSize(arr, size, fallback) {
  const out = Array.isArray(arr) ? [...arr] : [];
  while (out.length < size) out.push(fallback(out.length));
  return out.slice(0, size);
}

function defaultsRestaurants() {
  return [
    "La Bottega",
    "Trattoria Roma",
    "Osteria Bella",
    "Polpetta Palace",
    "La Brace",
    "Il Tegame",
    "Forchetta & Co",
    "Sugo Supremo",
  ];
}

function defaultsPlayers() {
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

function sumVote(v) {
  if (!v) return 0;
  const base =
    (v.cibo || 0) + (v.servizio || 0) + (v.location || 0) + (v.conto || 0);
  return base + (v.bonusApplied ? 5 : 0);
}

function matchRef(code) {
  return doc(db, "matches", code);
}

/* =========================
   Audio safe
========================= */
function useSfx() {
  const cacheRef = useRef(new Map());

  async function headOk(url) {
    try {
      const res = await fetch(url, { method: "HEAD", cache: "no-store" });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function play(name, volume = 0.7) {
    const url = `/audio/${name}`;
    if (!cacheRef.current.has(url)) {
      const ok = await headOk(url);
      cacheRef.current.set(url, ok);
    }
    if (!cacheRef.current.get(url)) return;

    try {
      const a = new Audio(url);
      a.volume = volume;
      await a.play();
    } catch {
      // ok: browser può bloccare senza gesture
    }
  }

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
    const a = ref.current;
    if (enabled) a.play().catch(() => {});
    else a.pause();
  }, [enabled]);

  return null;
}

/* =========================
   UI atoms
========================= */
function Pill({ children }) {
  return <span className="pill">{children}</span>;
}

function Slider({ label, value, onChange, min = 2, max = 8 }) {
  return (
    <div className="sliderRow">
      <div className="sliderLabel">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <input
        className="slider"
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function ScoreSlider({ label, value, onChange }) {
  return (
    <div className="sliderRow">
      <div className="sliderLabel">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <input
        className="slider"
        type="range"
        min={0}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </div>
  );
}

function StudioOverlay({ show }) {
  return (
    <div className={`studio ${show ? "studio--show" : ""}`}>
      <div className="studioGlow a" />
      <div className="studioGlow b" />
      <div className="studioGlow c" />
      <div className="studioNoise" />
    </div>
  );
}

/* =========================
   Modes
========================= */
const MODES = [
  {
    key: "CLASSICA",
    title: "CLASSICA",
    subtitle: "Come lo show TV",
    desc: "4 partecipanti • 4 ristoranti • regole fisse",
  },
  {
    key: "PERSONALIZZATA",
    title: "PERSONALIZZATA",
    subtitle: "Fai tu le regole",
    desc: "2–8 partecipanti • 2–8 ristoranti • totale libertà",
  },
  {
    key: "ONE_SHOT",
    title: "ONE SHOT",
    subtitle: "Un solo ristorante",
    desc: "2–8 partecipanti • 1 ristorante • giro secco",
  },
];

/* =========================
   Firestore: create / update
========================= */
async function createNewMatch({ user, mode }) {
  // prova più volte per evitare collisioni codice
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = genCode(6);
    const ref = matchRef(code);
    const exists = await getDoc(ref);
    if (exists.exists()) continue;

    let participantsCount = 4;
    let restaurantsCount = 4;

    if (mode === "CLASSICA") {
      participantsCount = 4;
      restaurantsCount = 4;
    } else if (mode === "PERSONALIZZATA") {
      participantsCount = 4;
      restaurantsCount = 4;
    } else if (mode === "ONE_SHOT") {
      participantsCount = 4;
      restaurantsCount = 1;
    }

    const restaurantNames = ensureSize(
      defaultsRestaurants(),
      restaurantsCount,
      (i) => `Ristorante ${i + 1}`
    );

    const participantNames = ensureSize(
      defaultsPlayers(),
      participantsCount,
      (i) => `Giocatore ${i + 1}`
    );

    const payload = {
      app: APP_NAME,
      build: BUILD,
      version: 1,
      code,
      ownerUid: user.uid,
      ownerName: user.displayName || "Host",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      settings: {
        mode,
        participantsCount,
        restaurantsCount,
        bonusEnabled: true,
        musicEnabled: false,
        restaurantNames,
        participantNames,
      },
      state: {
        phase: "setup", // setup | voting | reveal | ranking
        pIndex: 0,
        rIndex: 0,
        bonusUsedByP: {}, // { p0:true }
        votesByP: {}, // { p0:{ r0:{...vote} } }
        finishedAt: null,
      },
    };

    await setDoc(ref, payload);
    localStorage.setItem(LS_LAST_CODE, code);
    return code;
  }

  throw new Error("Impossibile generare un codice partita (collisioni).");
}

async function updateMatch(code, partial) {
  await updateDoc(matchRef(code), { ...partial, updatedAt: serverTimestamp() });
}

/* =========================
   App
========================= */
export default function App() {
  const { play } = useSfx();

  // auth
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState(null);
  const provider = useMemo(() => {
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    return p;
  }, []);

  // navigation
  const [screen, setScreen] = useState("home"); // home | mode | setup | vote | reveal | ranking
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  // match loading (NO auto-resume!)
  const [code, setCode] = useState("");
  const [lastCode, setLastCode] = useState(localStorage.getItem(LS_LAST_CODE) || "");
  const [joinInput, setJoinInput] = useState("");

  // match data
  const [match, setMatch] = useState(null);

  // local-only reveal UI
  const [revealStep, setRevealStep] = useState(0);
  const [revealRunning, setRevealRunning] = useState(false);

  // music
  const [musicOn, setMusicOn] = useState(false);

  // auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // subscribe match only if user + code selected
  useEffect(() => {
    if (!user || !code) {
      setMatch(null);
      return;
    }

    const unsub = onSnapshot(
      matchRef(code),
      (snap) => {
        if (!snap.exists()) {
          setToast("Partita non trovata. Controlla il codice.");
          setMatch(null);
          return;
        }
        const data = snap.data();
        setMatch(data);
        setMusicOn(!!data?.settings?.musicEnabled);
      },
      (err) => {
        console.error("Firestore onSnapshot error:", err);
        setToast("Errore Firestore: permessi/connessione.");
      }
    );

    return () => unsub();
  }, [user, code]);

  // toast auto hide
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  // auto screen by phase when match is loaded
  useEffect(() => {
    if (!match) return;
    const ph = match?.state?.phase;
    if (!ph) return;
    if (ph === "setup") setScreen("setup");
    if (ph === "voting") setScreen("vote");
    if (ph === "reveal") setScreen("reveal");
    if (ph === "ranking") setScreen("ranking");
  }, [match]);

  const settings = match?.settings;
  const state = match?.state;

  const mode = settings?.mode || "PERSONALIZZATA";
  const participantsCount = settings?.participantsCount || 0;
  const restaurantsCount = settings?.restaurantsCount || 0;

  const participantNames = ensureSize(
    settings?.participantNames || [],
    participantsCount,
    (i) => `Giocatore ${i + 1}`
  );

  const restaurantNames = ensureSize(
    settings?.restaurantNames || [],
    restaurantsCount,
    (i) => `Ristorante ${i + 1}`
  );

  const bonusEnabled = !!settings?.bonusEnabled;
  const bonusUsedByP = state?.bonusUsedByP || {};
  const votesByP = state?.votesByP || {};

  const pIndex = state?.pIndex || 0;
  const rIndex = state?.rIndex || 0;

  const currentPlayer = participantNames[pIndex] || `Giocatore ${pIndex + 1}`;
  const currentRestaurant = restaurantNames[rIndex] || `Ristorante ${rIndex + 1}`;

  const ranking = useMemo(() => {
    if (!match) return [];
    const totals = Array(restaurantsCount).fill(0);

    for (let pi = 0; pi < participantsCount; pi++) {
      const pk = `p${pi}`;
      const pv = votesByP?.[pk] || {};
      for (let ri = 0; ri < restaurantsCount; ri++) {
        const rk = `r${ri}`;
        totals[ri] += sumVote(pv?.[rk]);
      }
    }

    const list = restaurantNames.map((name, i) => ({
      name,
      score: totals[i] || 0,
    }));

    list.sort((a, b) => b.score - a.score);
    return list;
  }, [match, restaurantsCount, participantsCount, votesByP, restaurantNames]);

  // ======= actions
  async function doLogin() {
    try {
      setBusy(true);
      await signInWithPopup(auth, provider);
      play("tap.mp3", 0.5);
    } catch (e) {
      console.error(e);
      setToast("Login non riuscito (popup/cookie).");
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    try {
      setBusy(true);
      await signOut(auth);
      setCode("");
      setMatch(null);
      setScreen("home");
    } catch (e) {
      console.error(e);
      setToast("Logout non riuscito.");
    } finally {
      setBusy(false);
    }
  }

  async function startNewMatch(selectedMode) {
    if (!user) return;
    try {
      setBusy(true);
      play("tap.mp3", 0.5);
      const newCode = await createNewMatch({ user, mode: selectedMode });
      setCode(newCode);
      setLastCode(newCode);
      setToast(`Partita creata! Codice: ${newCode}`);
      setScreen("setup");
    } catch (e) {
      console.error(e);
      setToast("Errore creando la partita (Firestore/permessi).");
    } finally {
      setBusy(false);
    }
  }

  async function resumeLastMatch() {
    if (!user) return;
    const last = localStorage.getItem(LS_LAST_CODE) || "";
    if (!last) {
      setToast("Nessuna partita salvata in questo browser.");
      return;
    }
    setCode(last);
    setLastCode(last);
    setToast("Partita ripresa.");
  }

  async function joinByCode() {
    if (!user) return;
    const c = (joinInput || "").trim().toUpperCase();
    if (!c) return;

    try {
      setBusy(true);
      const snap = await getDoc(matchRef(c));
      if (!snap.exists()) {
        setToast("Codice non valido (partita non trovata).");
        return;
      }
      localStorage.setItem(LS_LAST_CODE, c);
      setLastCode(c);
      setCode(c);
      setToast("Partita caricata.");
      setScreen("home");
    } catch (e) {
      console.error(e);
      setToast("Errore caricando la partita.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSetup(nextSettings) {
    if (!code) return;
    try {
      await updateMatch(code, { settings: nextSettings });
      play("tap.mp3", 0.35);
    } catch (e) {
      console.error(e);
      setToast("Errore nel salvataggio setup.");
    }
  }

  function canStartDinner() {
    if (!settings) return false;
    const rn = (settings.restaurantNames || []).slice(0, settings.restaurantsCount);
    const pn = (settings.participantNames || []).slice(0, settings.participantsCount);

    const okR = rn.every((x) => (x || "").trim().length > 0);
    const okP = pn.every((x) => (x || "").trim().length > 0);
    return okR && okP;
  }

  async function goVoting() {
    if (!match || !code) return;
    if (!canStartDinner()) {
      setToast("Inserisci tutti i nomi prima di avviare.");
      return;
    }

    try {
      setBusy(true);
      await updateMatch(code, {
        state: {
          ...match.state,
          phase: "voting",
          pIndex: 0,
          rIndex: 0,
        },
      });
      play("confirm.mp3", 0.7);
      setScreen("vote");
    } catch (e) {
      console.error(e);
      setToast("Non riesco ad avviare la cena (Firestore/permessi).");
    } finally {
      setBusy(false);
    }
  }

  async function resetMatchToSetup() {
    if (!match || !code) return;
    try {
      setBusy(true);
      await updateMatch(code, {
        state: {
          ...match.state,
          phase: "setup",
          pIndex: 0,
          rIndex: 0,
          bonusUsedByP: {},
          votesByP: {},
          finishedAt: null,
        },
      });
      setRevealStep(0);
      setRevealRunning(false);
      play("tap.mp3", 0.5);
      setScreen("setup");
      setToast("Partita resettata.");
    } catch (e) {
      console.error(e);
      setToast("Errore resettando la partita.");
    } finally {
      setBusy(false);
    }
  }

  async function submitVote(vote) {
    if (!match || !code) return;

    const s = match.settings;
    const st = match.state;

    const pc = s.participantsCount;
    const rc = s.restaurantsCount;

    const pk = `p${st.pIndex}`;
    const rk = `r${st.rIndex}`;

    const nextVotesByP = { ...(st.votesByP || {}) };
    if (!nextVotesByP[pk]) nextVotesByP[pk] = {};
    nextVotesByP[pk][rk] = vote;

    const nextBonusUsedByP = { ...(st.bonusUsedByP || {}) };
    if (vote.bonusApplied) nextBonusUsedByP[pk] = true;

    let nextP = st.pIndex;
    let nextR = st.rIndex;

    if (s.mode === "ONE_SHOT") {
      nextP = st.pIndex + 1;
      nextR = 0;
    } else {
      nextR = st.rIndex + 1;
      if (nextR >= rc) {
        nextR = 0;
        nextP = st.pIndex + 1;
      }
    }

    const finished = nextP >= pc;

    const nextState = {
      ...st,
      votesByP: nextVotesByP,
      bonusUsedByP: nextBonusUsedByP,
      pIndex: finished ? st.pIndex : nextP,
      rIndex: finished ? st.rIndex : nextR,
      phase: finished ? "reveal" : "voting",
      finishedAt: finished ? serverTimestamp() : st.finishedAt || null,
    };

    try {
      await updateMatch(code, { state: nextState });
      play("tap.mp3", 0.45);
      if (finished) setScreen("reveal");
    } catch (e) {
      console.error(e);
      setToast("Errore salvando il voto.");
    }
  }

  async function startReveal() {
    if (revealRunning) return;
    setRevealRunning(true);
    setRevealStep(0);

    await play("drumroll.mp3", 0.55);

    setRevealStep(1);
    setTimeout(() => setRevealStep(2), 900);
    setTimeout(() => setRevealStep(3), 1800);
    setTimeout(() => setRevealStep(4), 2700);

    setTimeout(async () => {
      try {
        await updateMatch(code, { state: { ...match.state, phase: "ranking" } });
      } catch {
        // ok
      }
      setScreen("ranking");
      play("winners.mp3", 0.65);
    }, 3500);
  }

  // ======= vote form state (local)
  const [cibo, setCibo] = useState(5);
  const [servizio, setServizio] = useState(5);
  const [location, setLocation] = useState(5);
  const [conto, setConto] = useState(5);
  const [useBonus, setUseBonus] = useState(false);

  useEffect(() => {
    // reset sliders when cursor changes
    if (screen !== "vote") return;
    setCibo(5);
    setServizio(5);
    setLocation(5);
    setConto(5);
    setUseBonus(false);
  }, [screen, pIndex, rIndex]);

  // ======= render guards
  if (!authReady) {
    return (
      <div className="app">
        <div className="shell">
          <div className="panel center">
            <div className="spinner" />
            <div className="muted">Caricamento…</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <MusicPlayer enabled={musicOn} />
      <StudioOverlay show={screen === "reveal" || screen === "ranking"} />

      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <div className="logo">🍴</div>
            <div className="brandText">
              <div className="title">{APP_NAME}</div>
              <div className="sub">
                <Pill>BUILD: {BUILD}</Pill>
                {code ? <Pill>CODICE: {code}</Pill> : <Pill>NESSUNA PARTITA</Pill>}
              </div>
            </div>
          </div>

          <div className="topActions">
            {user ? (
              <>
                <div className="userChip" title={user.email || ""}>
                  <span className="userDot" />
                  <span className="userName">{user.displayName || "Utente"}</span>
                </div>
                <button className="btn ghost" onClick={doLogout} disabled={busy}>
                  Esci
                </button>
              </>
            ) : (
              <button className="btn" onClick={doLogin} disabled={busy}>
                Accedi con Google
              </button>
            )}
          </div>
        </header>

        {toast ? <div className="toast">{toast}</div> : null}

        {/* HOME */}
        {screen === "home" && (
          <main className="panel">
            {!user ? (
              <div className="centerStack">
                <h2 className="h2">Benvenuto in studio.</h2>
                <p className="muted">Per salvare e riprendere partite serve l’accesso Google.</p>
                <button className="btn big" onClick={doLogin} disabled={busy}>
                  Accedi con Google
                </button>
              </div>
            ) : (
              <>
                <div className="hero">
                  <h2 className="h2">Pronti a giudicare? 🍝</h2>
                  <p className="muted">
                    Ora la partita NON si riprende da sola: scegli tu “Inizia” o “Riprendi”.
                  </p>
                </div>

                <div className="grid2">
                  <button className="btn big" onClick={() => setScreen("mode")} disabled={busy}>
                    Inizia una partita
                  </button>

                  <button
                    className="btn big ghost"
                    onClick={resumeLastMatch}
                    disabled={!lastCode || busy}
                  >
                    Riprendi partita
                  </button>
                </div>

                <div className="divider" />

                <div className="joinRow">
                  <input
                    className="input"
                    value={joinInput}
                    onChange={(e) => setJoinInput(e.target.value.toUpperCase())}
                    placeholder="Entra con codice (es. AB12CD)"
                  />
                  <button className="btn" onClick={joinByCode} disabled={busy}>
                    Entra
                  </button>
                </div>

                {match && code ? (
                  <div className="miniCard">
                    <div className="miniRow">
                      <div>
                        <div className="miniTitle">Partita caricata</div>
                        <div className="muted">
                          Modalità: <strong>{mode}</strong> • {participantsCount} partecipanti •{" "}
                          {restaurantsCount} ristoranti
                        </div>
                      </div>
                      <div className="miniActions">
                        <button className="btn" onClick={() => setScreen("setup")}>
                          Vai al setup
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="muted small" style={{ marginTop: 10 }}>
                    Nessuna partita caricata: premi “Riprendi” o entra con un codice.
                  </div>
                )}
              </>
            )}
          </main>
        )}

        {/* MODE PICKER */}
        {screen === "mode" && (
          <main className="panel">
            <div className="hero">
              <h2 className="h2">Scegli la modalità</h2>
              <p className="muted">Tre stili, stessa cattiveria… ehm, “oggettività”.</p>
            </div>

            <div className="modeGrid">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  className="card"
                  type="button"
                  onClick={() => startNewMatch(m.key)}
                  disabled={busy}
                >
                  <div className="cardTop">
                    <div className="cardTitle">{m.title}</div>
                    <div className="cardSubtitle">{m.subtitle}</div>
                  </div>
                  <div className="cardDesc">{m.desc}</div>
                </button>
              ))}
            </div>

            <div className="rowRight">
              <button className="btn ghost" onClick={() => setScreen("home")}>
                ← Indietro
              </button>
            </div>
          </main>
        )}

        {/* SETUP */}
        {screen === "setup" && (
          <main className="panel">
            {!match ? (
              <div className="centerStack">
                <div className="muted">Carico la partita…</div>
              </div>
            ) : (
              <>
                <div className="hero">
                  <h2 className="h2">Setup partita</h2>
                  <p className="muted">Scegli tutto prima di iniziare (poi si spadella).</p>
                </div>

                <div className="setupGrid">
                  <div className="setupCard">
                    <div className="setupTitle">Impostazioni</div>
                    <div className="muted small">Modalità: <strong>{mode}</strong></div>

                    {/* Conteggi */}
                    {mode === "CLASSICA" ? (
                      <div className="muted small" style={{ marginTop: 8 }}>
                        CLASSICA: 4 partecipanti e 4 ristoranti sono fissi.
                      </div>
                    ) : (
                      <>
                        <Slider
                          label="Partecipanti"
                          value={participantsCount}
                          min={2}
                          max={8}
                          onChange={(v) => {
                            const next = {
                              ...settings,
                              participantsCount: clamp(v, 2, 8),
                              participantNames: ensureSize(
                                settings.participantNames || [],
                                clamp(v, 2, 8),
                                (i) => defaultsPlayers()[i] || `Giocatore ${i + 1}`
                              ),
                            };
                            saveSetup(next);
                          }}
                        />

                        {mode === "ONE_SHOT" ? (
                          <div className="muted small">
                            ONE SHOT: ristorante unico (1).
                          </div>
                        ) : (
                          <Slider
                            label="Ristoranti"
                            value={restaurantsCount}
                            min={2}
                            max={8}
                            onChange={(v) => {
                              const next = {
                                ...settings,
                                restaurantsCount: clamp(v, 2, 8),
                                restaurantNames: ensureSize(
                                  settings.restaurantNames || [],
                                  clamp(v, 2, 8),
                                  (i) => defaultsRestaurants()[i] || `Ristorante ${i + 1}`
                                ),
                              };
                              saveSetup(next);
                            }}
                          />
                        )}
                      </>
                    )}

                    {/* Toggles */}
                    <label className="checkRow">
                      <input
                        type="checkbox"
                        checked={!!settings.bonusEnabled}
                        onChange={(e) => {
                          const next = { ...settings, bonusEnabled: e.target.checked };
                          saveSetup(next);
                        }}
                      />
                      Bonus +5 (facoltativo)
                    </label>

                    <label className="checkRow">
                      <input
                        type="checkbox"
                        checked={!!settings.musicEnabled}
                        onChange={(e) => {
                          const next = { ...settings, musicEnabled: e.target.checked };
                          saveSetup(next);
                        }}
                      />
                      Musica (attivabile)
                    </label>

                    <div className="divider" />

                    <button
                      className="btn big"
                      onClick={goVoting}
                      disabled={!canStartDinner() || busy}
                    >
                      Avvia la cena 🍷
                    </button>

                    <button className="btn ghost" onClick={resetMatchToSetup} disabled={busy}>
                      Reset partita
                    </button>

                    <button className="btn ghost" onClick={() => setScreen("home")}>
                      ← Torna Home
                    </button>
                  </div>

                  <div className="setupCard">
                    <div className="setupTitle">Nomi partecipanti</div>
                    <div className="muted small">Tutti devono avere un nome (anche buffo).</div>

                    <div className="list">
                      {participantNames.map((name, i) => (
                        <input
                          key={i}
                          className="input"
                          value={name}
                          onChange={(e) => {
                            const pn = [...participantNames];
                            pn[i] = e.target.value;
                            const next = { ...settings, participantNames: pn };
                            saveSetup(next);
                          }}
                          placeholder={`Giocatore ${i + 1}`}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="setupCard">
                    <div className="setupTitle">Nomi ristoranti</div>
                    <div className="muted small">
                      {mode === "ONE_SHOT"
                        ? "ONE SHOT: un solo ristorante."
                        : "Dai nomi memorabili (o pericolosi)."}
                    </div>

                    <div className="list">
                      {restaurantNames.map((name, i) => (
                        <input
                          key={i}
                          className="input"
                          value={name}
                          onChange={(e) => {
                            const rn = [...restaurantNames];
                            rn[i] = e.target.value;
                            const next = { ...settings, restaurantNames: rn };
                            saveSetup(next);
                          }}
                          placeholder={`Ristorante ${i + 1}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </main>
        )}

        {/* VOTE */}
        {screen === "vote" && (
          <main className="panel">
            {!match ? (
              <div className="centerStack">
                <div className="muted">Carico…</div>
              </div>
            ) : (
              <>
                <div className="hero">
                  <h2 className="h2">Votazione</h2>
                  <p className="muted">
                    <strong>{currentPlayer}</strong> valuta{" "}
                    <strong>{currentRestaurant}</strong>
                  </p>

                  <div className="muted small">
                    {mode === "ONE_SHOT" ? (
                      <>Giocatore {pIndex + 1} / {participantsCount}</>
                    ) : (
                      <>
                        Giocatore {pIndex + 1} / {participantsCount} • Ristorante {rIndex + 1} / {restaurantsCount}
                      </>
                    )}
                  </div>
                </div>

                <div className="voteGrid">
                  <div className="setupCard">
                    <div className="setupTitle">Voti</div>

                    <ScoreSlider label="🍝 Cibo" value={cibo} onChange={setCibo} />
                    <ScoreSlider label="🛎️ Servizio" value={servizio} onChange={setServizio} />
                    <ScoreSlider label="🏠 Location" value={location} onChange={setLocation} />
                    <ScoreSlider label="💸 Conto" value={conto} onChange={setConto} />

                    <div className="divider" />

                    <div className="muted small">
                      Totale: <strong>{cibo + servizio + location + conto + (useBonus ? 5 : 0)}</strong>
                      {useBonus ? " (bonus incluso)" : ""}
                    </div>

                    {bonusEnabled ? (
                      <label className="checkRow">
                        <input
                          type="checkbox"
                          checked={useBonus}
                          disabled={!!bonusUsedByP[`p${pIndex}`]}
                          onChange={(e) => setUseBonus(e.target.checked)}
                        />
                        Bonus +5 (solo 1 volta per giocatore)
                      </label>
                    ) : (
                      <div className="muted small">Bonus disattivato.</div>
                    )}

                    <button
                      className="btn big"
                      onClick={() => {
                        const vote = {
                          cibo,
                          servizio,
                          location,
                          conto,
                          bonusApplied: bonusEnabled && useBonus && !bonusUsedByP[`p${pIndex}`],
                          at: nowISO(),
                          pIndex,
                          rIndex,
                        };
                        submitVote(vote);
                      }}
                    >
                      Conferma voto
                    </button>

                    <button className="btn ghost" onClick={() => setScreen("setup")}>
                      ← Torna Setup
                    </button>
                  </div>
                </div>
              </>
            )}
          </main>
        )}

        {/* REVEAL */}
        {screen === "reveal" && (
          <main className="panel">
            <div className="hero">
              <h2 className="h2">Studio TV</h2>
              <p className="muted">Si apre la busta… (quasi).</p>
            </div>

            <div className="revealCard">
              <div className={`revealLine ${revealStep >= 1 ? "on" : ""}`}>🎥 Cam 1 pronta</div>
              <div className={`revealLine ${revealStep >= 2 ? "on" : ""}`}>💡 Luci studio… ON</div>
              <div className={`revealLine ${revealStep >= 3 ? "on" : ""}`}>🥁 Rullo di tamburi…</div>
              <div className={`revealLine ${revealStep >= 4 ? "on" : ""}`}>📣 “E ORA… CLASSIFICA!”</div>

              <button className="btn big" onClick={startReveal} disabled={revealRunning}>
                Reveal classifica
              </button>

              <button className="btn ghost" onClick={() => setScreen("setup")}>
                ← Torna Setup
              </button>
            </div>
          </main>
        )}

        {/* RANKING */}
        {screen === "ranking" && (
          <main className="panel">
            <div className="hero">
              <h2 className="h2">🏆 Classifica finale</h2>
              <p className="muted">Screenshot pronta 📸</p>
            </div>

            <div className="ranking">
              {ranking.map((r, i) => (
                <div key={r.name} className={`rankRow ${i === 0 ? "winner" : ""}`}>
                  <div className="rankPos">{i + 1}</div>
                  <div className="rankName">{r.name}</div>
                  <div className="rankScore">{r.score}</div>
                </div>
              ))}
            </div>

            <div className="grid2" style={{ marginTop: 14 }}>
              <button className="btn big" onClick={resetMatchToSetup}>
                Nuova cena (stessa partita)
              </button>
              <button className="btn big ghost" onClick={() => setScreen("home")}>
                Torna Home
              </button>
            </div>
          </main>
        )}
      </div>
    </div>
  );
}