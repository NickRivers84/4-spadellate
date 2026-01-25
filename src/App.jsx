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
   CONFIG
========================= */
const APP_NAME = "Forchette&Polpette";
const BUILD = "modes-001";
const LS_LAST_CODE = "fpp_last_match_code";

/* =========================
   Utils
========================= */
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function nowISO() {
  return new Date().toISOString();
}

function genCode(len = 6) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // senza 0/O/I/1
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function defaultRestaurantNames() {
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

function ensureArraySize(arr, size, fallbackFn) {
  const out = Array.isArray(arr) ? [...arr] : [];
  while (out.length < size) out.push(fallbackFn(out.length));
  return out.slice(0, size);
}

function sumVote(v) {
  return (v?.cibo || 0) + (v?.servizio || 0) + (v?.location || 0) + (v?.conto || 0) + (v?.bonusApplied ? 5 : 0);
}

/* =========================
   SFX + Music (safe)
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
      // browser può bloccare audio senza gesture: ok
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
    if (enabled) {
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  }, [enabled]);

  return null;
}

/* =========================
   Modes
========================= */
const MODES = {
  CLASSICA: {
    key: "CLASSICA",
    title: "CLASSICA",
    subtitle: "Come lo show TV: 4×4 fissi",
    desc: "4 partecipanti • 4 ristoranti • voti completi",
  },
  PERSONALIZZATA: {
    key: "PERSONALIZZATA",
    title: "PERSONALIZZATA",
    subtitle: "Fai tu le regole",
    desc: "2–8 partecipanti • 2–8 ristoranti • totale libertà",
  },
  ONE_SHOT: {
    key: "ONE_SHOT",
    title: "ONE SHOT",
    subtitle: "Una sola bettola, tutti giudici",
    desc: "2–8 partecipanti • 1 ristorante • un giro secco",
  },
};

/* =========================
   Firestore helpers
========================= */
function matchRef(code) {
  return doc(db, "matches", code);
}

async function createNewMatch({ user, mode }) {
  const code = genCode(6);

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

  const restaurantNames = ensureArraySize(
    defaultRestaurantNames(),
    restaurantsCount,
    (i) => `Ristorante ${i + 1}`
  );

  const participantNames = ensureArraySize(
    defaultPlayerNames(),
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

  await setDoc(matchRef(code), payload);
  localStorage.setItem(LS_LAST_CODE, code);
  return code;
}

async function updateMatch(code, partial) {
  await updateDoc(matchRef(code), { ...partial, updatedAt: serverTimestamp() });
}

/* =========================
   UI components
========================= */
function Pill({ children }) {
  return <span className="pill">{children}</span>;
}

function Card({ title, subtitle, desc, onClick }) {
  return (
    <button className="card" type="button" onClick={onClick}>
      <div className="cardTop">
        <div className="cardTitle">{title}</div>
        <div className="cardSubtitle">{subtitle}</div>
      </div>
      <div className="cardDesc">{desc}</div>
    </button>
  );
}

function Slider({ label, value, onChange }) {
  return (
    <div className="sliderRow">
      <div className="sliderLabel">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <input
        className="slider"
        type="range"
        min="0"
        max="10"
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
   Main App
========================= */
export default function App() {
  const { play } = useSfx();

  // Auth
  const [user, setUser] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const provider = useMemo(() => {
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    return p;
  }, []);

  // App state
  const [screen, setScreen] = useState("home"); // home | mode | setup | vote | reveal | ranking
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);

  // Match
  const [code, setCode] = useState(localStorage.getItem(LS_LAST_CODE) || "");
  const [match, setMatch] = useState(null);
  const [musicOn, setMusicOn] = useState(false);

  // Reveal UI only (local)
  const [revealStep, setRevealStep] = useState(0);
  const [revealRunning, setRevealRunning] = useState(false);

  // ========= AUTH EFFECT
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u || null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // ========= MATCH SUBSCRIBE
  useEffect(() => {
    if (!user || !code) return;

    const ref = matchRef(code);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setToast("Partita non trovata. Controlla il codice.");
          setMatch(null);
          return;
        }
        const data = snap.data();
        setMatch(data);

        // musica
        const musicEnabled = !!data?.settings?.musicEnabled;
        setMusicOn(musicEnabled);
      },
      (err) => {
        console.error("Firestore onSnapshot error:", err);
        setToast("Errore Firestore: permessi o connessione.");
      }
    );

    return () => unsub();
  }, [user, code]);

  // ========= AUTO CLEAR TOAST
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // ========= derived helpers
  const settings = match?.settings;
  const state = match?.state;

  const participantsCount = settings?.participantsCount || 0;
  const restaurantsCount = settings?.restaurantsCount || 0;
  const mode = settings?.mode || "PERSONALIZZATA";

  const participantNames = ensureArraySize(
    settings?.participantNames || [],
    participantsCount,
    (i) => `Giocatore ${i + 1}`
  );

  const restaurantNames = ensureArraySize(
    settings?.restaurantNames || [],
    restaurantsCount,
    (i) => `Ristorante ${i + 1}`
  );

  // Voting cursor
  const pIndex = state?.pIndex || 0;
  const rIndex = state?.rIndex || 0;

  const currentPlayer = participantNames[pIndex] || `Giocatore ${pIndex + 1}`;
  const currentRestaurant = restaurantNames[rIndex] || `Ristorante ${rIndex + 1}`;

  const bonusEnabled = !!settings?.bonusEnabled;

  const bonusUsedByP = state?.bonusUsedByP || {};
  const votesByP = state?.votesByP || {};

  // ========= ranking compute
  const ranking = useMemo(() => {
    if (!match) return [];

    const totals = Array(restaurantsCount).fill(0);

    for (let pi = 0; pi < participantsCount; pi++) {
      const pk = `p${pi}`;
      const pvotes = votesByP?.[pk] || {};
      for (let ri = 0; ri < restaurantsCount; ri++) {
        const rk = `r${ri}`;
        const v = pvotes?.[rk];
        totals[ri] += sumVote(v);
      }
    }

    const list = restaurantNames.map((name, i) => ({
      name,
      score: totals[i] || 0,
    }));

    list.sort((a, b) => b.score - a.score);
    return list;
  }, [match, restaurantsCount, participantsCount, restaurantNames, votesByP]);

  // ========= actions
  async function doLogin() {
    try {
      setBusy(true);
      await signInWithPopup(auth, provider);
      play("tap.mp3", 0.5);
    } catch (e) {
      console.error(e);
      setToast("Login non riuscito. Controlla popup/cookie.");
    } finally {
      setBusy(false);
    }
  }

  async function doLogout() {
    try {
      setBusy(true);
      await signOut(auth);
      setMatch(null);
      setCode("");
      localStorage.removeItem(LS_LAST_CODE);
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
      setScreen("setup");
      setToast(`Partita creata! Codice: ${newCode}`);
    } catch (e) {
      console.error("createMatch error:", e);
      setToast("Errore creando la partita (Firestore/permessi).");
    } finally {
      setBusy(false);
    }
  }

  async function resumeLastMatch() {
    if (!user) return;
    const last = localStorage.getItem(LS_LAST_CODE);
    if (!last) return setToast("Nessuna partita salvata.");
    setCode(last);
    setScreen("home");
    setToast("Ripresa partita…");
  }

  async function joinByCode(input) {
    const c = (input || "").trim().toUpperCase();
    if (!c) return;

    try {
      setBusy(true);
      const snap = await getDoc(matchRef(c));
      if (!snap.exists()) {
        setToast("Codice non valido (partita non trovata).");
        return;
      }
      localStorage.setItem(LS_LAST_CODE, c);
      setCode(c);
      setToast("Partita caricata!");
      // vai su home: l'utente decide se riprendere / votare
      setScreen("home");
    } catch (e) {
      console.error(e);
      setToast("Errore nel caricamento partita.");
    } finally {
      setBusy(false);
    }
  }

  async function saveSetup(nextSettings) {
    if (!code) return;
    try {
      await updateMatch(code, { settings: nextSettings });
    } catch (e) {
      console.error(e);
      setToast("Errore nel salvataggio setup.");
    }
  }

  async function goVoting() {
    if (!code || !match) return;
    try {
      play("confirm.mp3", 0.7);

      await updateMatch(code, {
        state: {
          ...match.state,
          phase: "voting",
          pIndex: 0,
          rIndex: 0,
        },
      });

      setScreen("vote");
    } catch (e) {
      console.error(e);
      setToast("Non riesco ad avviare la cena.");
    }
  }

  async function submitVote(vote) {
    if (!match || !code) return;

    const m = match;
    const s = m.settings;
    const st = m.state;

    const modeNow = s.mode;
    const pc = s.participantsCount;
    const rc = s.restaurantsCount;

    const nextVotesByP = { ...(st.votesByP || {}) };
    const pk = `p${st.pIndex}`;
    const rk = `r${st.rIndex}`;

    if (!nextVotesByP[pk]) nextVotesByP[pk] = {};
    nextVotesByP[pk][rk] = vote;

    const nextBonusUsedByP = { ...(st.bonusUsedByP || {}) };
    if (vote.bonusApplied) nextBonusUsedByP[pk] = true;

    // calcola prossimo passo
    let nextP = st.pIndex;
    let nextR = st.rIndex;

    if (modeNow === "ONE_SHOT") {
      // 1 ristorante: avanzano solo i giocatori
      nextP = st.pIndex + 1;
      nextR = 0;
    } else {
      // tutti votano tutti i ristoranti
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
      phase: finished ? "reveal" : st.phase,
      finishedAt: finished ? serverTimestamp() : st.finishedAt || null,
    };

    try {
      play("tap.mp3", 0.45);
      await updateMatch(code, { state: nextState });

      if (finished) {
        setScreen("reveal");
      }
    } catch (e) {
      console.error(e);
      setToast("Errore salvando il voto.");
    }
  }

  async function resetToHome() {
    play("tap.mp3", 0.5);
    setRevealStep(0);
    setRevealRunning(false);
    setScreen("home");
  }

  async function resetMatchProgress() {
    if (!match || !code) return;
    try {
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
      setScreen("setup");
      setToast("Partita resettata.");
    } catch (e) {
      console.error(e);
      setToast("Errore nel reset partita.");
    }
  }

  function canStartDinner() {
    if (!settings) return false;
    const rn = (settings.restaurantNames || []).slice(0, settings.restaurantsCount);
    const pn = (settings.participantNames || []).slice(0, settings.participantsCount);

    const okR = rn.every((x) => (x || "").trim().length >= 1);
    const okP = pn.every((x) => (x || "").trim().length >= 1);
    return okR && okP;
  }

  // ========= screen auto from match
  useEffect(() => {
    if (!match) return;
    const ph = match?.state?.phase;
    if (!ph) return;

    if (ph === "setup") setScreen("setup");
    if (ph === "voting") setScreen("vote");
    if (ph === "reveal") setScreen("reveal");
    if (ph === "ranking") setScreen("ranking");
  }, [match]);

  // ========= reveal logic (local only)
  useEffect(() => {
    if (screen !== "reveal") return;
    setRevealStep(0);
    setRevealRunning(false);
  }, [screen]);

  async function startReveal() {
    if (revealRunning) return;
    setRevealRunning(true);
    await play("drumroll.mp3", 0.55);

    // reveal a tappe
    setRevealStep(1);
    setTimeout(() => setRevealStep(2), 900);
    setTimeout(() => setRevealStep(3), 1800);
    setTimeout(() => setRevealStep(4), 2700);

    // dopo un attimo vai in ranking “definitivo”
    setTimeout(async () => {
      try {
        await updateMatch(code, { state: { ...match.state, phase: "ranking" } });
        setScreen("ranking");
        play("winners.mp3", 0.65);
      } catch {
        setScreen("ranking");
      }
    }, 3500);
  }

  // ========= Render
  const [joinInput, setJoinInput] = useState("");

  if (!authReady) {
    return (
      <div className="app">
        <div className="shell">
          <div className="brand">
            <div className="logo">🍴</div>
            <div>
              <div className="title">{APP_NAME}</div>
              <div className="sub">Caricamento…</div>
            </div>
          </div>
          <div className="panel center">
            <div className="spinner" />
            <div className="muted">Accendiamo le luci in studio.</div>
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
                <p className="muted">
                  Per salvare partite e storico serve l’accesso Google.
                </p>
                <button className="btn big" onClick={doLogin} disabled={busy}>
                  Accedi con Google
                </button>
              </div>
            ) : (
              <>
                <div className="hero">
                  <h2 className="h2">Pronti a giudicare? 🍝</h2>
                  <p className="muted">
                    Modalità TV, setup libero o one-shot: scegli e… spadella.
                  </p>
                </div>

                <div className="grid2">
                  <button className="btn big" onClick={() => setScreen("mode")} disabled={busy}>
                    Inizia una partita
                  </button>

                  <button className="btn big ghost" onClick={resumeLastMatch} disabled={!localStorage.getItem(LS_LAST_CODE)}>
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
                  <button className="btn" onClick={() => joinByCode(joinInput)} disabled={busy}>
                    Entra
                  </button>
                </div>

                {match ? (
                  <div className="miniCard">
                    <div className="miniRow">
                      <div>
                        <div className="miniTitle">Partita caricata</div>
                        <div className="muted">
                          Modalità: <strong>{mode}</strong> • {participantsCount} partecipanti • {restaurantsCount} ristoranti
                        </div>
                      </div>
                      <div className="miniActions">
                        <button className="btn" onClick={() => setScreen("setup")}>
                          Vai al setup
                        </button>
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </main>
        )}

        {/* MODE PICKER */}
        {screen === "mode" && (
          <main className="panel">
            <div className="hero">
              <h2 className="h2">Scegli la modalità</h2>
              <p className="muted">Tre sapori. Uno solo vincitore.</p>
            </div>

            <div className="modeGrid">
              <Card
                title="CLASSICA"
                subtitle={MODES.CLASSICA.subtitle}
                desc={MODES.CLASSICA.desc}
                onClick={() => startNewMatch("CLASSICA")}
              />
              <Card
                title="PERSONALIZZATA"
                subtitle={MODES.PERSONALIZZATA.subtitle}
                desc={MODES.PERSONALIZZATA.desc}
                onClick={() => startNewMatch("PERSONALIZZATA")}
              />
              <Card
                title="ONE SHOT"
                subtitle={MODES.ONE_SHOT.subtitle}
                desc={MODES.ONE_SHOT.desc}
                onClick={() => startNewMatch("ONE_SHOT")}
              />
            </div>

            <div className="footerRow">
              <button className="btn ghost" onClick={() => setScreen("home")}>
                Indietro
              </button>
            </div>
          </main>
        )}

        {/* SETUP */}
        {screen === "setup" && match && (
          <main className="panel scroll">
            <div className="hero">
              <h2 className="h2">Setup partita</h2>
              <p className="muted">
                Codice partita: <strong>{code}</strong>{" "}
                <button
                  className="linkBtn"
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(code);
                    setToast("Codice copiato negli appunti.");
                    play("tap.mp3", 0.4);
                  }}
                >
                  Copia
                </button>
              </p>
            </div>

            <div className="chips">
              <Pill>Modalità: {mode}</Pill>
              <Pill>Host: {match.ownerName}</Pill>
            </div>

            <div className="setupGrid">
              {/* CONTATORI */}
              <div className="box">
                <div className="boxTitle">Numeri</div>
                <div className="muted small">
                  CLASSICA è fissa (4×4). ONE SHOT è 1 ristorante.
                </div>

                {mode === "PERSONALIZZATA" ? (
                  <>
                    <div className="field">
                      <label className="label">Partecipanti: {participantsCount}</label>
                      <input
                        className="slider"
                        type="range"
                        min="2"
                        max="8"
                        value={participantsCount}
                        onChange={async (e) => {
                          const v = clamp(Number(e.target.value), 2, 8);
                          const next = {
                            ...settings,
                            participantsCount: v,
                            participantNames: ensureArraySize(
                              settings.participantNames,
                              v,
                              (i) => defaultPlayerNames()[i] || `Giocatore ${i + 1}`
                            ),
                          };
                          await saveSetup(next);
                        }}
                      />
                    </div>

                    <div className="field">
                      <label className="label">Ristoranti: {restaurantsCount}</label>
                      <input
                        className="slider"
                        type="range"
                        min="2"
                        max="8"
                        value={restaurantsCount}
                        onChange={async (e) => {
                          const v = clamp(Number(e.target.value), 2, 8);
                          const next = {
                            ...settings,
                            restaurantsCount: v,
                            restaurantNames: ensureArraySize(
                              settings.restaurantNames,
                              v,
                              (i) => defaultRestaurantNames()[i] || `Ristorante ${i + 1}`
                            ),
                          };
                          await saveSetup(next);
                        }}
                      />
                    </div>
                  </>
                ) : mode === "ONE_SHOT" ? (
                  <>
                    <div className="field">
                      <label className="label">Partecipanti: {participantsCount}</label>
                      <input
                        className="slider"
                        type="range"
                        min="2"
                        max="8"
                        value={participantsCount}
                        onChange={async (e) => {
                          const v = clamp(Number(e.target.value), 2, 8);
                          const next = {
                            ...settings,
                            participantsCount: v,
                            restaurantsCount: 1,
                            participantNames: ensureArraySize(
                              settings.participantNames,
                              v,
                              (i) => defaultPlayerNames()[i] || `Giocatore ${i + 1}`
                            ),
                            restaurantNames: ensureArraySize(
                              settings.restaurantNames,
                              1,
                              () => settings.restaurantNames?.[0] || "Ristorante del Giorno",
                            ),
                          };
                          await saveSetup(next);
                        }}
                      />
                    </div>

                    <div className="muted small">Ristoranti: <strong>1</strong></div>
                  </>
                ) : (
                  <>
                    <div className="muted small">Partecipanti: <strong>4</strong></div>
                    <div className="muted small">Ristoranti: <strong>4</strong></div>
                  </>
                )}
              </div>

              {/* OPZIONI */}
              <div className="box">
                <div className="boxTitle">Opzioni</div>

                <label className="checkRow">
                  <input
                    type="checkbox"
                    checked={!!settings.bonusEnabled}
                    onChange={async (e) => {
                      await saveSetup({ ...settings, bonusEnabled: e.target.checked });
                    }}
                  />
                  Bonus speciale +5 (1 volta per partecipante)
                </label>

                <label className="checkRow">
                  <input
                    type="checkbox"
                    checked={!!settings.musicEnabled}
                    onChange={async (e) => {
                      await saveSetup({ ...settings, musicEnabled: e.target.checked });
                    }}
                  />
                  Musica in sottofondo
                </label>

                <div className="muted small">
                  Se la musica non parte, fai un click qualsiasi e poi attivala (alcuni browser richiedono “gesture”).
                </div>
              </div>

              {/* NOMI RISTORANTI */}
              <div className="box wide">
                <div className="boxTitle">
                  Nomi ristoranti{" "}
                  <span className="muted small">
                    ({restaurantsCount})
                  </span>
                </div>

                <div className="nameGrid">
                  {restaurantNames.map((val, i) => (
                    <div key={i} className="field">
                      <label className="label">Ristorante {i + 1}</label>
                      <input
                        className="input"
                        value={val}
                        onChange={async (e) => {
                          const nextArr = [...restaurantNames];
                          nextArr[i] = e.target.value;
                          const next = { ...settings, restaurantNames: nextArr };
                          await saveSetup(next);
                        }}
                        placeholder={`Ristorante ${i + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* NOMI PARTECIPANTI */}
              <div className="box wide">
                <div className="boxTitle">
                  Nomi partecipanti{" "}
                  <span className="muted small">
                    ({participantsCount})
                  </span>
                </div>

                <div className="nameGrid">
                  {participantNames.map((val, i) => (
                    <div key={i} className="field">
                      <label className="label">Partecipante {i + 1}</label>
                      <input
                        className="input"
                        value={val}
                        onChange={async (e) => {
                          const nextArr = [...participantNames];
                          nextArr[i] = e.target.value;
                          const next = { ...settings, participantNames: nextArr };
                          await saveSetup(next);
                        }}
                        placeholder={`Giocatore ${i + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="footerRow sticky">
              <button className="btn ghost" onClick={() => setScreen("home")}>
                Home
              </button>

              <button
                className="btn danger ghost"
                onClick={resetMatchProgress}
                title="Resetta voti e riparti dal setup"
              >
                Reset partita
              </button>

              <button
                className="btn big"
                onClick={goVoting}
                disabled={!canStartDinner()}
                title={!canStartDinner() ? "Inserisci tutti i nomi prima di iniziare" : ""}
              >
                Avvia la cena 🍷
              </button>
            </div>
          </main>
        )}

        {/* VOTE */}
        {screen === "vote" && match && (
          <main className="panel">
            <div className="hero">
              <h2 className="h2">Si vota!</h2>
              <p className="muted">
                <strong>{currentPlayer}</strong>{" "}
                {mode === "ONE_SHOT" ? (
                  <>
                    giudica <strong>{restaurantNames[0]}</strong>
                  </>
                ) : (
                  <>
                    giudica <strong>{currentRestaurant}</strong>
                  </>
                )}
              </p>
              <div className="chips">
                <Pill>
                  Giocatore {pIndex + 1}/{participantsCount}
                </Pill>
                <Pill>
                  {mode === "ONE_SHOT"
                    ? "Ristorante 1/1"
                    : `Ristorante ${rIndex + 1}/${restaurantsCount}`}
                </Pill>
              </div>
            </div>

            <VotePanel
              bonusEnabled={bonusEnabled}
              bonusAlreadyUsed={!!bonusUsedByP[`p${pIndex}`]}
              onConfirm={(vote) => submitVote(vote)}
              sfxPlay={play}
            />

            <div className="footerRow">
              <button className="btn ghost" onClick={() => setScreen("setup")}>
                Torna al setup
              </button>
            </div>
          </main>
        )}

        {/* REVEAL */}
        {screen === "reveal" && match && (
          <main className="panel">
            <div className="hero">
              <h2 className="h2">Luci studio. Silenzio…</h2>
              <p className="muted">È il momento della classifica.</p>
            </div>

            <div className="revealBox">
              <div className={`revealLine ${revealStep >= 1 ? "on" : ""}`}>🎥 Camera 1: “Facce serie”</div>
              <div className={`revealLine ${revealStep >= 2 ? "on" : ""}`}>🥁 Rullo di tamburi…</div>
              <div className={`revealLine ${revealStep >= 3 ? "on" : ""}`}>💡 Luci: a palla</div>
              <div className={`revealLine ${revealStep >= 4 ? "on" : ""}`}>🏆 E adesso…</div>
            </div>

            <div className="footerRow">
              <button className="btn ghost" onClick={resetToHome}>
                Home
              </button>
              <button className="btn big" onClick={startReveal} disabled={revealRunning}>
                Svela la classifica
              </button>
            </div>
          </main>
        )}

        {/* RANKING */}
        {screen === "ranking" && match && (
          <main className="panel">
            <div className="hero">
              <h2 className="h2">🏆 Classifica finale</h2>
              <p className="muted">Screenshot pronta 📸 (e poi… si paga il conto).</p>
            </div>

            <div className="ranking">
              {ranking.map((r, i) => (
                <div key={i} className={`rankItem ${i === 0 ? "winner" : ""}`}>
                  <div className="rankLeft">
                    <div className="rankPos">{i + 1}</div>
                    <div className="rankName">{r.name}</div>
                  </div>
                  <div className="rankScore">{r.score}</div>
                </div>
              ))}
            </div>

            <div className="footerRow">
              <button className="btn ghost" onClick={resetToHome}>
                Home
              </button>
              <button className="btn" onClick={resetMatchProgress}>
                Nuova partita (stesso codice)
              </button>
            </div>
          </main>
        )}

        <footer className="footnote">
          <span className="muted small">
            Tip: se incognito “rimbalza”, è quasi sempre cookie/terze parti bloccati.
          </span>
        </footer>
      </div>
    </div>
  );
}

/* =========================
   VotePanel
========================= */
function VotePanel({ bonusEnabled, bonusAlreadyUsed, onConfirm, sfxPlay }) {
  const [cibo, setCibo] = useState(6);
  const [servizio, setServizio] = useState(6);
  const [location, setLocation] = useState(6);
  const [conto, setConto] = useState(6);
  const [useBonus, setUseBonus] = useState(false);

  const base = cibo + servizio + location + conto;
  const total = base + (useBonus ? 5 : 0);

  useEffect(() => {
    // reset bonus toggle if already used
    if (bonusAlreadyUsed) setUseBonus(false);
  }, [bonusAlreadyUsed]);

  const canUseBonus = bonusEnabled && !bonusAlreadyUsed;

  return (
    <div className="voteBox">
      <div className="voteGrid">
        <Slider label="🍝 Cibo" value={cibo} onChange={(v) => setCibo(v)} />
        <Slider label="🛎️ Servizio" value={servizio} onChange={(v) => setServizio(v)} />
        <Slider label="🏠 Location" value={location} onChange={(v) => setLocation(v)} />
        <Slider label="💸 Conto" value={conto} onChange={(v) => setConto(v)} />
      </div>

      <div className="voteBottom">
        <div className="totals">
          <div className="totLine">
            <span>Totale</span>
            <strong>{total}</strong>
          </div>
          <div className="muted small">
            Base {base}/40 {useBonus ? " + bonus" : ""}
          </div>
        </div>

        <div className="bonusBlock">
          {bonusEnabled ? (
            <label className={`bonusToggle ${canUseBonus ? "" : "disabled"}`}>
              <input
                type="checkbox"
                checked={useBonus}
                onChange={(e) => {
                  if (!canUseBonus) return;
                  setUseBonus(e.target.checked);
                  sfxPlay("tap.mp3", 0.45);
                }}
                disabled={!canUseBonus}
              />
              Applica Bonus +5{" "}
              {!canUseBonus ? <span className="muted small">(già usato)</span> : null}
            </label>
          ) : (
            <div className="muted small">Bonus disattivato dal setup</div>
          )}
        </div>

        <button
          className="btn big"
          type="button"
          onClick={() => {
            sfxPlay("confirm.mp3", 0.7);
            onConfirm({
              cibo,
              servizio,
              location,
              conto,
              bonusApplied: !!useBonus && canUseBonus,
              createdAt: nowISO(),
            });

            // reset sliders for next vote
            setCibo(6);
            setServizio(6);
            setLocation(6);
            setConto(6);
            setUseBonus(false);
          }}
        >
          Conferma voto ✅
        </button>
      </div>
    </div>
  );
}
