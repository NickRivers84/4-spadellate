# Checklist pre-lancio Play Store

Cosa migliorare o verificare prima di pubblicare **Forchette & Polpette** su Google Play.

---

## ✅ Già a posto (verificato)

- **Privacy e termini**: `privacy.html` e `termini.html` completi, con contatto (email), cancellazione account, base giuridica, cookie.
- **Firestore rules**: regole coerenti (read auth, create/update/delete con owner/participants).
- **Errori in italiano**: `getUserMessage` e fallback per login, join, createGame, delete, ecc. (corretto bug messaggio in `startMultiVote`).
- **Versione**: `package.json` impostato a `1.0.0`; Android `versionCode 1`, `versionName "1.0"`.
- **Icona**: unica icona (forchetta e polpetta) in web e Android.
- **Capacitor**: `appId` e `appName` configurati, `webDir: dist`, schema https.

---

## 🔧 Fatto in questa sessione

- Corretto messaggio di errore nel catch di **startMultiVote** (era “startGame”, ora “startMultiVote”).
- Impostata **version** in `package.json` a `1.0.0`.

---

## 📋 Da fare prima del lancio

### 1. Store listing (Google Play Console)

- **Titolo** (max 30 caratteri): es. *Forchette & Polpette – 4 Spadellate*.
- **Breve descrizione** (max 80 caratteri): una frase per i risultati di ricerca.
- **Descrizione lunga**: cosa fa il gioco (creare partita, votare, classifica, codice/QR), età, che è un party game.
- **Privacy policy URL**: **obbligatorio**. Usa l’URL pubblico della privacy, es.  
  `https://TUO-DOMINIO-VERCEL.vercel.app/privacy.html`  
  (stesso contenuto che hai già in `public/privacy.html`).
- **Categoria**: Giochi > Party / Casual (o la più adatta).
- **Icona 512×512** per Play Store: puoi usare `public/icons/icon-192.png` ridimensionato a 512×512 (o esportare una versione 512 da progetto).
- **Screenshot**: almeno 2 (telefono), meglio 4–8. Suggerimento: login, home con modalità, lobby con codice/QR, schermata voto, risultati.
- **Feature graphic** (opzionale ma consigliata): 1024×500 px per la scheda in alto nella pagina Play.

### 2. Contenuto e rating

- **Questionario contenuto**: rispondi su violenza, acquisti in-app, dati condivisi, ecc. Per la tua app (login Google, niente acquisti, niente contenuti sensibili) di solito si ottiene un rating basso (es. PEGI 3 / Everyone).
- **Target audience**: indica fascia d’età (es. tutti) e che i minori possono usarla con consenso genitori (come da termini).

### 3. Tecnico / build

- **Firma release**: build AAB (Android App Bundle) firmato con la tua keystore (già fatto se hai seguito la guida signed bundle).
- **google-services.json**: presente in `android/app/` per Firebase (auth e Firestore) nella build release.
- **Test su dispositivo reale**: almeno un test completo (crea partita, join da altro dispositivo, voto, risultati) su uno o due dispositivi Android.

### 4. Opzionali ma utili

- **Splash screen**: Capacitor supporta splash; puoi lasciare quello di default o personalizzarlo con logo/colori del gioco.
- **Descrizione “Novità”**: nella scheda Play puoi scrivere cosa c’è in questa versione (es. “Prima release: crea partite, vota, classifica con codice o QR”).
- **Link “Torna all’app”** in privacy/termini: con `href="/"` funziona sul sito; nell’app Android Capacitor lo stesso link riporta all’app. Nessuna modifica necessaria se usi path relativi.

---

## Riepilogo priorità

| Priorità | Cosa |
|----------|------|
| **Alta** | URL privacy policy pubblico (Vercel) e inserito in Play Console |
| **Alta** | Screenshot (2–8) e icona 512×512 per la scheda Play |
| **Alta** | Titolo, breve descrizione, descrizione lunga in italiano |
| **Media** | Questionario contenuto e rating, categoria, target audience |
| **Bassa** | Feature graphic, splash personalizzato, note di rilascio |

Dopo aver completato le voci in **Priorità alta**, puoi procedere con l’upload del primo AAB e l’invio in revisione.
