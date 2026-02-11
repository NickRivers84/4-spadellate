import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import { auth, db } from "./firebase";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserSessionPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  orderBy,
  limit,
} from "firebase/firestore";

/* =========================================
   BUILD TAG (per capire se stai vedendo la versione giusta)
========================================= */
const BUILD = "fp-modes-setup-vote-reveal-001";

/* =========================================
   Utils
========================================= */
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function nowIso() {
  try {
    return new Date().toISOString();
  } catch {
    return "";
  }
}

function makeCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

/* =========================================
   Audio (safe play: controlla che non sia HTML)
========================================= */
async function audioExists(url) {
  try {
    const res = await fetch(url, { method: "GET", cache: "no-store" });
    if (!res.ok) return false;
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    if (ct.includes("text/html")) return false; // Vite a volte restituisce index.html
    return true;
  } catch {
    return false;
  }
}

function useFX() {
  const cacheRef = useRef(new Map()); // url -> boolean
  return {
    play: async (file, volume = 0.7) => {
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
      } catch {
        // niente: browser policies / gesture ecc.
      }
    },
  };
}

function MusicPlayer({ enabled }) {
  const ref = useRef(null);
  const { play } = useFX();

  useEffect(() => {
    let cancelled = false;

    async function ensure() {
      if (ref.current) return;
      const ok = await audioExists("/audio/background.mp3");
      if (!ok || cancelled) return;
      const a = new Audio("/audio/background.mp3");
      a.loop = true;
      a.volume = 0.35;
      ref.current = a;
    }

    ensure();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    (async () => {
      if (!enabled) {
        try {
          ref.current?.pause();
        } catch {}
        return;
      }
      // tenta di avviare (se bloccato, non facciamo nulla)
      try {
        await ref.current?.play();
      } catch {
        // piccolo feedback facoltativo
        play("tap.mp3", 0.35);
      }
    })();
  }, [enabled]);

  return null;
}

/* =========================================
   Firestore paths
========================================= */
function activeMatchRef(uid) {
  return doc(db, "users", uid, "state", "activeMatch");
}

function matchesCol(uid) {
  return collection(db, "users", uid, "matches");
}

/* =========================================
   Game modes
========================================= */
const MODES = {
  classic: {
    id: "classic",
    title: "CLASSICA",
    subtitle: "Come lo show: 4 giocatori • 4 ristoranti",
    restaurantsMin: 4,
    restaurantsMax: 4,
    playersMin: 4,
    playersMax: 4,
  },
  custom: {
    id: "custom",
    title: "PERSONALIZZATA",
    subtitle: "Scegli tu: 2–8 giocatori • 2–8 ristoranti",
    restaurantsMin: 2,
    restaurantsMax: 8,
    playersMin: 2,
    playersMax: 8,
  },
  oneshot: {
    id: "oneshot",
    title: "ONE SHOT",
    subtitle: "Un solo ristorante • 2–8 giocatori",
    restaurantsMin: 1,
    restaurantsMax: 1,
    playersMin: 2,
    playersMax: 8,
  },
};

/* =========================================
   Screens
========================================= */
function ModeSelect({ onPick, onBack }) {
  return (
    <div className="screen setup" style={{ alignItems: "center" }}>
      <div className="card" style={{ width: "100%", maxWidth: 560 }}>
        <h2 className="h2">Scegli la modalità</h2>
        <p className="muted">Seleziona il formato… poi si spadella (con stile).</p>

        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {Object.values(MODES).map((m) => (
            <button
              key={m.id}
              className="btn big"
              onClick={() => onPick(m.id)}
              style={{ textAlign: "left" }}
            >
              <strong>{m.title}</strong>
              <div className="muted" style={{ marginTop: 4 }}>
                {m.subtitle}
              </div>
            </button>
          ))}
        </div>

        <button className="btn btn-secondary" style={{ marginTop: 14 }} onClick={onBack}>
          ← Torna indietro
        </button>
      </div>
    </div>
  );
}

function SetupScreen({ settings, setSettings, onStart, onBack }) {
  const mode = MODES[settings.mode] || MODES.custom;

  // mantiene array nomi coerenti con counts
  useEffect(() => {
    const rc = settings.restaurantsCount;
    const pc = settings.playersCount;

    if (settings.restaurantNames.length !== rc) {
      const next = Array.from({ length: rc }).map((_, i) => settings.restaurantNames[i] || `Ristorante ${i + 1}`);
      setSettings((s) => ({ ...s, restaurantNames: next }));
    }
    if (settings.playerNames.length !== pc) {
      const next = Array.from({ length: pc }).map((_, i) => settings.playerNames[i] || `Giocatore ${i + 1}`);
      setSettings((s) => ({ ...s, playerNames: next }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.restaurantsCount, settings.playersCount]);

  const canStart =
    settings.restaurantNames.every((x) => String(x || "").trim().length > 0) &&
    settings.playerNames.every((x) => String(x || "").trim().length > 0);

  return (
    <div className="screen setup" style={{ alignItems: "flex-start" }}>
      <div className="card" style={{ width: "100%", maxWidth: 560 }}>
        <h2 className="h2">Setup partita</h2>
        <p className="muted">Scegli tutto prima di iniziare (poi si spadella).</p>

        {/* RISTORANTI */}
        <div style={{ marginTop: 14 }}>
          <label className="muted">
            Ristoranti: <strong style={{ color: "#111" }}>{settings.restaurantsCount}</strong>
          </label>

          <input
            type="range"
            min={mode.restaurantsMin}
            max={mode.restaurantsMax}
            value={settings.restaurantsCount}
            disabled={mode.restaurantsMin === mode.restaurantsMax}
            onChange={(e) =>
              setSettings((s) => ({ ...s, restaurantsCount: Number(e.target.value) }))
            }
          />
        </div>

        {/* GIOCATORI */}
        <div style={{ marginTop: 10 }}>
          <label className="muted">
            Partecipanti: <strong style={{ color: "#111" }}>{settings.playersCount}</strong>
          </label>
          <input
            type="range"
            min={mode.playersMin}
            max={mode.playersMax}
            value={settings.playersCount}
            onChange={(e) => setSettings((s) => ({ ...s, playersCount: Number(e.target.value) }))}
          />
        </div>

        {/* TOGGLES */}
        <div style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={settings.bonusEnabled}
              onChange={(e) => setSettings((s) => ({ ...s, bonusEnabled: e.target.checked }))}
            />
            Bonus facoltativo (+5) — una volta per votante
          </label>

          <label style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <input
              type="checkbox"
              checked={settings.musicEnabled}
              onChange={(e) => setSettings((s) => ({ ...s, musicEnabled: e.target.checked }))}
            />
            Musica (se disponibile)
          </label>
        </div>

        {/* NOMI RISTORANTI */}
        <div style={{ marginTop: 14 }}>
          <h3 style={{ margin: "10px 0" }}>Nomi ristoranti</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {settings.restaurantNames.map((v, i) => (
              <input
                key={`r-${i}`}
                type="text"
                value={v}
                placeholder={`Ristorante ${i + 1}`}
                onChange={(e) => {
                  const next = [...settings.restaurantNames];
                  next[i] = e.target.value;
                  setSettings((s) => ({ ...s, restaurantNames: next }));
                }}
              />
            ))}
          </div>
        </div>

        {/* NOMI GIOCATORI */}
        <div style={{ marginTop: 14 }}>
          <h3 style={{ margin: "10px 0" }}>Nomi partecipanti</h3>
          <div style={{ display: "grid", gap: 8 }}>
            {settings.playerNames.map((v, i) => (
              <input
                key={`p-${i}`}
                type="text"
                value={v}
                placeholder={`Giocatore ${i + 1}`}
                onChange={(e) => {
                  const next = [...settings.playerNames];
                  next[i] = e.target.value;
                  setSettings((s) => ({ ...s, playerNames: next }));
                }}
              />
            ))}
          </div>
        </div>

        {/* ACTIONS */}
        <button
          className="btn big"
          style={{ marginTop: 14 }}
          onClick={onStart}
          disabled={!canStart}
          title={!canStart ? "Compila tutti i nomi per partire" : ""}
        >
          Avvia la cena 🍷
        </button>

        <button className="btn btn-secondary" style={{ marginTop: 10 }} onClick={onBack}>
          ← Torna indietro
        </button>
      </div>
    </div>
  );
}

function VoteScreen({
  match,
  onUpdateMatch,
  onFinish,
  fx,
}) {
  const restaurants = match.restaurantNames;
  const players = match.playerNames;

  const [scores, setScores] = useState({ cibo: 5, servizio: 5, location: 5, conto: 5 });
  const [wantBonus, setWantBonus] = useState(false);

  // riallinea (quando cambi votante/ristorante)
  useEffect(() => {
    setScores({ cibo: 5, servizio: 5, location: 5, conto: 5 });
    setWantBonus(false);
  }, [match.progress?.voterIndex, match.progress?.restaurantIndex]);

  const voterIndex = match.progress?.voterIndex ?? 0;
  const restaurantIndex = match.progress?.restaurantIndex ?? 0;

  const totalBase = scores.cibo + scores.servizio + scores.location + scores.conto;

  const bonusUsedBy = match.bonusUsedBy || {};
  const bonusAlreadyUsed = !!bonusUsedBy[String(voterIndex)];
  const canUseBonusThisVote = match.bonusEnabled && !bonusAlreadyUsed;

  const totalFinal = totalBase + (canUseBonusThisVote && wantBonus ? 5 : 0);

  const totalVotesNeeded = players.length * restaurants.length;
  const votesDone = (match.votes || []).length;

  const slider = (label, key) => (
    <div style={{ marginTop: 10 }}>
      <label className="muted">
        {label}: <strong style={{ color: "#111" }}>{scores[key]}</strong>
      </label>
      <input
        type="range"
        min={0}
        max={10}
        value={scores[key]}
        onChange={(e) => setScores((s) => ({ ...s, [key]: Number(e.target.value) }))}
      />
    </div>
  );

  const submit = async () => {
    fx.play("tap.mp3", 0.7);

    const vote = {
      voterIndex,
      voterName: players[voterIndex],
      restaurantIndex,
      restaurantName: restaurants[restaurantIndex],
      scores,
      total: totalFinal,
      bonusApplied: !!(canUseBonusThisVote && wantBonus),
      createdAtISO: nowIso(),
    };

    const nextVotes = [...(match.votes || []), vote];

    // avanzamento: tutti votano tutti i ristoranti
    let nextVoter = voterIndex;
    let nextRestaurant = restaurantIndex + 1;

    if (nextRestaurant >= restaurants.length) {
      nextRestaurant = 0;
      nextVoter += 1;
    }

    const finished = nextVoter >= players.length;

    const nextBonusUsedBy = { ...(match.bonusUsedBy || {}) };
    if (vote.bonusApplied) nextBonusUsedBy[String(voterIndex)] = true;

    const nextMatch = {
      ...match,
      votes: nextVotes,
      bonusUsedBy: nextBonusUsedBy,
      progress: finished
        ? { voterIndex, restaurantIndex } // non importa, finito
        : { voterIndex: nextVoter, restaurantIndex: nextRestaurant },
      updatedAt: serverTimestamp(),
    };

    // salva/riprendi: aggiorniamo Firestore ad ogni voto
    await onUpdateMatch(nextMatch);

    if (finished) onFinish(nextMatch);
  };

  return (
    <div className="screen vote" style={{ alignItems: "flex-start" }}>
      <div className="card" style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div>
            <h2 className="h2" style={{ marginBottom: 6 }}>
              Vota: {restaurants[restaurantIndex]}
            </h2>
            <p className="muted" style={{ marginBottom: 0 }}>
              Votante: <strong style={{ color: "#111" }}>{players[voterIndex]}</strong>
            </p>
          </div>
          <div style={{ textAlign: "right" }}>
            <p className="muted" style={{ marginBottom: 0 }}>
              Voti: <strong style={{ color: "#111" }}>{votesDone}/{totalVotesNeeded}</strong>
            </p>
            <p className="muted" style={{ marginBottom: 0 }}>
              Codice: <strong style={{ color: "#111" }}>{match.matchCode}</strong>
            </p>
          </div>
        </div>

        {slider("🍝 Cibo", "cibo")}
        {slider("🛎 Servizio", "servizio")}
        {slider("🏠 Location", "location")}
        {slider("💸 Conto", "conto")}

        <div style={{ marginTop: 12 }}>
          <p style={{ margin: 0 }}>
            Totale: <strong>{totalFinal}</strong>{" "}
            <span className="muted">
              (base {totalBase}{match.bonusEnabled ? ", bonus +5 opzionale" : ""})
            </span>
          </p>
        </div>

        {match.bonusEnabled && (
          <div style={{ marginTop: 10 }}>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => {
                if (!canUseBonusThisVote) return;
                setWantBonus((x) => !x);
                fx.play("tap.mp3", 0.5);
              }}
              disabled={!canUseBonusThisVote}
              title={!canUseBonusThisVote ? "Bonus già usato da questo votante" : ""}
            >
              {canUseBonusThisVote
                ? wantBonus
                  ? "✅ Bonus +5 assegnato"
                  : "Usa Bonus +5 (una volta)"
                : "Bonus già usato"}
            </button>
          </div>
        )}

        <button className="btn big" style={{ marginTop: 14 }} onClick={submit}>
          Conferma voto
        </button>
      </div>
    </div>
  );
}

function StudioLightsOverlay({ show }) {
  if (!show) return null;
  return (
    <div
      aria-hidden="true"
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 999,
        background:
          "radial-gradient(circle at 20% 20%, rgba(255,255,255,0.30), transparent 45%)," +
          "radial-gradient(circle at 80% 30%, rgba(255,255,255,0.22), transparent 50%)," +
          "radial-gradient(circle at 50% 90%, rgba(255,255,255,0.14), transparent 55%)",
        mixBlendMode: "screen",
        animation: "fpLights 2.2s ease-in-out infinite alternate",
      }}
    />
  );
}

function RankingScreen({ finalMatch, onClose, fx }) {
  const restaurants = finalMatch.restaurantNames || [];
  const votes = finalMatch.votes || [];

  const totals = useMemo(() => {
    const arr = Array(restaurants.length).fill(0);
    for (const v of votes) {
      arr[v.restaurantIndex] = (arr[v.restaurantIndex] || 0) + (v.total || 0);
    }
    return arr;
  }, [restaurants, votes]);

  const ranking = useMemo(() => {
    return restaurants
      .map((name, i) => ({ name, score: totals[i] || 0 }))
      .sort((a, b) => b.score - a.score);
  }, [restaurants, totals]);

  const [reveal, setReveal] = useState(0);
  const [showOverlay, setShowOverlay] = useState(true);

  useEffect(() => {
    // drumroll + reveal
    fx.play("drumroll.mp3", 0.6);
    setReveal(0);
    setShowOverlay(true);

    const t = setInterval(() => {
      setReveal((r) => {
        const next = r + 1;
        if (next >= ranking.length) {
          clearInterval(t);
          // winner sfx
          fx.play("winners.mp3", 0.75);
          // spegni overlay dopo un attimo
          setTimeout(() => setShowOverlay(false), 1200);
        }
        return next;
      });
    }, 900);

    return () => clearInterval(t);
  }, [ranking.length]);

  const winner = ranking[0]?.name || "—";

  return (
    <div className="screen ranking" style={{ alignItems: "center" }}>
      <StudioLightsOverlay show={showOverlay} />
      <div className="card" style={{ width: "100%", maxWidth: 560 }}>
        <h2 className="h2">🏆 Classifica finale</h2>
        <p className="muted">Reveal in stile studio TV… e poi screenshot 📸</p>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {ranking.slice(0, reveal).map((r, idx) => (
            <div
              key={r.name}
              style={{
                padding: "12px 14px",
                borderRadius: 16,
                border: "1px solid rgba(0,0,0,0.14)",
                background: "rgba(255,255,255,0.28)",
                transform: "translateY(0)",
                animation: "fpPop 260ms ease-out",
              }}
            >
              <strong>
                {idx + 1}. {r.name}
              </strong>{" "}
              <span className="muted">— {r.score}</span>
              {idx === 0 ? (
                <div style={{ marginTop: 6 }}>
                  <span className="muted">Vincitore: </span>
                  <strong>{winner}</strong> 🥳
                </div>
              ) : null}
            </div>
          ))}
        </div>

        {reveal < ranking.length ? (
          <p className="muted" style={{ marginTop: 12 }}>
            …ci siamo quasi…
          </p>
        ) : (
          <p className="muted" style={{ marginTop: 12 }}>
            Screenshot pronto ✅ (su PC: Strumento di cattura / su telefono: screenshot)
          </p>
        )}

        <button className="btn big" style={{ marginTop: 12 }} onClick={onClose}>
          Chiudi e torna Home
        </button>
      </div>
    </div>
  );
}

function HistoryScreen({ items, onBack }) {
  return (
    <div className="screen setup" style={{ alignItems: "flex-start" }}>
      <div className="card" style={{ width: "100%", maxWidth: 560 }}>
        <h2 className="h2">Storico vincitori</h2>
        <p className="muted">Le ultime partite salvate sul tuo account.</p>

        <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
          {items.length === 0 ? (
            <div className="muted">Nessuna partita salvata… ancora.</div>
          ) : (
            items.map((m) => (
              <div
                key={m.id}
                style={{
                  padding: "12px 14px",
                  borderRadius: 16,
                  border: "1px solid rgba(0,0,0,0.14)",
                  background: "rgba(255,255,255,0.28)",
                }}
              >
                <div>
                  <strong>{m.winner || "—"}</strong>{" "}
                  <span className="muted">({m.matchCode || "—"})</span>
                </div>
                <div className="muted" style={{ marginTop: 4 }}>
                  {m.createdAtISO || "—"}
                </div>
              </div>
            ))
          )}
        </div>

        <button className="btn big" style={{ marginTop: 14 }} onClick={onBack}>
          ← Torna Home
        </button>
      </div>
    </div>
  );
}

/* =========================================
   APP
========================================= */
export default function App() {
  const fx = useFX();

  const [user, setUser] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  const [screen, setScreen] = useState("home"); // home | mode | setup | vote | ranking | history
  const [musicOn, setMusicOn] = useState(false);

  const [settings, setSettings] = useState(() => ({
    mode: "custom",
    restaurantsCount: 4,
    playersCount: 4,
    bonusEnabled: true,
    musicEnabled: false,
    restaurantNames: ["La Bottega", "Trattoria Roma", "Osteria Bella", "Polpetta Palace"],
    playerNames: ["Giocatore 1", "Giocatore 2", "Giocatore 3", "Giocatore 4"],
  }));

  const [activeMatch, setActiveMatch] = useState(null);
  const [finalMatch, setFinalMatch] = useState(null);
  const [history, setHistory] = useState([]);

  // Auth init
  useEffect(() => {
    let unsubAuth = () => {};
    (async () => {
      try {
        await setPersistence(auth, browserLocalPersistence);
      } catch {
        try {
          await setPersistence(auth, browserSessionPersistence);
        } catch {}
      }
      unsubAuth = onAuthStateChanged(auth, (u) => {
        setUser(u || null);
      });
    })();

    return () => unsubAuth();
  }, []);

  // Sync activeMatch + history when logged in
  useEffect(() => {
    if (!user) {
      setActiveMatch(null);
      setHistory([]);
      setMusicOn(false);
      return;
    }

    const ref = activeMatchRef(user.uid);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          setActiveMatch(null);
          return;
        }
        setActiveMatch({ id: snap.id, ...snap.data() });
      },
      (err) => {
        console.log("Firestore onSnapshot error:", err);
      }
    );

    const q = query(matchesCol(user.uid), orderBy("createdAt", "desc"), limit(20));
    const unsub2 = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setHistory(items);
      },
      () => {}
    );

    return () => {
      unsub();
      unsub2();
    };
  }, [user]);

  // keep background class for optional CSS backgrounds
  const appClass = `app bg-${screen}`;

  const showToast = (msg) => {
    setToast(msg);
    if (!msg) return;
    setTimeout(() => setToast(""), 2600);
  };

  const doLogin = async () => {
    setBusy(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });

      await signInWithPopup(auth, provider);
      fx.play("tap.mp3", 0.6);
      showToast("Accesso effettuato ✅");
    } catch (e) {
      console.log(e);
      showToast("Login non riuscito. Riprova.");
    } finally {
      setBusy(false);
    }
  };

  const doLogout = async () => {
    setBusy(true);
    try {
      await signOut(auth);
      setScreen("home");
      showToast("Sei uscito.");
    } catch {
      showToast("Errore uscita.");
    } finally {
      setBusy(false);
    }
  };

  const pickMode = (modeId) => {
    const m = MODES[modeId] || MODES.custom;
    setSettings((s) => {
      const restaurantsCount = clamp(s.restaurantsCount, m.restaurantsMin, m.restaurantsMax);
      const playersCount = clamp(s.playersCount, m.playersMin, m.playersMax);

      return {
        ...s,
        mode: modeId,
        restaurantsCount,
        playersCount,
      };
    });
    setScreen("setup");
  };

  const createMatch = async () => {
    if (!user) {
      showToast("Serve login Google per salvare la partita.");
      return;
    }

    setBusy(true);
    try {
      const m = MODES[settings.mode] || MODES.custom;

      const restaurantsCount = clamp(settings.restaurantsCount, m.restaurantsMin, m.restaurantsMax);
      const playersCount = clamp(settings.playersCount, m.playersMin, m.playersMax);

      const matchCode = makeCode(6);

      const match = {
        build: BUILD,
        matchCode,
        mode: settings.mode,
        restaurantsCount,
        playersCount,
        bonusEnabled: !!settings.bonusEnabled,
        musicEnabled: !!settings.musicEnabled,
        restaurantNames: settings.restaurantNames.slice(0, restaurantsCount),
        playerNames: settings.playerNames.slice(0, playersCount),
        bonusUsedBy: {},

        votes: [],

        progress: { voterIndex: 0, restaurantIndex: 0 },

        createdAt: serverTimestamp(),
        createdAtISO: nowIso(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(activeMatchRef(user.uid), match, { merge: false });

      setMusicOn(!!settings.musicEnabled);
      fx.play("tap.mp3", 0.6);

      setScreen("vote");
      showToast("Partita creata ✅");
    } catch (e) {
      console.log("createMatch error:", e);
      showToast("Errore creando la partita. Controlla Firestore Rules.");
    } finally {
      setBusy(false);
    }
  };

  const updateActiveMatch = async (nextMatch) => {
    if (!user) return;
    // nextMatch contiene serverTimestamp in updatedAt, ma potrebbe anche arrivare come dato già “materializzato”
    try {
      await setDoc(activeMatchRef(user.uid), nextMatch, { merge: true });
    } catch (e) {
      console.log("update match error:", e);
      showToast("Errore salvataggio. Riprova.");
      throw e;
    }
  };

  const finishMatch = async (doneMatch) => {
    // salva nello storico + chiude active
    if (!user) return;
    try {
      const restaurants = doneMatch.restaurantNames || [];
      const votes = doneMatch.votes || [];
      const totals = Array(restaurants.length).fill(0);
      for (const v of votes) totals[v.restaurantIndex] = (totals[v.restaurantIndex] || 0) + (v.total || 0);

      const ranking = restaurants
        .map((name, i) => ({ name, score: totals[i] || 0 }))
        .sort((a, b) => b.score - a.score);

      const winner = ranking[0]?.name || "—";

      await addDoc(matchesCol(user.uid), {
        build: BUILD,
        matchCode: doneMatch.matchCode,
        mode: doneMatch.mode,
        restaurantsCount: doneMatch.restaurantsCount,
        playersCount: doneMatch.playersCount,
        bonusEnabled: doneMatch.bonusEnabled,
        musicEnabled: doneMatch.musicEnabled,
        restaurantNames: doneMatch.restaurantNames,
        playerNames: doneMatch.playerNames,
        votesCount: votes.length,
        winner,
        ranking, // array di oggetti OK (non nested arrays)
        createdAt: serverTimestamp(),
        createdAtISO: doneMatch.createdAtISO || nowIso(),
      });

      await deleteDoc(activeMatchRef(user.uid));
    } catch (e) {
      console.log("finishMatch error:", e);
      // anche se fallisce, mostriamo comunque la classifica
    }
  };

  const onFinishFromVote = async (doneMatch) => {
    setFinalMatch(doneMatch);
    setScreen("ranking");
    await finishMatch(doneMatch);
  };

  const resumeMatch = async () => {
    if (!user) return;
    try {
      const snap = await getDoc(activeMatchRef(user.uid));
      if (!snap.exists()) {
        showToast("Nessuna partita da riprendere.");
        return;
      }
      const m = { id: snap.id, ...snap.data() };
      setActiveMatch(m);
      setMusicOn(!!m.musicEnabled);
      setScreen("vote");
      showToast("Partita ripresa ✅");
    } catch {
      showToast("Errore ripresa partita.");
    }
  };

  // HOME content wrapper (CENTRATO)
  const Home = () => (
    <div className="screen home">
      <div className="card home-card">
        <main className="panel">
          {!user ? (
            <div className="centerStack">
              <img className="logo" src="/brand/logo.png" alt="Forchette&Polpette" />
              <h2 className="h2">Benvenuto in studio.</h2>
              <p className="muted">Per salvare e riprendere partite serve l’accesso Google.</p>

              <button className="btn big" onClick={doLogin} disabled={busy}>
                Accedi con Google
              </button>

              <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                BUILD: {BUILD}
              </div>
            </div>
          ) : (
            <>
              <div className="hero">
                <img className="logo" src="/brand/logo.png" alt="Forchette&Polpette" />
                <h2 className="h2">Pronti a giudicare? 🍝</h2>
                <p className="muted">Scegli tu: “Inizia” o “Riprendi”.</p>
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
                <button className="btn big" onClick={() => setScreen("mode")} disabled={busy}>
                  Inizia una partita
                </button>

                <button
                  className="btn big"
                  onClick={resumeMatch}
                  disabled={busy || !activeMatch}
                  title={!activeMatch ? "Nessuna partita attiva trovata" : ""}
                >
                  Riprendi partita
                </button>

                <button className="btn btn-secondary" onClick={() => setScreen("history")}>
                  Storico vincitori
                </button>

                <button className="btn btn-secondary" onClick={doLogout} disabled={busy}>
                  Esci
                </button>
              </div>

              <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                BUILD: {BUILD}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );

  return (
    <div className={appClass}>
      <MusicPlayer enabled={musicOn} />

      {toast ? <div className="toast">{toast}</div> : null}

      {/* HOME */}
      {screen === "home" && <Home />}

      {/* MODES */}
      {screen === "mode" && (
        <ModeSelect
          onPick={pickMode}
          onBack={() => setScreen("home")}
        />
      )}

      {/* SETUP */}
      {screen === "setup" && (
        <SetupScreen
          settings={settings}
          setSettings={setSettings}
          onStart={createMatch}
          onBack={() => setScreen("mode")}
        />
      )}

      {/* VOTE */}
      {screen === "vote" && activeMatch && (
        <VoteScreen
          match={activeMatch}
          fx={fx}
          onUpdateMatch={async (m) => {
            // aggiorniamo stato locale immediatamente per UI fluida
            setActiveMatch(m);
            await updateActiveMatch(m);
          }}
          onFinish={onFinishFromVote}
        />
      )}

      {/* se vote ma activeMatch non ancora caricato */}
      {screen === "vote" && !activeMatch && (
        <div className="screen vote" style={{ alignItems: "center" }}>
          <div className="card" style={{ width: "100%", maxWidth: 560 }}>
            <h2 className="h2">Caricamento partita…</h2>
            <p className="muted">Se non arriva, torna Home e riprova.</p>
            <button className="btn big" onClick={() => setScreen("home")}>
              Torna Home
            </button>
          </div>
        </div>
      )}

      {/* RANKING */}
      {screen === "ranking" && finalMatch && (
        <RankingScreen
          finalMatch={finalMatch}
          fx={fx}
          onClose={() => {
            setFinalMatch(null);
            setScreen("home");
          }}
        />
      )}

      {/* HISTORY */}
      {screen === "history" && (
        <HistoryScreen items={history} onBack={() => setScreen("home")} />
      )}
    </div>
  );
}

/* =========================================
   Piccole animazioni inline (se non ci sono in App.css)
========================================= */
const style = document.createElement("style");
style.innerHTML = `
@keyframes fpPop { from { transform: translateY(6px); opacity: .0 } to { transform: translateY(0); opacity: 1 } }
@keyframes fpLights { from { opacity: .60 } to { opacity: 1 } }
`;
document.head.appendChild(style);
