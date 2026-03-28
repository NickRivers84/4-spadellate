# Tutorial: due migliorie “Subito” – passo passo

Questo tutorial spiega le **due migliorie** che abbiamo implementato per l’esperienza di gioco. Puoi usarlo per capire cosa è stato fatto e ripeterlo in un altro progetto.

---

## Miglioria 1 – Feedback al voto (animazione stella)

**Cosa fa:** Quando selezioni un numero (1–5) per una categoria, il bottone fa una breve animazione “pop” (ingrandisce e torna normale) così senti che il voto è stato registrato.

**Dove agiamo:** solo **CSS** (nessuna logica in React).

### Passo 1 – Aprire il file CSS

Apri `src/App.css`.

### Passo 2 – Trovare gli stili dei bottoni di voto

Cerca la classe `.voteRow .selected` (stile del bottone quando è selezionato, cerchio rosso). Dovrebbe essere vicino alla riga 795.

### Passo 3 – Aggiungere l’animazione

**Sotto** il blocco `.voteRow .selected { ... }` aggiungi:

```css
/* Animazione "pop" quando selezioni una stella (feedback al voto) */
.voteRow .voteButtons button.selected{
  animation: starPop 0.35s ease;
}
@keyframes starPop{
  0%{ transform: scale(1); }
  55%{ transform: scale(1.2); }
  100%{ transform: scale(1); }
}
```

**Cosa significa:**
- `.voteRow .voteButtons button.selected` = il bottone del voto (1–5) quando è selezionato.
- `animation: starPop 0.35s ease` = esegue l’animazione “starPop” per 0,35 secondi.
- `@keyframes starPop` = alla metà del tempo il bottone è al 120% della dimensione, poi torna al 100%.

Salva il file. L’animazione è attiva: ogni volta che selezioni una stella vedrai il “pop”.

---

## Miglioria 2 – Indicatore “Salvato ✓” in modalità multi

**Cosa fa:** In una partita **multi** (ognuno dal proprio dispositivo), quando voti e il voto viene salvato su Firebase, compare per circa 2 secondi il messaggio **“Salvato ✓”** in verde, così sei sicuro che il voto è andato a buon fine.

**Dove agiamo:** stato in React, funzione `selectVote`, effetto per nascondere il messaggio, un po’ di JSX e CSS.

### Passo 1 – Aggiungere lo stato

In `src/App.jsx`, nella lista degli `useState`, aggiungi uno stato per “quando è stato mostrato Salvato”:

```javascript
const [voteSavedAt, setVoteSavedAt] = useState(null)
```

Mettilo vicino agli altri stati (es. dopo `lobbyParticipantCount`).  
`null` = non mostrare nulla; un numero (timestamp) = mostrare “Salvato” e poi nasconderlo dopo 2 secondi.

### Passo 2 – Mostrare “Salvato” dopo il salvataggio su Firebase

Cerca la funzione **`selectVote`**. All’interno c’è il ramo per la modalità multi:

```javascript
if(voteMode==="multi"&&myPlayerIndex!=null){
  const updated = ...
  setVotes(updated)
  setDoc(doc(db,"games",gameId),{ votes:updated },{merge:true}).catch(()=>{})
  return
}
```

Sostituisci la riga del `setDoc` con:

```javascript
setDoc(doc(db,"games",gameId),{ votes:updated },{merge:true})
  .then(()=> setVoteSavedAt(Date.now()))
  .catch(()=>{})
```

**Cosa significa:** quando Firestore salva con successo, salviamo l’istante corrente in `voteSavedAt`. Lo usiamo per mostrare “Salvato” e per avviare il timer che lo nasconde.

### Passo 3 – Nascondere “Salvato” dopo 2 secondi

Aggiungi un `useEffect` che quando `voteSavedAt` cambia imposta un timer e dopo 2 secondi rimette `voteSavedAt` a `null`:

```javascript
useEffect(()=>{
  if(!voteSavedAt) return
  const t = setTimeout(()=> setVoteSavedAt(null), 2000)
  return ()=> clearTimeout(t)
}, [voteSavedAt])
```

Mettilo insieme agli altri `useEffect` (es. dopo quello del toast).  
Così “Salvato ✓” scompare da solo dopo 2 secondi.

### Passo 4 – Mostrare il messaggio in schermata voto

Nella schermata **Voto**, quando **non** sei l’host (quindi sei un giocatore che vota), sopra l’elenco delle categorie (Posizione, Menu, ecc.) aggiungi:

```jsx
{voteSavedAt && <p className="voteSavedFeedback" role="status">Salvato ✓</p>}
```

Il blocco completo sarà qualcosa tipo:

```jsx
) : (
<>
  {voteSavedAt && <p className="voteSavedFeedback" role="status">Salvato ✓</p>}
  {voteCategories.filter(...).map(cat=> (
    ...
  ))}
```

`role="status"` è per l’accessibilità (gli screen reader annunciano il messaggio).

### Passo 5 – Stile per “Salvato ✓”

In `src/App.css` aggiungi:

```css
.voteSavedFeedback{
  margin: 8px 0 4px 0;
  font-size: 14px;
  color: #16a34a;
  font-weight: bold;
  animation: fadeIn 0.25s ease;
}
@keyframes fadeIn{
  from{ opacity: 0; transform: translateY(-4px); }
  to{ opacity: 1; transform: translateY(0); }
}
```

Colore verde (#16a34a), piccolo fade-in e leggero movimento da sopra. Salva.

---

## Verifica

1. **Miglioria 1 – Stella:** Avvia una partita (anche “Tutti da questo dispositivo”). In votazione, clicca su un numero (1–5): il cerchio deve fare un breve “pop”.
2. **Miglioria 2 – Salvato:** Crea una partita in modalità “Ognuno dal proprio (codice partita)”. Da un altro dispositivo entra con il codice e vota: dopo ogni voto deve comparire “Salvato ✓” per circa 2 secondi.

---

## Riepilogo file modificati

| File        | Cosa è stato fatto |
|------------|---------------------|
| `src/App.css` | Animazione `starPop` per `.voteRow .voteButtons button.selected`; stile `.voteSavedFeedback` e `@keyframes fadeIn`. |
| `src/App.jsx` | Stato `voteSavedAt`; in `selectVote` (multi) `.then(()=> setVoteSavedAt(Date.now()))`; `useEffect` per resettare dopo 2 s; in JSX voto `{voteSavedAt && <p className="voteSavedFeedback">Salvato ✓</p>}`. |

Se qualcosa non funziona, controlla che i nomi delle classi e delle variabili coincidano con quelli usati nel progetto (es. `voteSavedAt` / `setVoteSavedAt`, `voteSavedFeedback`).
