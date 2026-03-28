# Controllo generale e miglioramenti esperienza di gioco

## 1. Riepilogo passaggi effettuati (sessione)

- **Toast successo** – Stile del toast "Partita creata. Imposta i nomi." allineato al bottone verde "Tutti da questo dispositivo" (verde #16a34a, bordo bianco, text-shadow, font Nunito bold).
- **Link privacy/termini/cancella account** – Spostati in fascia bassa della home (classe `homeLegalStrip`).
- **Regola Cursor** – Quando si dice "fai push", fornire guida passo passo e poi controllare errori/redirect in locale (`.cursor/rules/push-e-verifica-local.mdc`).
- **Checklist test smartphone** – File `TEST-SMARTPHONE.md` per test da telefono.
- **Icona** – Nuova icona (forchetta e polpetta) inserita in `public/icons/icon-192.png`; manifest aggiornato a icona unica; vecchie icone in root `icons/` eliminate; stessa icona copiata in `android/.../public/icons/` per build Android; rimossi .jpg obsoleti.
- **Cache-bust favicon** – Aggiunto `?v=2` a favicon/og:image in `index.html` e manifest per aggiornare cache su Vercel.
- **Bug messaggi errore** – Corretto contesto in `startGame` (usa "startGame") e in `startMultiVote` (usa "startMultiVote").
- **Versione** – `package.json` da 0.0.0 a 1.0.0.
- **Pre-lancio Play Store** – `PRE-LANCIO-PLAY-STORE.md` con checklist (privacy URL, screenshot, icona 512, questionario, ecc.).
- **Testi Play Store** – `PLAY-STORE-TESTI.md` con titolo, breve descrizione e descrizione lunga pronti per la Console.
- **Auth** – In `onAuthStateChanged`, quando l’utente è `null` (logout/sessione scaduta da altro tab) ora si imposta `setUser(null)` e `setScreen("login")` per evitare stati incoerenti.

---

## 2. Controllo codice (sintesi)

| Aspetto | Stato | Note |
|--------|--------|-----|
| **Firebase** | OK | Config in `firebase.js`, Auth + Firestore, nessuna chiave “segreta” esposta (le apiKey in frontend sono normali). |
| **Firestore rules** | OK | Lettura solo auth; create/update/delete con owner/participants. |
| **ErrorBoundary** | OK | Presente in `main.jsx`, messaggio in italiano e pulsante Ricarica. |
| **Errori utente** | OK | `getUserMessage` + fallback per contesti; messaggi di rete/auth; toast per errori. |
| **Service Worker** | OK | Registrato solo in produzione (no localhost); cache con versione; offline fallback. |
| **Accessibilità** | OK | Skip link, aria-busy/aria-label su bottoni, role su toast/banner offline, focus-visible. |
| **Stati auth** | OK | Gestione login/logout e sessione scaduta; da questa sessione anche `user === null` → login. |
| **PWA/Manifest** | OK | Icona unica, theme/background, start_url. |
| **Capacitor** | OK | appId, webDir, androidScheme https. |

**Possibili miglioramenti tecnici (non bloccanti):**

- **Firebase config** – In produzione conviene usare variabili d’ambiente (es. `import.meta.env.VITE_FIREBASE_*`) e non tenere la config hardcoded, così puoi cambiare progetto per build diverse.
- **Dimensione App.jsx** – Un solo file molto grande; in futuro si può estrarre logica (es. hook `useGame`, funzioni Firebase) e componenti (Login, Home, Setup, Vote, Result) per manutenzione e test.

Nessun TODO/FIXME trovato nel codice.

---

## 3. Come continuare a migliorare l’esperienza di gioco

Priorità suggerite, da “impatto immediato” a “evoluzione”.

### A. Subito (basso sforzo, alto impatto)

- **Feedback al voto** – Breve animazione o suono diverso quando si seleziona una stella (oltre al click già presente), per rendere il voto più “premuroso”.
- **Conferma “Partita piena”** – Se qualcuno prova a entrare con nickname e la partita è piena, il messaggio c’è già; si può aggiungere un suggerimento tipo “Chiedi all’host di avviare una nuova partita”.
- **Salvataggio voti multi** – In multi-device i voti vanno già su Firestore; si può mostrare un piccolo indicatore “Salvato” (o icona) dopo il `setDoc` in `selectVote` (solo in multi) per rassicurare che il voto è registrato.
- **Risultati – “Apri la busta”** – Una micro-animazione (es. scala/opacity) quando si passa da “Apri la busta” alla classifica rende il momento più televisivo.

### B. Breve termine (UX e chiarezza)

- **Onboarding** – Una sola schermata dopo il primo login: “Crea una partita o inserisci il codice dell’host” con due bottoni (Crea / Entra con codice) per guidare i nuovi utenti.
- **Lobby** – Countdown opzionale (“Avvio tra 10 secondi”) o bottone “Tutti pronti? Avvia” più in evidenza per l’host.
- **Stato connessione in partita** – In lobby/voto, se l’utente va offline, oltre al banner “Sei offline” si può mostrare un messaggio specifico: “Riconnettiti per continuare a votare”.
- **Nome partita** – Campo opzionale “Nome partita” in setup (es. “Cena di compleanno”) per riconoscere le partite in “Le tue partite” senza aprire.

### C. Medio termine (game feel)

- **Suoni** – Aggiungere suoni distinti per: inizio votazione, passaggio al ristorante successivo, apertura classifica, podio (1°/2°/3°) per dare più “show”.
- **Animazioni** – Transizioni leggere tra schermate (es. slide) e tra ristoranti in votazione; piccola animazione sulla stella selezionata.
- **Grafico risultati** – Animazione delle barre al “reveal” (es. recharts con `animationDuration`) per rendere la classifica più viva.
- **Categoria Bonus** – Testo breve che spiega cos’è il “Bonus” (es. “Piatto/esperienza extra che ti ha colpito”) per chi non ha mai giocato.

### D. Evoluzione (funzionalità)

- **Storia partite** – Dettaglio di una partita conclusa: vedere di nuovo classifica e, se salvati, voti per categoria (solo per owner o partecipanti).
- **Template partite** – Salvare una configurazione (nomi ristoranti/giocatori, numero) e riusarla per partite ricorrenti.
- **Notifiche** – “La votazione è iniziata” / “È il tuo turno” per chi ha installato l’app (Capacitor + FCM, opzionale).
- **Accessibilità** – Supporto screen reader più fine (annunci per “Ristorante X di Y”, “Voto salvato”, “Classifica: primo …”) e riduzione movimento per chi preferisce “motion reduced”.

---

## 4. Prossimi passi concreti

1. **Pubblicazione** – Completare la checklist in `PRE-LANCIO-PLAY-STORE.md` (screenshot, icona 512, privacy URL, questionario), build AAB da Android Studio, upload e invio in revisione.
2. **Esperienza** – Partire da uno o due punti della sezione “Subito” (es. feedback al voto + piccolo “Salvato” in multi) e poi aggiungere onboarding o migliorie alla lobby in base al feedback dei primi utenti.

Se mi dici su quale blocco vuoi lavorare per primo (A, B, C o D), posso entrare nel dettaglio implementativo (dove modificare in `App.jsx`/CSS, cosa aggiungere in Firebase se serve, ecc.).
