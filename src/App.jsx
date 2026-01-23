import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { auth, db } from "./firebase";

import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "firebase/auth";

import {
  collection,
  addDoc,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  updateDoc,
  serverTimestamp,
  where,
} from "firebase/firestore";

/* =========================
   Utils
========================= */
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const nowIso = () => new Date().toISOString();
const uid8 = () => Math.random().toString(16).slice(2, 10);

const DEFAULT_RESTAURANTS = [
  "La Bottega",
  "Trattoria Roma",
  "Osteria Bella",
  "Spadella d'Oro",
  "La Brace",
  "Il Tegame",
  "Forchetta & Co",
  "Sugo Supremo",
];

const DEFAULT_PLAYERS = [
  "Giocatore 1",
  "Giocatore 2",
  "Giocatore 3",
  "Giocatore 4",
  "Giocatore 5",
  "Giocatore 6",
  "Giocatore 7",
  "Giocatore 8",
];

/* =========================
   Audio (safe)
========================= */
async function headOk(url) {
  try {
    const r = await fetch(url, { method: "HEAD", cache: "no-store" });
    return r.ok;
  } catch {
    return false;
  }
}

function useAudioFX() {
  const cacheRef = useRef(new Map());

  const play = async (file, volume = 0.7) => {
    const url = `/audio/${file}`;
    if (!cacheRef.current.has(url)) {
      cacheRef.current.set(url, await headOk(url));
    }
    if (!cacheRef.current.get(url)) return;

    try {
      const a = new Audio(url);
      a.volume = volume;
      await a.play();
    } catch {
      // ignoriamo (autoplay / gesture / ecc.)
    }
  };

  return { play };
}

function MusicPlayer({ enabled }) {
  const audioRef = useRef(null);

  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/audio/background.mp3");
      audioRef.current.loop = true;
      audioRef.current.volume = 0.35;
    }
    const a = audioRef.current;
    if (!a) return;

    if (enabled) {
      a.play().catch(() => {});
    } else {
      a.pause();
    }
  }, [enabled]);

  return null;
}

/* =========================
   Studio Overlay
========================= */
function StudioLights({ enabled }) {
  if (!enabled) return null;
  return (
    <div className="studio">
      <div className="beam b1" />
      <div className="beam b2" />
      <div className="beam b3" />
      <div className="grain" />
    </div>
  );
}

/* =========================
   Firestore paths
========================= */
const userDocRef = (uid) => doc(db, "users", uid);
const stateDocRef = (uid) => doc(db, "users", uid, "meta", "state");
const matchDocRef = (uid, matchId) => doc(db, "users", uid, "matches", matchId);

/* =========================
   Match helpers
========================= */
function emptyVotes(restaurants, players) {
  // votes[r][p] = { cibo, servizio, location, conto, bonus, total }
  return Array.from({ length: restaurants }, () =>
    Array.from({ length: players }, () => null)
  );
}

function computeTotals(votes, restaurantsCount, playersCount) {
  const totals = Array(restaurantsCount).fill(0);
  for (let r = 0; r < restaurantsCount; r++) {
    let sum = 0;
    for (let p = 0; p < playersCount; p++) {
      const v = votes[r][p];
      if (v?.total != null) sum += v.total;
    }
    totals[r] = sum;
  }
  return totals;
}

function computeRanking(restaurantNames, totals) {
  return restaurantNames
    .map((name, i) => ({ name, score: totals[i] || 0 }))
    .sort((a, b) => b.score - a.score);
}

/* =========================
   Reveal Ranking (TV)
========================= */
function RevealRanking({ ranking, onDone, play }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    let alive = true;

    (async () => {
      await play("drumroll.mp3", 0.6);
      const interval = setInterval(() => {
        if (!alive) return;
        setStep((s) => s + 1);
      }, 900);

      // stop after all revealed + 1
      const totalSteps = ranking.length + 1;
      const stop = setTimeout(() => {
        clearInterval(interval);
        onDone();
      }, totalSteps * 900 + 300);

      return () => {
        clearInterval(interval);
        clearTimeout(stop);
      };
    })();

    return () => {
      alive = false;
    };
  }, [ranking.length, onDone, play]);

  useEffect(() => {
    if (step === ranking.length) {
      // winner sting
      play("winners.mp3", 0.8);
    } else if (step > 0 && step < ranking.length) {
      play("tap.mp3", 0.45);
    }
  }, [step, ranking.length, play]);

  return (
    <div className="screen reveal">
      <h2 className="title">🎬 Classifica in arrivo…</h2>
      <p className="muted">Silenzio in studio. Parte il reveal.</p>

      <div className="revealList">
        {ranking.map((r, i) => {
          const visible = i < step;
          const winner = i === 0 && step >= ranking.length;
          return (
            <div
              key={r.name}
              className={[
                "revealRow",
                visible ? "show" : "hide",
                winner ? "winner" : "",
              ].join(" ")}
            >
              <div className="pos">{i + 1}</div>
              <div className="name">{r.name}</div>
              <div className="score">{r.score}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* =========================
   App
========================= */
export default function App() {
  const { play } = useAudioFX();

  const [user, setUser] = useState(null);
  const [screen, setScreen] = useState("login"); // login | home | setup | vote | reveal | ranking | history
  const [loading, setLoading] = useState(true);

  const [musicOn, setMusicOn] = useState(false);

  const provider = useMemo(() => {
    const p = new GoogleAuthProvider();
    p.setCustomParameters({ prompt: "select_account" });
    return p;
  }, []);

  /* ---------- Login diagnostics (persist) ---------- */
  const DIAG_KEY = "spad_login_diag";
  const loadDiag = () => {
    try {
      return JSON.parse(sessionStorage.getItem(DIAG_KEY) || "{}");
    } catch {
      return {};
    }
  };
  const [diag, setDiag] = useState(loadDiag());

  const patchDiag = (patch) => {
    setDiag((d) => {
      const next = { ...d, ...patch };
      sessionStorage.setItem(DIAG_KEY, JSON.stringify(next));
      return next;
    });
  };

  const safeErr = (e) => {
    const code = e?.code || "";
    const msg = e?.message || String(e);
    return code ? `${code} — ${msg}` : msg;
  };

  /* ---------- Auth persistence ---------- */
  useEffect(() => {
    setPersistence(auth, browserLocalPersistence).catch(() => {});
  }, []);

  /* ---------- Redirect result check (fallback only) ---------- */
  useEffect(() => {
    (async () => {
      try {
        const res = await getRedirectResult(auth);
        if (res?.user) {
          patchDiag({ redirectResult: "✅ Redirect OK", lastAuthAt: nowIso() });
        } else {
          patchDiag({ redirectResult: "ℹ️ Nessun redirect result", lastSeenAt: nowIso() });
        }
      } catch (e) {
        patchDiag({ redirectResult: `❌ ${safeErr(e)}` });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Observe auth state ---------- */
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u || null);
      setLoading(false);

      if (!u) {
        setScreen("login");
        return;
      }

      // ensure user doc exists
      try {
        await updateDoc(userDocRef(u.uid), {
          lastLoginAt: serverTimestamp(),
          displayName: u.displayName || "",
          email: u.email || "",
        });
      } catch {
        // first time create
        try {
          await updateDoc(userDocRef(u.uid), {}); // noop
        } catch {
          // fallback: setDoc but keep minimal without importing setDoc
          // (we can do updateDoc only if doc exists; so we create via match write later)
        }
      }

      // load active match pointer
      try {
        const st = await getDoc(stateDocRef(u.uid));
        const activeMatchId = st.exists() ? st.data()?.activeMatchId : null;
        if (activeMatchId) {
          patchDiag({ activeMatchId });
        }
      } catch {
        // ignore
      }

      setScreen("home");
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- Settings + match state ---------- */
  const [settings, setSettings] = useState({
    restaurantsCount: 4,
    participants: 4,
    bonusEnabled: true,
    musicEnabled: false,
    restaurantNames: DEFAULT_RESTAURANTS,
    playerNames: DEFAULT_PLAYERS,
  });

  const [activeMatchId, setActiveMatchId] = useState(null);

  const [match, setMatch] = useState(null);
  // match = { id, status, createdAtIso, settings, progress:{r,p}, votes, bonusUsedByPlayer:boolean[], totals, ranking }

  const restaurants = settings.restaurantNames.slice(0, settings.restaurantsCount);
  const players = settings.playerNames.slice(0, settings.participants);

  /* ---------- History ---------- */
  const [history, setHistory] = useState([]);

  const refreshHistory = async (uid) => {
    try {
      const qy = query(
        collection(db, "users", uid, "matches"),
        where("status", "==", "finished"),
        orderBy("updatedAt", "desc"),
        limit(20)
      );
      const snap = await getDocs(qy);
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setHistory(rows);
    } catch {
      setHistory([]);
    }
  };

  /* =========================
     Actions
  ========================= */
  const doLogin = async () => {
    patchDiag({
      build: "vercel-auth-fix-popup-001",
      origin: window.location.origin,
      userAgent: navigator.userAgent,
      loginStart: nowIso(),
      popupResult: "⏳ Popup in corso…",
      clickError: "",
      mode: "popup",
    });

    try {
      const cred = await signInWithPopup(auth, provider);
      patchDiag({
        popupResult: `✅ Popup OK (${cred?.user?.email || "utente"})`,
        lastAuthAt: nowIso(),
      });
      play("tap.mp3", 0.5);
      // onAuthStateChanged farà il resto
    } catch (e) {
      const msg = safeErr(e);
      patchDiag({ popupResult: `❌ ${msg}`, clickError: msg });

      // fallback: se popup bloccato, proviamo redirect (ma su Vercel può fallire)
      const code = e?.code || "";
      if (code.includes("popup-blocked") || code.includes("popup-closed")) {
        patchDiag({ mode: "redirect", popupResult: "⚠️ Popup bloccato → provo redirect…" });
        try {
          await signInWithRedirect(auth, provider);
        } catch (e2) {
          patchDiag({ clickError: safeErr(e2) });
        }
      }
    }
  };

  const doLogout = async () => {
    try {
      await signOut(auth);
      setMatch(null);
      setActiveMatchId(null);
      setMusicOn(false);
      patchDiag({ activeMatchId: null });
    } catch {}
  };

  const createNewMatch = async () => {
    if (!user) return;

    const cleanedRestaurants = settings.restaurantNames
      .slice(0, settings.restaurantsCount)
      .map((s, i) => (s || "").trim() || `Ristorante ${i + 1}`);

    const cleanedPlayers = settings.playerNames
      .slice(0, settings.participants)
      .map((s, i) => (s || "").trim() || `Giocatore ${i + 1}`);

    const payload = {
      status: "active",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      createdAtIso: nowIso(),
      settings: {
        restaurantsCount: settings.restaurantsCount,
        participants: settings.participants,
        bonusEnabled: settings.bonusEnabled,
        musicEnabled: settings.musicEnabled,
        restaurantNames: cleanedRestaurants,
        playerNames: cleanedPlayers,
      },
      progress: { r: 0, p: 0 },
      votes: emptyVotes(settings.restaurantsCount, settings.participants),
      bonusUsedByPlayer: Array(settings.participants).fill(false),
      totals: Array(settings.restaurantsCount).fill(0),
    };

    const docRef = await addDoc(collection(db, "users", user.uid, "matches"), payload);

    setActiveMatchId(docRef.id);
    await updateDoc(stateDocRef(user.uid), { activeMatchId: docRef.id, updatedAt: serverTimestamp() }).catch(async () => {
      // create meta/state if missing
      // fallback: write via updateDoc might fail; we can set with updateDoc in next saves
    });

    setMatch({
      id: docRef.id,
      ...payload,
    });

    setMusicOn(!!settings.musicEnabled);
    setScreen("vote");
    play("tap.mp3", 0.45);
  };

  const loadActiveMatch = async () => {
    if (!user) return;

    // read pointer
    const st = await getDoc(stateDocRef(user.uid));
    const id = st.exists() ? st.data()?.activeMatchId : null;
    if (!id) return;

    const m = await getDoc(matchDocRef(user.uid, id));
    if (!m.exists()) return;

    const data = m.data();

    setSettings((s) => ({
      ...s,
      restaurantsCount: data.settings?.restaurantsCount ?? s.restaurantsCount,
      participants: data.settings?.participants ?? s.participants,
      bonusEnabled: data.settings?.bonusEnabled ?? s.bonusEnabled,
      musicEnabled: data.settings?.musicEnabled ?? s.musicEnabled,
      restaurantNames: data.settings?.restaurantNames ?? s.restaurantNames,
      playerNames: data.settings?.playerNames ?? s.playerNames,
    }));

    setActiveMatchId(id);
    setMatch({ id, ...data });
    setMusicOn(!!data.settings?.musicEnabled);
    setScreen("vote");
    play("tap.mp3", 0.45);
  };

  const saveMatchState = async (next) => {
    if (!user || !next?.id) return;
    try {
      await updateDoc(matchDocRef(user.uid, next.id), {
        ...next,
        updatedAt: serverTimestamp(),
      });
      await updateDoc(stateDocRef(user.uid), { activeMatchId: next.status === "active" ? next.id : null, updatedAt: serverTimestamp() }).catch(() => {});
    } catch {
      // offline / rules -> ignore
    }
  };

  const submitVote = async ({ cibo, servizio, location, conto, useBonus }) => {
    if (!match) return;

    const restaurantsCount = match.settings?.restaurantsCount ?? settings.restaurantsCount;
    const participants = match.settings?.participants ?? settings.participants;

    const r = match.progress.r;
    const p = match.progress.p;

    const base = clamp(cibo, 0, 10) + clamp(servizio, 0, 10) + clamp(location, 0, 10) + clamp(conto, 0, 10);

    const bonusAvailable = !!match.settings?.bonusEnabled;
    const alreadyUsed = !!match.bonusUsedByPlayer?.[p];
    const bonusApplied = bonusAvailable && useBonus && !alreadyUsed;
    const total = base + (bonusApplied ? 5 : 0);

    const votes = match.votes ? [...match.votes] : emptyVotes(restaurantsCount, participants);
    const row = votes[r] ? [...votes[r]] : Array(participants).fill(null);
    row[p] = { cibo, servizio, location, conto, bonus: bonusApplied, total };
    votes[r] = row;

    const bonusUsedByPlayer = [...(match.bonusUsedByPlayer || Array(participants).fill(false))];
    if (bonusApplied) bonusUsedByPlayer[p] = true;

    // next progress
    let nr = r;
    let np = p + 1;
    if (np >= participants) {
      np = 0;
      nr = r + 1;
    }

    const done = nr >= restaurantsCount;
    const totals = computeTotals(votes, restaurantsCount, participants);
    const restaurantNames = match.settings?.restaurantNames ?? restaurants;
    const ranking = computeRanking(restaurantNames, totals);

    const next = {
      ...match,
      votes,
      bonusUsedByPlayer,
      totals,
      progress: done ? { r: restaurantsCount - 1, p: participants - 1 } : { r: nr, p: np },
      status: done ? "finished" : "active",
      ranking: done ? ranking : undefined,
      winner: done ? ranking?.[0]?.name : undefined,
      finishedAtIso: done ? nowIso() : undefined,
    };

    setMatch(next);
    await saveMatchState(next);

    if (done) {
      // clear active pointer
      try {
        await updateDoc(stateDocRef(user.uid), { activeMatchId: null, updatedAt: serverTimestamp() });
      } catch {}

      setScreen("reveal");
      play("confirm.mp3", 0.6);
      await refreshHistory(user.uid);
      return;
    }

    play("confirm.mp3", 0.55);
  };

  /* =========================
     UI Components
  ========================= */
  const LoginScreen = () => (
    <div className="screen login">
      <div className="hero">
        <div className="badge">Party Game • Tavolata Edition</div>
        <h1 className="logo">🍳 4 Spadellate</h1>
        <p className="subtitle">
          Votate <b>tutti</b> <b>tutti</b> i ristoranti. Bonus, musica e reveal finale “studio TV”.
        </p>

        <button className="btn primary" type="button" onClick={doLogin}>
          Accedi con Google
        </button>

        <div className="card diag">
          <div className="cardTitle">🧪 Diagnostica login</div>
          <div className="mono">
            BUILD: {diag.build || "—"}
            <br />
            Mode: {diag.mode || "popup"}
            <br />
            Origin: {window.location.origin}
            <br />
            UserAgent: {navigator.userAgent}
            <br />
            login-start: {diag.loginStart || "—"}
            <br />
            Popup result: {diag.popupResult || "—"}
            <br />
            Redirect result: {diag.redirectResult || "—"}
            <br />
            Click error: {diag.clickError || "—"}
          </div>
        </div>

        <p className="tiny muted">
          Nota: su Vercel il redirect può fallire. Qui usiamo <b>popup</b> come modalità principale.
        </p>
      </div>
    </div>
  );

  const HomeScreen = () => (
    <div className="screen home">
      <div className="topbar">
        <div className="who">
          <div className="avatar">{(user?.displayName || "U")[0]?.toUpperCase()}</div>
          <div>
            <div className="whoName">{user?.displayName || "Utente"}</div>
            <div className="whoMail">{user?.email || ""}</div>
          </div>
        </div>

        <div className="topbarActions">
          <button className="btn ghost" onClick={() => setScreen("history")}>
            Storico
          </button>
          <button className="btn danger" onClick={doLogout}>
            Esci
          </button>
        </div>
      </div>

      <div className="card big">
        <div className="cardTitle">🎛️ Pronti a spadellare?</div>
        <p className="muted">Crea una nuova partita o riprendi quella salvata.</p>

        <div className="grid2">
          <button className="btn primary" onClick={() => setScreen("setup")}>
            Inizia partita
          </button>

          <button
            className="btn"
            onClick={loadActiveMatch}
            disabled={!diag.activeMatchId && !activeMatchId}
            title={!diag.activeMatchId && !activeMatchId ? "Nessuna partita attiva salvata" : ""}
          >
            Riprendi partita
          </button>
        </div>
      </div>

      <div className="card">
        <div className="cardTitle">📌 Tip da studio</div>
        <ul className="list">
          <li>Fate votare in ordine: nessuno barando col vicino 👀</li>
          <li>Il bonus +5 è “la mazzata”: usalo una volta sola.</li>
          <li>Alla fine: reveal e screenshot della classifica 📸</li>
        </ul>
      </div>
    </div>
  );

  const SetupScreen = () => (
    <div className="screen setup">
      <div className="headerRow">
        <h2 className="title">Setup partita</h2>
        <button className="btn ghost" onClick={() => setScreen("home")}>
          ← Indietro
        </button>
      </div>

      <div className="card">
        <div className="cardTitle">Parametri</div>

        <div className="row">
          <div className="label">Ristoranti</div>
          <div className="pill">{settings.restaurantsCount}</div>
        </div>
        <input
          className="range"
          type="range"
          min="4"
          max="8"
          value={settings.restaurantsCount}
          onChange={(e) =>
            setSettings((s) => ({ ...s, restaurantsCount: Number(e.target.value) }))
          }
        />

        <div className="row">
          <div className="label">Partecipanti</div>
          <div className="pill">{settings.participants}</div>
        </div>
        <input
          className="range"
          type="range"
          min="4"
          max="8"
          value={settings.participants}
          onChange={(e) =>
            setSettings((s) => ({ ...s, participants: Number(e.target.value) }))
          }
        />

        <div className="grid2 mt">
          <label className="check">
            <input
              type="checkbox"
              checked={settings.bonusEnabled}
              onChange={(e) =>
                setSettings((s) => ({ ...s, bonusEnabled: e.target.checked }))
              }
            />
            Bonus +5 (una volta per giocatore)
          </label>

          <label className="check">
            <input
              type="checkbox"
              checked={settings.musicEnabled}
              onChange={(e) =>
                setSettings((s) => ({ ...s, musicEnabled: e.target.checked }))
              }
            />
            Musica (attivabile)
          </label>
        </div>
      </div>

      <div className="card">
        <div className="cardTitle">Nomi ristoranti</div>
        <p className="muted">Inserisci i nomi reali (o inventali, tanto giudichiamo lo stesso).</p>

        {Array.from({ length: settings.restaurantsCount }).map((_, i) => (
          <input
            key={`r-${i}`}
            className="input"
            placeholder={`Ristorante ${i + 1}`}
            value={settings.restaurantNames[i] || ""}
            onChange={(e) => {
              const next = [...settings.restaurantNames];
              next[i] = e.target.value;
              setSettings((s) => ({ ...s, restaurantNames: next }));
            }}
          />
        ))}
      </div>

      <div className="card">
        <div className="cardTitle">Nomi partecipanti</div>
        <p className="muted">Così sappiamo chi sta massacrando chi 😇</p>

        {Array.from({ length: settings.participants }).map((_, i) => (
          <input
            key={`p-${i}`}
            className="input"
            placeholder={`Giocatore ${i + 1}`}
            value={settings.playerNames[i] || ""}
            onChange={(e) => {
              const next = [...settings.playerNames];
              next[i] = e.target.value;
              setSettings((s) => ({ ...s, playerNames: next }));
            }}
          />
        ))}
      </div>

      <div className="sticky">
        <button className="btn primary bigBtn" onClick={createNewMatch}>
          Avvia la cena 🍷
        </button>
      </div>
    </div>
  );

  const VoteScreen = () => {
    if (!match) return null;

    const s = match.settings;
    const restaurantsCount = s?.restaurantsCount ?? settings.restaurantsCount;
    const participants = s?.participants ?? settings.participants;

    const r = match.progress?.r ?? 0;
    const p = match.progress?.p ?? 0;

    const restaurantNames = (s?.restaurantNames ?? restaurants).slice(0, restaurantsCount);
    const playerNames = (s?.playerNames ?? players).slice(0, participants);

    const [cibo, setCibo] = useState(5);
    const [servizio, setServizio] = useState(5);
    const [location, setLocation] = useState(5);
    const [conto, setConto] = useState(5);

    const bonusAvailable = !!s?.bonusEnabled;
    const bonusUsed = !!match.bonusUsedByPlayer?.[p];
    const [useBonus, setUseBonus] = useState(false);

    useEffect(() => {
      // reset sliders when progress changes
      setCibo(5);
      setServizio(5);
      setLocation(5);
      setConto(5);
      setUseBonus(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [r, p]);

    const baseTotal = cibo + servizio + location + conto;
    const finalTotal = baseTotal + (bonusAvailable && useBonus && !bonusUsed ? 5 : 0);

    const v = match.votes?.[r]?.[p];
    const alreadyVoted = !!v;

    return (
      <div className="screen vote">
        <div className="voteHeader">
          <div className="miniBadge">
            Ristorante {r + 1}/{restaurantsCount} • Giocatore {p + 1}/{participants}
          </div>
          <h2 className="title">{restaurantNames[r]}</h2>
          <p className="muted">
            Ora vota: <b>{playerNames[p]}</b>
          </p>
        </div>

        <div className="card">
          <div className="sliders">
            <Slider label="🍝 Cibo" value={cibo} setValue={setCibo} />
            <Slider label="🛎 Servizio" value={servizio} setValue={setServizio} />
            <Slider label="🏠 Location" value={location} setValue={setLocation} />
            <Slider label="💸 Conto" value={conto} setValue={setConto} />
          </div>

          {bonusAvailable && (
            <label className={"bonusRow " + (bonusUsed ? "disabled" : "")}>
              <input
                type="checkbox"
                disabled={bonusUsed}
                checked={useBonus}
                onChange={(e) => setUseBonus(e.target.checked)}
              />
              Bonus speciale +5 {bonusUsed ? "(già usato)" : "(una volta sola)"}
            </label>
          )}

          <div className="totalRow">
            <div className="totalLabel">Totale</div>
            <div className="totalValue">{finalTotal}</div>
          </div>

          <div className="grid2 mt">
            <button
              className="btn"
              onClick={() => {
                setScreen("home");
                play("tap.mp3", 0.45);
              }}
            >
              Salva & Esci
            </button>

            <button
              className="btn primary"
              disabled={alreadyVoted}
              onClick={() => submitVote({ cibo, servizio, location, conto, useBonus })}
              title={alreadyVoted ? "Voto già registrato (prosegui col prossimo)" : ""}
            >
              {alreadyVoted ? "Voto già dato ✅" : "Conferma voto"}
            </button>
          </div>

          {alreadyVoted && (
            <p className="tiny muted mt">
              Questo voto è già registrato. Vai avanti col prossimo (se hai ricaricato la pagina, è normale).
            </p>
          )}
        </div>
      </div>
    );
  };

  const RankingScreen = () => {
    if (!match) return null;

    const s = match.settings;
    const restaurantsCount = s?.restaurantsCount ?? settings.restaurantsCount;
    const restaurantNames = (s?.restaurantNames ?? restaurants).slice(0, restaurantsCount);

    const totals = match.totals || computeTotals(match.votes || [], restaurantsCount, s?.participants ?? settings.participants);
    const ranking = match.ranking || computeRanking(restaurantNames, totals);

    return (
      <div className="screen ranking">
        <h2 className="title">🏆 Classifica finale</h2>
        <p className="muted">Screenshot pronta 📸 (e ora litigate civilmente).</p>

        <div className="rankList">
          {ranking.map((r, i) => (
            <div key={r.name} className={"rankRow " + (i === 0 ? "winner" : "")}>
              <div className="pos">{i + 1}</div>
              <div className="name">{r.name}</div>
              <div className="score">{r.score}</div>
            </div>
          ))}
        </div>

        <div className="grid2 mt">
          <button className="btn" onClick={() => setScreen("history")}>
            Vai allo storico
          </button>
          <button
            className="btn primary"
            onClick={() => {
              setMatch(null);
              setActiveMatchId(null);
              setScreen("home");
              play("tap.mp3", 0.45);
            }}
          >
            Nuova partita
          </button>
        </div>
      </div>
    );
  };

  const HistoryScreen = () => (
    <div className="screen history">
      <div className="headerRow">
        <h2 className="title">📚 Storico vincitori</h2>
        <button className="btn ghost" onClick={() => setScreen("home")}>
          ← Home
        </button>
      </div>

      <button
        className="btn"
        onClick={async () => {
          if (!user) return;
          await refreshHistory(user.uid);
          play("tap.mp3", 0.45);
        }}
      >
        Aggiorna
      </button>

      <div className="rankList mt">
        {history.length === 0 && (
          <div className="card">
            <div className="cardTitle">Nessuna partita salvata</div>
            <p className="muted">Finisci una partita e comparirà qui.</p>
          </div>
        )}

        {history.map((m) => (
          <div key={m.id} className="card">
            <div className="cardTitle">🏅 {m.winner || "Vincitore"}</div>
            <div className="tiny muted">
              {m.finishedAtIso || m.createdAtIso || "—"} • ID: {m.id}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  /* =========================
     Render
  ========================= */
  if (loading) {
    return (
      <div className="app">
        <StudioLights enabled />
        <div className="screen">
          <div className="card">
            <div className="cardTitle">Caricamento…</div>
            <p className="muted">Accendiamo le luci in studio.</p>
          </div>
        </div>
      </div>
    );
  }

  const showStudio = screen !== "login";

  // keep music player alive
  return (
    <div className="app">
      <StudioLights enabled={showStudio} />
      <MusicPlayer enabled={musicOn} />

      {screen === "login" && <LoginScreen />}

      {screen === "home" && <HomeScreen />}

      {screen === "setup" && <SetupScreen />}

      {screen === "vote" && <VoteScreen />}

      {screen === "reveal" && (
        <RevealRanking
          ranking={match?.ranking || []}
          play={play}
          onDone={() => setScreen("ranking")}
        />
      )}

      {screen === "ranking" && <RankingScreen />}

      {screen === "history" && <HistoryScreen />}
    </div>
  );
}

/* =========================
   Small components
========================= */
function Slider({ label, value, setValue }) {
  return (
    <div className="sliderRow">
      <div className="sliderTop">
        <div className="label">{label}</div>
        <div className="pill">{value}</div>
      </div>
      <input
        className="range"
        type="range"
        min="0"
        max="10"
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
      />
    </div>
  );
}
