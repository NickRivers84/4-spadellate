import "./App.css"
import { useState, useEffect } from "react"
import { db, auth, googleProvider } from "./firebase"
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth"
import { collection, addDoc, doc, setDoc, getDoc, getDocs, query, where, deleteDoc } from "firebase/firestore"
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts"

export default function App(){

const [user,setUser] = useState(null)
const [screen,setScreen] = useState("login")
const [bg,setBg] = useState("bg1")
const [gameId,setGameId] = useState(null)

const [mode,setMode] = useState(null)
const [players,setPlayers] = useState(4)
const [restaurants,setRestaurants] = useState(4)

const [playerNames,setPlayerNames] = useState([])
const [restaurantNames,setRestaurantNames] = useState([])
const [playerAvatars,setPlayerAvatars] = useState([])
const [restaurantAvatars,setRestaurantAvatars] = useState([])
const [votes,setVotes] = useState([])
const [currentRestaurant,setCurrentRestaurant] = useState(0)
const [reveal,setReveal] = useState(false)

const [loading,setLoading] = useState(null)
const [error,setError] = useState(null)
const [myGames,setMyGames] = useState([])
const [loadingGameId,setLoadingGameId] = useState(null)
const [openPicker,setOpenPicker] = useState(null)

const voteCategories=[
{key:"location",label:"Location"},
{key:"menu",label:"Menu"},
{key:"service",label:"Servizio"},
{key:"price",label:"Conto"},
{key:"bonus",label:"Bonus"}
]

const PLAYER_AVATARS = ["👤","👩","👨","🧑","👴","👵","🧒","👦","👧","🧔","🧑‍🍳","🦸"]
const RESTAURANT_AVATAR_FILES = ["pizza.png","sushi.png","ramen.png","dumplings.png","steak.png","vegetariano.png","vegano.png","etnico.png","indiano.png","hamburger.png"]
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "")
const RESTAURANT_AVATARS = RESTAURANT_AVATAR_FILES.map(f=>`${BASE}/avatars/restaurants/${f}`)

const emptyVotes={
location:null,
menu:null,
service:null,
price:null,
bonus:null
}

useEffect(()=>{
onAuthStateChanged(auth,(u)=>{
if(u){
setUser(u)
setScreen("home")
}
})
},[])

async function fetchMyGames(){
if(!user) return
try{
const q = query(collection(db,"games"), where("owner","==",user.uid))
const snap = await getDocs(q)
const list = snap.docs.map(d=>({ id: d.id, ...d.data() }))
list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))
setMyGames(list.slice(0,15))
}catch(_){
setMyGames([])
}
}

useEffect(()=>{ fetchMyGames() },[user])
useEffect(()=>{ if(screen!=="setup") setOpenPicker(null) },[screen])

async function loadGame(id){
setError(null)
setLoadingGameId(id)
try{
const snap = await getDoc(doc(db,"games",id))
if(!snap.exists() || snap.data().owner!==user.uid){ setError("Partita non trovata."); return }
const d = snap.data()
setGameId(id)
setPlayers(d.players||4)
setRestaurants(d.restaurants||4)
setMode(d.mode||"classic")
setPlayerNames(d.playerNames||[])
setRestaurantNames(d.restaurantNames||[])
setPlayerAvatars(d.playerAvatars||[])
setRestaurantAvatars(d.restaurantAvatars||[])
setVotes(d.votes||[])
setCurrentRestaurant(d.currentRestaurant!= null ? Math.min(d.currentRestaurant, (d.restaurants||4)-1) : 0)
setReveal(false)
const status = d.status||"setup"
if(status==="result"){ setBg("bg3"); setReveal(true) }
else if(status==="vote") setBg("bg2")
else setBg("bg2")
setScreen(status)
}catch(e){
setError(e?.message||"Errore caricamento partita.")
}finally{
setLoadingGameId(null)
}
}

async function deleteGame(id,e){
e.stopPropagation()
if(!confirm("Eliminare questa partita?")) return
try{
await deleteDoc(doc(db,"games",id))
setMyGames(prev=>prev.filter(g=>g.id!==id))
}catch(err){
setError(err?.message||"Errore eliminazione.")
}
}

function goBack(){
setError(null)
if(screen==="home"){
if(mode!==null) setMode(null)
else signOut(auth).then(()=>{ setScreen("login") })
}
else if(screen==="setup"){ setBg("bg1"); setScreen("home"); fetchMyGames() }
else if(screen==="vote"){ setScreen("setup") }
else if(screen==="result"){ setBg("bg1"); setScreen("home"); setReveal(false); fetchMyGames() }
}

async function login(){
setError(null)
setLoading("login")
try{
await signInWithPopup(auth,googleProvider)
}catch(e){
setError(e?.message||"Errore di accesso. Riprova.")
}finally{
setLoading(null)
}
}

async function createGame(){
setError(null)
setLoading("createGame")
try{
setBg("bg2")
const docRef = await addDoc(collection(db,"games"),{
owner:user.uid,
players,
restaurants,
mode,
status:"setup",
createdAt:Date.now()
})
setGameId(docRef.id)
setPlayerAvatars([])
setRestaurantAvatars([])
setScreen("setup")
}catch(e){
setError(e?.message||"Errore creazione partita. Riprova.")
}finally{
setLoading(null)
}
}

function updatePlayerName(i,val){

const arr=[...playerNames]
arr[i]=val
setPlayerNames(arr)

}

function updateRestaurantName(i,val){

const arr=[...restaurantNames]
arr[i]=val
setRestaurantNames(arr)

}

function updatePlayerAvatar(i,idx){
setPlayerAvatars(prev=>{
const next=[...prev]
while(next.length<=i) next.push(0)
next[i]=idx
return next.slice(0,players)
})
}

function updateRestaurantAvatar(i,idx){
setRestaurantAvatars(prev=>{
const next=[...prev]
while(next.length<=i) next.push(0)
next[i]=idx
return next.slice(0,restaurants)
})
}

function isSetupValid(){
const playersOk = Array.from({length:players}).every((_,i)=> (playerNames[i]||"").trim()!=="")
const restaurantsOk = Array.from({length:restaurants}).every((_,i)=> (restaurantNames[i]||"").trim()!=="")
return playersOk && restaurantsOk
}

async function startGame(){
if(!isSetupValid()){
setError("Inserisci tutti i nomi di giocatori e ristoranti.")
return
}
setError(null)
setLoading("startGame")
const votesInit=[]
for(let i=0;i<restaurants;i++) votesInit.push({...emptyVotes})
setVotes(votesInit)
try{
await setDoc(doc(db,"games",gameId),{
playerNames,
restaurantNames,
playerAvatars: playerAvatars.slice(0,players),
restaurantAvatars: restaurantAvatars.slice(0,restaurants),
votes:votesInit,
status:"vote"
},{merge:true})
setScreen("vote")
}catch(e){
setError(e?.message||"Errore avvio votazione. Riprova.")
}finally{
setLoading(null)
}
}

function selectVote(category,value){

const updated=[...votes]

updated[currentRestaurant]={
...updated[currentRestaurant],
[category]:value
}

setVotes(updated)

}

async function nextRestaurant(){
const next = currentRestaurant + 1
try{
await setDoc(doc(db,"games",gameId),{ votes, currentRestaurant: next },{merge:true})
}catch(_){}
if(currentRestaurant < restaurants-1){
setCurrentRestaurant(next)
}else{
try{ await setDoc(doc(db,"games",gameId),{ status:"result" },{merge:true}) }catch(_){}
setBg("bg3")
setScreen("result")
}
}

function ranking(){

return restaurantNames.map((name,i)=>{

const total = Object.values(votes[i]||{})
.reduce((a,b)=>a+(b||0),0)

return {name,total}

})
.sort((a,b)=>b.total-a.total)

}

const data = ranking()

return(

<>

<div
  className={`background ${bg}`}
></div>

<div className="app">

<div className="appContent">

<div key={screen} className="screenTransition">

{screen==="login" &&(

<div className="homeContent">
<h1>Forchette & Polpette</h1>
{error && <p className="errorMsg">{error}</p>}
<button onClick={login} disabled={loading==="login"}>
{loading==="login" ? "Caricamento…" : "Login con Google"}
</button>
</div>

)}

{screen==="home" &&(

<div className="homeContent">
      {error && <p className="errorMsg">{error}</p>}
      <div className="welcomeRow">
      {user?.photoURL && <img src={user.photoURL} alt="" className="avatar" />}
      <h2>Benvenuto {user?.displayName}</h2>
      </div>
      <h3>Modalità gioco</h3>
      
      {mode===null && (
      <>
      <div className="modeButtons">
      
      <button
      onClick={()=>{
      setMode("classic")
      setPlayers(4)
      setRestaurants(4)
      }}
      >
      Classica
      </button>
      
      <button
      onClick={()=>{
      setMode("custom")
      setPlayers(4)
      setRestaurants(4)
      }}
      >
      Personalizzata
      </button>
      
      <button
      onClick={()=>{
      setMode("oneshot")
      setPlayers(2)
      setRestaurants(1)
      }}
      >
      One shot
      </button>
      
      </div>
      <div className="homeBackWrap">
      <button type="button" className="backButton" onClick={goBack}>Indietro</button>
      </div>
      </>
      )}
      
      {/* Dettaglio modalità CLASSICA: 4 giocatori, 4 ristoranti non modificabili */}
      {mode==="classic" && (
      <>
      <div className="homeBackWrap">
      <button type="button" className="backButton" onClick={goBack}>Indietro</button>
      </div>
      <button className="selected">Classica</button>
      <p>4 giocatori e 4 ristoranti</p>
      <div className="startButtonWrap">
      <button onClick={createGame} disabled={loading==="createGame"}>
      {loading==="createGame" ? "Caricamento…" : "Avvia partita"}
      </button>
      </div>
      </>
      )}
      
      {/* Dettaglio modalità PERSONALIZZATA: slider giocatori e ristoranti da 2 a 8 */}
      {mode==="custom" && (
      <>
      <div className="homeBackWrap">
      <button type="button" className="backButton" onClick={goBack}>Indietro</button>
      </div>
      <button className="selected">Personalizzata</button>
      
      <div className="sliderWrap">
      <h3 className="customLabel">Numero giocatori: {players}</h3>
      <input
      type="range"
      min="2"
      max="8"
      value={players}
      onChange={(e)=>setPlayers(parseInt(e.target.value))}
      />
      </div>
      
      <div className="sliderWrap">
      <h3 className="customLabel">Numero ristoranti: {restaurants}</h3>
      <input
      type="range"
      min="2"
      max="8"
      value={restaurants}
      onChange={(e)=>setRestaurants(parseInt(e.target.value))}
      />
      </div>
      
      <div className="startButtonWrap">
      <button onClick={createGame} disabled={loading==="createGame"}>
      {loading==="createGame" ? "Caricamento…" : "Avvia partita"}
      </button>
      </div>
      </>
      )}
      
      {/* Dettaglio modalità ONE SHOT: 1 ristorante, slider solo per numero giocatori */}
      {mode==="oneshot" && (
      <>
      <div className="homeBackWrap">
      <button type="button" className="backButton" onClick={goBack}>Indietro</button>
      </div>
      <button className="selected">One shot</button>
      
      <div className="sliderWrap">
      <h3 className="customLabel">Numero giocatori: {players}</h3>
      <input
      type="range"
      min="2"
      max="8"
      value={players}
      onChange={(e)=>setPlayers(parseInt(e.target.value))}
      />
      </div>
      
      <p>Ristoranti: 1 (One shot)</p>
      
      <div className="startButtonWrap">
      <button onClick={createGame} disabled={loading==="createGame"}>
      {loading==="createGame" ? "Caricamento…" : "Avvia partita"}
      </button>
      </div>
      </>
      )}

      {myGames.length>0 && mode===null && (
      <>
      <h3 className="sectionTitle">Le tue partite</h3>
      <div className="gameList">
      {myGames.map((g)=>(
      <div key={g.id} className="gameItem">
      <span className="gameLabel">{g.mode==="classic"?"Classica":g.mode==="custom"?"Personalizzata":"One shot"} – {g.restaurants} ristoranti</span>
      <div className="gameItemActions">
      <button type="button" className="smallButton" onClick={()=>loadGame(g.id)} disabled={loadingGameId!=null}>
      {loadingGameId===g.id ? "Caricamento…" : "Riprendi"}
      </button>
      <button type="button" className="smallButton deleteButton" onClick={(e)=>deleteGame(g.id,e)}>
      Elimina
      </button>
      </div>
      </div>
      ))}
      </div>
      </>
      )}

</div>

      )}
      
      {screen==="setup" &&(
      
      <>
      {error && <p className="errorMsg">{error}</p>}
      <h2>Imposta la partita</h2>
      
      <h3>Giocatori</h3>
      
      {Array.from({length:players}).map((_,i)=>(
      <div key={i} className="setupRow">
      <button
      type="button"
      className="avatarTrigger"
      onClick={()=>setOpenPicker({type:"player",i})}
      title="Scegli icona"
      >
      <span className="avatarTriggerEmoji">{PLAYER_AVATARS[playerAvatars[i] ?? 0]}</span>
      </button>
      <input
      type="text"
      placeholder={`Nome giocatore ${i+1}`}
      value={playerNames[i]||""}
      onChange={(e)=>{ setError(null); updatePlayerName(i,e.target.value) }}
      />
      </div>
      ))}
      
      <h3>Ristoranti</h3>
      
      {Array.from({length:restaurants}).map((_,i)=>(
      <div key={i} className="setupRow">
      <button
      type="button"
      className="avatarTrigger"
      onClick={()=>setOpenPicker({type:"restaurant",i})}
      title="Scegli icona"
      >
      <img src={RESTAURANT_AVATARS[restaurantAvatars[i] ?? 0] ?? RESTAURANT_AVATARS[0]} alt="" className="avatarTriggerImg" />
      </button>
      <input
      type="text"
      placeholder={`Nome ristorante ${i+1}`}
      value={restaurantNames[i]||""}
      onChange={(e)=>{ setError(null); updateRestaurantName(i,e.target.value) }}
      />
      </div>
      ))}
      
      {openPicker && (
      <div className="pickerOverlay" onClick={()=>setOpenPicker(null)}>
      <div className="pickerModal" onClick={e=>e.stopPropagation()}>
      <h4>{openPicker.type==="player" ? "Scegli icona giocatore" : "Scegli icona ristorante"}</h4>
      <button type="button" className="pickerClose" onClick={()=>setOpenPicker(null)} aria-label="Chiudi">×</button>
      <div className="pickerGrid">
      {openPicker.type==="player" ? PLAYER_AVATARS.map((emoji,idx)=>(
      <button
      key={idx}
      type="button"
      className="pickerOption"
      onClick={()=>{ updatePlayerAvatar(openPicker.i,idx); setOpenPicker(null) }}
      >
      {emoji}
      </button>
      )) : RESTAURANT_AVATARS.map((src,idx)=>(
      <button
      key={idx}
      type="button"
      className="pickerOption"
      onClick={()=>{ updateRestaurantAvatar(openPicker.i,idx); setOpenPicker(null) }}
      >
      <img src={src} alt="" />
      </button>
      ))}
      </div>
      </div>
      </div>
      )}
      
      {!isSetupValid() && <p className="hintMsg">Compila tutti i nomi per continuare.</p>}
      
      <button onClick={startGame} disabled={loading==="startGame" || !isSetupValid()}>
      {loading==="startGame" ? "Caricamento…" : "Inizia votazione"}
      </button>
      
      </>
      
      )}
      
      
      {screen==="vote" &&(

<>
<p className="voteProgress">Ristorante {currentRestaurant + 1} di {restaurantNames.length}</p>
<h2 className="voteRestaurantTitle">
<img src={RESTAURANT_AVATARS[restaurantAvatars[currentRestaurant] ?? 0] ?? RESTAURANT_AVATARS[0]} alt="" className="restaurantIconImg" />
{restaurantNames[currentRestaurant]}
</h2>

{voteCategories.map(cat=>(

<div key={cat.key} className="voteRow">

<p>{cat.label}</p>

<div className="voteButtons">

{[1,2,3,4,5].map(n=>(

<button
key={n}
className={
votes[currentRestaurant]?.[cat.key]===n
?"selected":""
}
onClick={()=>selectVote(cat.key,n)}
>

{n}

</button>

))}

</div>

</div>

))}

<button onClick={nextRestaurant}>
Prossimo ristorante
</button>

</>

)}

{screen==="result" &&(

<>
<h2>Classifica</h2>

{!reveal &&(

<button onClick={()=>setReveal(true)}>
Apri la busta
</button>

)}

{reveal &&(

<>

{data.map((r,i)=>{
const origIndex = restaurantNames.indexOf(r.name)
const iconSrc = RESTAURANT_AVATARS[restaurantAvatars[origIndex] ?? 0] ?? RESTAURANT_AVATARS[0]
return (
<div key={i} className="resultBlock">
<h3>
<img src={iconSrc} alt="" className="resultIconImg" />
#{i+1} {r.name}
</h3>
<p>{r.total} punti</p>
</div>
)
})}

<BarChart width={320} height={300} data={data}>
<XAxis dataKey="name" tick={{ fill: '#c00', fontSize: 12 }} stroke="#c00"/>
<YAxis tick={{ fill: '#c00', fontSize: 12 }} stroke="#c00"/>
<Tooltip contentStyle={{ color: '#c00', textShadow: '0 0 0 #000' }} itemStyle={{ color: '#c00' }} labelStyle={{ color: '#c00' }}/>
<Bar dataKey="total" fill="#ff5a2c"/>
</BarChart>

</>

)}

</>

)}

</div>

</div>

{screen!=="login" && screen!=="home" && (
<div className="bottomBar">
<button type="button" className="backButton" onClick={goBack}>Indietro</button>
</div>
)}

</div>

</>

)

}
