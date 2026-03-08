# Checklist test da smartphone

Usa questa lista quando provi l’app da telefono (browser su URL Vercel o da rete locale). Segna con `[x]` ciò che hai verificato.

---

## Prima di iniziare

- [ ] Telefono e PC (se usi locale) sulla **stessa rete Wi‑Fi**
- [ ] URL pronto: **Vercel** (es. `https://xxx.vercel.app`) oppure **locale** (`http://<IP-PC>:5173`)
- [ ] Browser aggiornato (Chrome o Safari consigliati)

---

## 1. Apertura e login

- [ ] Apertura del sito dal browser dello smartphone
- [ ] Pagina carica senza errori visibili (schermata login)
- [ ] Titolo "Forchette & Polpette" e bottone "Login con Google" leggibili e non tagliati
- [ ] Tap su "Login con Google": si apre il flusso Google (popup o redirect)
- [ ] Dopo il login: arrivo alla **Home** con messaggio di benvenuto e nome utente

---

## 2. Home e modalità

- [ ] Visibili le tre modalità: **Classica**, **Personalizzata**, **One shot**
- [ ] Checkbox "Audio nella partita" e bottoni "Entra in partita" / "Indietro" usabili
- [ ] In fondo alla pagina: **Cancella account e dati**, **Informativa privacy**, **Termini di utilizzo** (fascia bassa)
- [ ] Tap su "Informativa privacy" e "Termini di utilizzo": si aprono in nuova scheda/tab e le pagine sono leggibili

---

## 3. Creazione partita – Tutti da questo dispositivo

- [ ] Seleziono **Classica** (o Personalizzata / One shot)
- [ ] Scelgo **"Tutti da questo dispositivo"** (bottone verde)
- [ ] Tap su "Avvia partita"
- [ ] Compare il toast verde **"Partita creata. Imposta i nomi."** (stile uguale al bottone verde)
- [ ] Passaggio alla schermata **Setup** (nomi giocatori e ristoranti)

---

## 4. Creazione partita – Ognuno dal proprio (codice/QR)

- [ ] Dalla Home scelgo una modalità e **"Ognuno dal proprio (codice partita)"**
- [ ] Tap su "Avvia partita (codice/QR)"
- [ ] Toast "Partita creata..." e arrivo alla **Lobby**
- [ ] Visibili: **codice a 6 caratteri**, **QR code**, bottone "Copia link invito"
- [ ] "Copia link invito" copia il link e mostra conferma (toast)
- [ ] Contatore giocatori (es. "0 / 4 giocatori") visibile e coerente

---

## 5. Setup (nomi e avvio)

- [ ] In Setup: inserimento nomi **giocatori** (e avatars se presenti)
- [ ] Inserimento nomi **ristoranti** (e avatars se presenti)
- [ ] Bottone per avviare il voto (es. "Inizia a votare" / simile) funziona
- [ ] Passaggio alla schermata **Voto**

---

## 6. Voto

- [ ] Schermata voto leggibile: nome ristorante, categorie (Posizione, Menu, Servizio, Conto, Bonus)
- [ ] Stelle (1–5) o controlli di voto rispondono al tap
- [ ] Si può passare al ristorante successivo e completare tutti i voti
- [ ] Se l’audio è attivo: suono al tap (se previsto)
- [ ] Nessun elemento importante tagliato (testo o bottoni fuori schermo)

---

## 7. Risultati

- [ ] Dopo il voto: schermata **Risultati** con classifica
- [ ] Grafico/lista leggibile e non tagliato
- [ ] Bottone per tornare alla Home (o "Nuova partita") funziona

---

## 8. Entra in partita (secondo dispositivo)

- [ ] Da **altro telefono** (o da PC): aperto lo stesso URL (Vercel o locale)
- [ ] Login Google eseguito
- [ ] Dalla Home: tap "Entra in partita", inserimento **codice a 6 caratteri**
- [ ] Tap "Entra": arrivo a "Inserisci il tuo nickname"
- [ ] Inserito nickname e confermato: ingresso in **Lobby** o in **Voto** (a seconda dello stato della partita)
- [ ] Oppure: apertura del **link invito** (incollato da chat): arrivo diretto a codice/nickname e poi in partita

---

## 9. Comportamento generale

- [ ] **Rotazione** (portrait/landscape): layout si adatta, niente elementi critici tagliati
- [ ] **Zoom**: non necessario per usare l’app (testi e tap target sufficienti)
- [ ] **Toast**: messaggi di successo/errore visibili e leggibili (verde/rosso)
- [ ] **Offline**: con Wi‑Fi disattivato compare il banner "Sei offline..." (se previsto)
- [ ] **Indietro**: da ogni schermata si può tornare alla schermata precedente o alla Home senza blocchi

---

## 10. Performance e stabilità

- [ ] Nessun crash del browser durante il flusso principale
- [ ] Transizioni tra schermate fluide (senza attese eccessive)
- [ ] Firebase: lettura/scrittura funzionanti (partita creata, voti salvati, risultati aggiornati)

---

## Note

- Data test: _______________
- Dispositivo: _______________
- Browser: _______________
- URL usato: _______________
- Problemi riscontrati: _______________
