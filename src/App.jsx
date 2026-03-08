import "./App.css"
import { useState, useEffect, useRef } from "react"
import { db, auth, googleProvider } from "./firebase"
import { signInWithPopup, signOut, onAuthStateChanged, deleteUser, reauthenticateWithPopup } from "firebase/auth"
import { collection, addDoc, doc, setDoc, getDoc, getDocs, query, where, deleteDoc, onSnapshot } from "firebase/firestore"
import { BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts"
import { QRCodeSVG } from "qrcode.react"

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
const [toast,setToast] = useState(null)
const [myGames,setMyGames] = useState([])
const [loadingGameId,setLoadingGameId] = useState(null)
const [openPicker,setOpenPicker] = useState(null)
const [soundEnabled,setSoundEnabled] = useState(true)
const [bonusEnabled,setBonusEnabled] = useState(true)
const [savingNext,setSavingNext] = useState(false)
const [deletingGameId,setDeletingGameId] = useState(null)
const [isOnline,setIsOnline] = useState(typeof navigator!=="undefined"?navigator.onLine:true)
const [voteMode,setVoteMode] = useState("single")
const [joinCode,setJoinCode] = useState("")
const [joinInput,setJoinInput] = useState("")
const [myPlayerIndex,setMyPlayerIndex] = useState(null)
const [joiningGameId,setJoiningGameId] = useState(null)
const [gameOwner,setGameOwner] = useState(null)
const [joinNickname,setJoinNickname] = useState("")
const [lobbyParticipantCount,setLobbyParticipantCount] = useState(0)
const pickerCloseRef = useRef(null)

const voteCategories=[
{key:"location",label:"Posizione"},
{key:"menu",label:"Menu"},
{key:"service",label:"Servizio"},
{key:"price",label:"Conto"},
{key:"bonus",label:"Bonus"}
]

const PLAYER_AVATAR_FILES = ["personaggio1.png"].concat(Array.from({length:19},(_,i)=>`personaggio${i+2}.PNG`))
const RESTAURANT_AVATAR_FILES = ["pizza.png","sushi.png","ramen.png","dumplings.png","steak.png","vegetariano.png","vegano.png","etnico.png","indiano.png","hamburger.png"]
const BASE = (import.meta.env.BASE_URL || "/").replace(/\/?$/, "")
const PLAYER_AVATARS = PLAYER_AVATAR_FILES.map(f=>`${BASE}/avatars/players/${f}`)
const RESTAURANT_AVATARS = RESTAURANT_AVATAR_FILES.map(f=>`${BASE}/avatars/restaurants/${f}`)

function playSound(name){
if(!soundEnabled) return
try{
const snd = new Audio(`${BASE}/sounds/${name}.wav`)
snd.volume = 0.4
snd.play().catch(()=>{})
}catch(_){}
}

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
useEffect(()=>{
if("serviceWorker"in navigator&&!window.location.hostname.includes("localhost")){
navigator.serviceWorker.register("/sw.js").catch(()=>{})
}
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
useEffect(()=>{
if(!toast) return
const t = setTimeout(()=>setToast(null),4000)
return ()=>clearTimeout(t)
},[toast])
useEffect(()=>{
if(openPicker && pickerCloseRef.current) pickerCloseRef.current.focus()
},[openPicker])
useEffect(()=>{
if(screen!=="vote"||voteMode!=="multi"||!gameId) return
const unsub=onSnapshot(doc(db,"games",gameId),(snap)=>{
if(!snap.exists()){ setScreen("home"); setGameId(null); showToast("Partita chiusa dall’host."); return }
const d=snap.data()
setCurrentRestaurant(d.currentRestaurant??0)
setVotes(d.votes||[])
if(d.status==="result"){ setBg("bg3"); setReveal(true); setScreen("result") }
})
return ()=>unsub()
},[screen,voteMode,gameId])
useEffect(()=>{
const on=()=>setIsOnline(true)
const off=()=>setIsOnline(false)
window.addEventListener("online",on)
window.addEventListener("offline",off)
return ()=>{ window.removeEventListener("online",on); window.removeEventListener("offline",off) }
},[])
useEffect(()=>{
const params=new URLSearchParams(typeof window!=="undefined"?window.location.search:"")
const code=params.get("join")
if(code&&user&&screen==="home"&&mode===null){ setJoinInput(code.toUpperCase()); setScreen("join") }
},[user,screen,mode])
useEffect(()=>{
if(screen!=="lobby"||!gameId) return
const unsub=onSnapshot(doc(db,"games",gameId),(snap)=>{
if(!snap.exists()){ setScreen("home"); setGameId(null); showToast("Partita chiusa dall’host."); return }
const participants=snap.data().participants||{}
setLobbyParticipantCount(Object.keys(participants).length)
})
return ()=>unsub()
},[screen,gameId])
useEffect(()=>{
const base="Forchette & Polpette"
if(screen==="lobby"&&joinCode){ document.title=`Entra in partita – ${base}` }
else if(screen==="join"&&joinInput){ document.title=`Codice partita – ${base}` }
else{ document.title=`${base} – 4 Spadellate` }
return ()=>{ document.title="Forchette & Polpette – 4 Spadellate" }
},[screen,joinCode,joinInput])

function showToast(message,type="error"){
setToast({ message, type })
}
function getUserMessage(e,context){
if(!e) return (userMessageFallbacks[context]||"Si è verificato un errore. Riprova.")
if(isAuthError(e)) return "Sessione scaduta. Accedi di nuovo."
const m=(e?.message||"").toLowerCase()
if(m.includes("network")||m.includes("failed to fetch")||m.includes("offline")||m.includes("internet")) return "Controlla la connessione a internet e riprova."
return userMessageFallbacks[context]||"Si è verificato un errore. Riprova."
}
const userMessageFallbacks={
loadGame:"Impossibile caricare la partita. Riprova.",
deleteGame:"Impossibile eliminare la partita. Riprova.",
login:"Impossibile accedere. Controlla la connessione e riprova.",
deleteAccount:"Impossibile cancellare l’account. Riprova più tardi o contatta l’assistenza.",
createGame:"Impossibile creare la partita. Riprova.",
startMultiVote:"Impossibile avviare la votazione. Riprova.",
startGame:"Impossibile avviare la partita. Riprova.",
join:"Impossibile trovare la partita. Controlla il codice o chiedi all’host se è ancora aperta.",
joinNickname:"Impossibile entrare in partita. Riprova.",
nextRestaurant:"Impossibile salvare il voto. Riprova.",
}
function generateJoinCode(){
const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
let code=""
for(let i=0;i<6;i++) code+=chars[Math.floor(Math.random()*chars.length)]
return code
}
function joinUrl(code){
return `${typeof window!=="undefined"?window.location.origin:""}${BASE}/?join=${code}`
}
function isAuthError(e){
const code = e?.code || ""
return code==="permission-denied"||code==="unauthenticated"||code==="auth/network-request-failed"||(typeof e?.message==="string"&&e.message.toLowerCase().includes("auth"))
}
function handleSessionExpired(){
signOut(auth).then(()=>{
setScreen("login")
setUser(null)
showToast("Sessione scaduta. Accedi di nuovo.")
})
}

async function loadGame(id){
setToast(null)
setLoadingGameId(id)
try{
const snap = await getDoc(doc(db,"games",id))
if(!snap.exists() || snap.data().owner!==user.uid){ showToast("Partita non trovata."); return }
const d = snap.data()
setGameId(id)
setGameOwner(d.owner||null)
setPlayers(d.players||4)
setRestaurants(d.restaurants||4)
setMode(d.mode||"classic")
setPlayerNames(d.playerNames||[])
setRestaurantNames(d.restaurantNames||[])
setPlayerAvatars(d.playerAvatars||[])
setRestaurantAvatars(d.restaurantAvatars||[])
setBonusEnabled(d.bonusEnabled!==false)
setVoteMode(d.voteMode||"single")
setJoinCode(d.joinCode||"")
setMyPlayerIndex(d.participants?.[user.uid]??null)
setVotes(d.votes||[])
setCurrentRestaurant(d.currentRestaurant!= null ? Math.min(d.currentRestaurant, (d.restaurants||4)-1) : 0)
setReveal(false)
const status = d.status||"setup"
if(status==="result"){ setBg("bg3"); setReveal(true) }
else if(status==="vote") setBg("bg2")
else setBg("bg2")
setScreen(status)
}catch(e){
if(isAuthError(e)){ handleSessionExpired(); return }
showToast(getUserMessage(e,"loadGame"))
}finally{
setLoadingGameId(null)
}
}

async function deleteGame(id,e){
e.stopPropagation()
if(!confirm("Eliminare questa partita?")) return
setDeletingGameId(id)
try{
await deleteDoc(doc(db,"games",id))
setMyGames(prev=>prev.filter(g=>g.id!==id))
showToast("Partita eliminata.","success")
}catch(err){
if(isAuthError(err)){ handleSessionExpired(); return }
showToast(getUserMessage(err,"deleteGame"))
}finally{
setDeletingGameId(null)
}
}

function goBack(){
setToast(null)
if(screen==="home"){
if(mode!==null) setMode(null)
else signOut(auth).then(()=>{ setScreen("login") })
}
else if(screen==="setup"){ setBg("bg1"); setScreen("home"); fetchMyGames() }
else if(screen==="lobby"){ setScreen("setup") }
else if(screen==="vote"){ setScreen(voteMode==="multi"?"home":"setup") }
else if(screen==="result"){ setBg("bg1"); setScreen("home"); setReveal(false); fetchMyGames() }
else if(screen==="join"||screen==="joinPickName"){ setScreen("home"); setJoinInput(""); setJoinNickname(""); setJoiningGameId(null) }
}

async function login(){
setToast(null)
setLoading("login")
try{
await signInWithPopup(auth,googleProvider)
}catch(e){
if(isAuthError(e)){ handleSessionExpired(); return }
showToast(getUserMessage(e,"login"))
}finally{
setLoading(null)
}
}

async function deleteAccount(){
if(!window.confirm("Vuoi cancellare il tuo account e tutti i dati collegati? Verranno eliminate tutte le partite di cui sei proprietario. Dovrai accedere di nuovo con Google per confermare. Questa azione non si può annullare.")) return
setToast(null)
setLoading("deleteAccount")
try{
const q=query(collection(db,"games"),where("owner","==",user.uid))
const snap=await getDocs(q)
await Promise.all(snap.docs.map(d=>deleteDoc(doc(db,"games",d.id))))
await reauthenticateWithPopup(auth.currentUser,googleProvider)
await deleteUser(auth.currentUser)
setScreen("login")
setUser(null)
showToast("Account e dati cancellati.","success")
}catch(e){
if(isAuthError(e)){ handleSessionExpired(); return }
showToast(getUserMessage(e,"deleteAccount"))
}finally{
setLoading(null)
}
}

async function createGame(){
setToast(null)
setLoading("createGame")
try{
setBg("bg2")
const docRef = await addDoc(collection(db,"games"),{
owner:user.uid,
players,
restaurants,
mode,
voteMode,
status:"setup",
createdAt:Date.now()
})
setGameId(docRef.id)
setGameOwner(user.uid)
setPlayerAvatars([])
setRestaurantAvatars([])
setScreen("setup")
showToast("Partita creata. Imposta i nomi.","success")
}catch(e){
if(isAuthError(e)){ handleSessionExpired(); return }
showToast(getUserMessage(e,"createGame"))
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
showToast("Inserisci tutti i nomi di giocatori e ristoranti.")
return
}
setToast(null)
setLoading("startGame")
try{
if(voteMode==="multi"){
const code=generateJoinCode()
const votesMultiInit=Array.from({length:restaurants},()=>({}))
await setDoc(doc(db,"games",gameId),{
playerNames,
restaurantNames,
playerAvatars: playerAvatars.slice(0,players),
restaurantAvatars: restaurantAvatars.slice(0,restaurants),
bonusEnabled,
voteMode:"multi",
joinCode:code,
votes:votesMultiInit,
participants:{},
status:"lobby",
currentRestaurant:0
},{merge:true})
setVotes(votesMultiInit)
setJoinCode(code)
setScreen("lobby")
showToast("Condividi il codice con i giocatori.","success")
}else{
const votesInit=[]
for(let i=0;i<restaurants;i++) votesInit.push({...emptyVotes})
setVotes(votesInit)
await setDoc(doc(db,"games",gameId),{
playerNames,
restaurantNames,
playerAvatars: playerAvatars.slice(0,players),
restaurantAvatars: restaurantAvatars.slice(0,restaurants),
bonusEnabled,
voteMode:"single",
votes:votesInit,
status:"vote",
currentRestaurant:0
},{merge:true})
setScreen("vote")
showToast("Votazione avviata.","success")
}
}catch(e){
if(isAuthError(e)){ handleSessionExpired(); return }
showToast(getUserMessage(e,"startMultiVote"))
}finally{
setLoading(null)
}
}
async function startMultiVote(){
setLoading("startMultiVote")
try{
await setDoc(doc(db,"games",gameId),{ status:"vote" },{merge:true})
setScreen("vote")
showToast("Votazione avviata.","success")
}catch(e){
if(isAuthError(e)){ handleSessionExpired(); return }
showToast(getUserMessage(e,"startGame"))
}finally{
setLoading(null)
}
}
async function joinWithCode(){
const code=(joinInput||"").trim().toUpperCase()
if(!code||code.length!==6){ showToast("Inserisci un codice di 6 caratteri."); return }
setToast(null)
setJoiningGameId("_")
try{
const q=query(collection(db,"games"),where("joinCode","==",code),where("status","in",["lobby","vote"]))
const snap=await getDocs(q)
if(snap.empty){ showToast("Partita non trovata o già terminata. Controlla il codice o chiedi all’host se è ancora aperta."); return }
const d=snap.docs[0]
const data=d.data()
setGameId(d.id)
setGameOwner(data.owner||null)
setPlayers(data.players||4)
setRestaurants(data.restaurants||4)
setPlayerNames(data.playerNames||[])
setRestaurantNames(data.restaurantNames||[])
setPlayerAvatars(data.playerAvatars||[])
setRestaurantAvatars(data.restaurantAvatars||[])
setVoteMode("multi")
setVotes(data.votes||[])
setCurrentRestaurant(data.currentRestaurant??0)
setBonusEnabled(data.bonusEnabled!==false)
setBg("bg2")
if(data.participants&&data.participants[user.uid]!=null){
setMyPlayerIndex(data.participants[user.uid])
setScreen("vote")
showToast("Bentornato nella partita.","success")
}else{
setScreen("joinPickName")
}
}catch(e){
if(isAuthError(e)){ handleSessionExpired(); return }
showToast(getUserMessage(e,"join"))
}finally{
setJoiningGameId(null)
}
}
async function joinWithNickname(){
const nick=(joinNickname||"").trim()
if(!nick){ showToast("Scrivi un nickname per entrare."); return }
setLoading("joinAsPlayer")
try{
const snap=await getDoc(doc(db,"games",gameId))
if(!snap.exists()){ showToast("Partita non trovata."); return }
const data=snap.data()
const participants=data.participants||{}
const taken=new Set(Object.values(participants))
let freeIndex=null
for(let i=0;i<(data.players||4);i++){ if(!taken.has(i)){ freeIndex=i; break } }
if(freeIndex==null){ showToast("Partita piena."); return }
const updatedNames=[...(data.playerNames||[])];
updatedNames[freeIndex]=nick
await setDoc(doc(db,"games",gameId),{
[`participants.${user.uid}`]:freeIndex,
playerNames:updatedNames
},{merge:true})
setMyPlayerIndex(freeIndex)
setPlayerNames(updatedNames)
setJoinNickname("")
setScreen("vote")
showToast(`Entrato come ${nick}.`,"success")
}catch(e){
if(isAuthError(e)){ handleSessionExpired(); return }
showToast(getUserMessage(e,"joinNickname"))
}finally{
setLoading(null)
}
}

function selectVote(category,value){
playSound("click")
if(voteMode==="multi"&&myPlayerIndex!=null){
const updated=votes.map((v,i)=>i===currentRestaurant?{...v,[String(myPlayerIndex)]:{...(v[String(myPlayerIndex)]||{}),[category]:value}}:v)
setVotes(updated)
setDoc(doc(db,"games",gameId),{ votes:updated },{merge:true}).catch(()=>{})
return
}
const updated=[...votes]
updated[currentRestaurant]={...updated[currentRestaurant],[category]:value}
setVotes(updated)
}

async function nextRestaurant(){
setSavingNext(true)
const next = currentRestaurant + 1
try{
await setDoc(doc(db,"games",gameId),{ votes, currentRestaurant: next },{merge:true})
if(currentRestaurant < restaurants-1){
setCurrentRestaurant(next)
}else{
try{ await setDoc(doc(db,"games",gameId),{ status:"result" },{merge:true}) }catch(_){}
setBg("bg3")
setScreen("result")
}
}catch(e){
if(isAuthError(e)){ handleSessionExpired(); return }
showToast(getUserMessage(e,"nextRestaurant"))
}finally{
setSavingNext(false)
}
}

function ranking(){

return restaurantNames.map((name,i)=>{
const v=votes[i]||{}
let total=0
if(voteMode==="multi"&&typeof v==="object"&&!Array.isArray(v)){
Object.values(v).forEach((o)=>{
if(o&&typeof o==="object") total+=Object.values(o).reduce((a,b)=>a+(b||0),0)
})
}else{
total=Object.values(v).reduce((a,b)=>a+(b||0),0)
}
return {name,total}
}).sort((a,b)=>b.total-a.total)
}

const data = ranking()
const isBusy = loading!=null || loadingGameId!=null || savingNext || deletingGameId!=null

return(

<>

{isBusy && <div className="globalLoadingBar" role="progressbar" aria-hidden="true" />}
{!isOnline && (
<div className="offlineBanner" role="status">
Sei offline. I dati potrebbero non essere aggiornati.
</div>
)}

<a href="#main" className="skipLink">Salta al contenuto</a>

<div className="appWrapper">
<div className={`app ${bg}`}>

<main id="main" className="appContent" aria-busy={isBusy}>

<div key={screen} className="screenTransition">

{screen==="login" &&(

<div className="homeContent">
<h1>Forchette & Polpette</h1>
<button onClick={()=>{ playSound("click"); login() }} disabled={loading==="login"} aria-busy={loading==="login"} aria-label="Accedi con Google" className={loading==="login"?"btnLoading":""}>
{loading==="login" ? "Caricamento…" : "Login con Google"}
</button>
</div>

)}

{screen==="home" &&(

<div className="homeContent">
      <div className="welcomeRow">
      {user?.photoURL && <img src={user.photoURL} alt="" className="avatar" />}
      <h2>Benvenuto {user?.displayName?.split(/\s+/)[0] ?? ""}</h2>
      </div>
      <h3>Modalità gioco</h3>
      <p className="homeIntro">Crea una partita, vota i ristoranti da 1 a 5 e scopri la classifica.</p>
      <div className="homeBackWrap deleteAccountWrap deleteAccountWrap--top">
      <button type="button" className="backButton deleteAccountButton" onClick={deleteAccount} disabled={loading==="deleteAccount"} aria-busy={loading==="deleteAccount"} aria-label="Elimina account e tutti i dati">
      {loading==="deleteAccount" ? "Cancellazione…" : "Cancella account e dati"}
      </button>
      <a href="privacy.html" target="_blank" rel="noopener noreferrer" className="privacyLink">Informativa privacy</a>
      <a href="termini.html" target="_blank" rel="noopener noreferrer" className="privacyLink">Termini di utilizzo</a>
      </div>
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
      <label className="optionRow">
      <input type="checkbox" checked={soundEnabled} onChange={(e)=>setSoundEnabled(e.target.checked)} />
      <span>Audio nella partita</span>
      </label>
<div className="homeBackWrap">
      <button type="button" className="backButton" onClick={()=>{ setJoinInput(""); setScreen("join") }} aria-label="Entra in partita con codice">Entra in partita</button>
      </div>
      <div className="homeBackWrap">
      <button type="button" className="backButton" onClick={goBack} aria-label="Torna alla schermata precedente">Indietro</button>
      </div>
      </>
      )}

      {/* Dettaglio modalità CLASSICA: 4 giocatori, 4 ristoranti non modificabili */}
      {mode==="classic" && (
      <>
      <div className="homeBackWrap">
      <button type="button" className="backButton" onClick={goBack} aria-label="Torna alla schermata precedente">Indietro</button>
      </div>
      <button className="selected">Classica</button>
      <p>4 giocatori e 4 ristoranti</p>
      <h3 className="customLabel">Come votare?</h3>
      <div className="voteModeChoice">
      <button type="button" className={voteMode==="single"?"selected":""} onClick={()=>setVoteMode("single")}>Tutti da questo dispositivo</button>
      <button type="button" className={voteMode==="multi"?"selected":""} onClick={()=>setVoteMode("multi")}>Ognuno dal proprio (codice partita)</button>
      </div>
<div className="startButtonWrap">
      <button onClick={()=>{ playSound("click"); createGame() }} disabled={loading==="createGame"}>
      {loading==="createGame" ? "Caricamento…" : "Avvia partita"}{voteMode==="multi" ? " (codice/QR)" : ""}
      </button>
      </div>
      </>
      )}

      {/* Dettaglio modalità PERSONALIZZATA: slider giocatori e ristoranti da 2 a 8 */}
      {mode==="custom" && (
      <>
      <div className="homeBackWrap">
      <button type="button" className="backButton" onClick={goBack} aria-label="Torna alla schermata precedente">Indietro</button>
      </div>
      <button className="selected">Personalizzata</button>
      <h3 className="customLabel">Come votare?</h3>
      <div className="voteModeChoice">
      <button type="button" className={voteMode==="single"?"selected":""} onClick={()=>setVoteMode("single")}>Tutti da questo dispositivo</button>
      <button type="button" className={voteMode==="multi"?"selected":""} onClick={()=>setVoteMode("multi")}>Ognuno dal proprio (codice partita)</button>
      </div>
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
      <button onClick={()=>{ playSound("click"); createGame() }} disabled={loading==="createGame"}>
      {loading==="createGame" ? "Caricamento…" : "Avvia partita"}{voteMode==="multi" ? " (codice/QR)" : ""}
      </button>
      </div>
      </>
      )}

      {/* Dettaglio modalità ONE SHOT: 1 ristorante, slider solo per numero giocatori */}
      {mode==="oneshot" && (
      <>
      <div className="homeBackWrap">
      <button type="button" className="backButton" onClick={goBack} aria-label="Torna alla schermata precedente">Indietro</button>
      </div>
      <button className="selected">One shot</button>
      <h3 className="customLabel">Come votare?</h3>
      <div className="voteModeChoice">
      <button type="button" className={voteMode==="single"?"selected":""} onClick={()=>setVoteMode("single")}>Tutti da questo dispositivo</button>
      <button type="button" className={voteMode==="multi"?"selected":""} onClick={()=>setVoteMode("multi")}>Ognuno dal proprio (codice partita)</button>
      </div>
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
      <button onClick={()=>{ playSound("click"); createGame() }} disabled={loading==="createGame"}>
      {loading==="createGame" ? "Caricamento…" : "Avvia partita"}{voteMode==="multi" ? " (codice/QR)" : ""}
      </button>
      </div>
      </>
      )}

      {mode===null && (
      <>
      <h3 className="sectionTitle">Le tue partite</h3>
      {myGames.length===0 ? (
      <p className="hintMsg emptyState">Nessuna partita. Creane una dalla schermata sopra.</p>
      ) : (
      <div className="gameList">
      {myGames.map((g)=>(
      <div key={g.id} className="gameItem">
      <span className="gameLabel">{g.mode==="classic"?"Classica":g.mode==="custom"?"Personalizzata":"One shot"} – {g.restaurants} ristoranti</span>
      <div className="gameItemActions">
      <button type="button" className="smallButton" onClick={()=>loadGame(g.id)} disabled={loadingGameId!=null}>
      {loadingGameId===g.id ? "Caricamento…" : "Riprendi"}
      </button>
      <button type="button" className="smallButton deleteButton" onClick={(e)=>deleteGame(g.id,e)} disabled={deletingGameId!=null}>
      {deletingGameId===g.id ? "Eliminazione…" : "Elimina"}
      </button>
      </div>
      </div>
      ))}
      </div>
      )}
      </>
      )}

</div>

      )}

{screen==="join" &&(
<div className="homeContent">
<h2>Entra in partita</h2>
<p className="hintMsg">Inserisci il codice di 6 caratteri mostrato dall’host.</p>
<input type="text" maxLength={6} value={joinInput} onChange={(e)=>setJoinInput(e.target.value.toUpperCase())} placeholder="CODICE" className="joinCodeInput" />
<button onClick={joinWithCode} disabled={joiningGameId!=null} aria-busy={joiningGameId!=null} className={joiningGameId!=null?"btnLoading":""}>
{joiningGameId!=null ? "Ricerca…" : "Entra"}
</button>
<div className="homeBackWrap">
<button type="button" className="backButton" onClick={()=>{ setScreen("home"); setJoinInput("") }} aria-label="Torna alla home">Indietro</button>
</div>
</div>
)}

{screen==="joinPickName" &&(
<div className="homeContent">
<h2>Inserisci il tuo nickname</h2>
<p className="hintMsg">Come in Kahoot: scrivi il nome con cui vuoi giocare.</p>
<input type="text" maxLength={20} value={joinNickname} onChange={(e)=>setJoinNickname(e.target.value)} placeholder="Il tuo nome" className="joinCodeInput joinNicknameInput" autoFocus />
<button onClick={joinWithNickname} disabled={loading==="joinAsPlayer"} aria-busy={loading==="joinAsPlayer"} className={loading==="joinAsPlayer"?"btnLoading":""}>
{loading==="joinAsPlayer" ? "Entrata…" : "Entra in partita"}
</button>
<div className="homeBackWrap">
<button type="button" className="backButton" onClick={()=>{ setScreen("home"); setGameId(null); setJoinNickname("") }} aria-label="Torna alla home">Indietro</button>
</div>
</div>
)}

{screen==="lobby" &&(
<div className="homeContent lobbyContent">
<h2>Partita pronta</h2>
<p className="lobbyCodeLabel">Codice d’ingresso</p>
<p className="lobbyCode">{joinCode}</p>
<div className="lobbyQR">
<QRCodeSVG value={joinUrl(joinCode)} size={200} level="M" />
</div>
<button type="button" className="backButton lobbyCopyLink" onClick={()=>{ const u=joinUrl(joinCode); navigator.clipboard?.writeText(u).then(()=>{ playSound("click"); showToast("Link copiato. Incollalo in un messaggio per invitare.","success") }).catch(()=>showToast("Impossibile copiare il link.")) }}>
Copia link invito
</button>
<p className="hintMsg">I giocatori aprono il link nel browser (o inquadrano il QR), inseriscono il codice, fanno login Google e scrivono il proprio nickname.</p>
<p className="lobbyCount">{lobbyParticipantCount} / {players} giocatori</p>
<button onClick={()=>{ playSound("click"); startMultiVote() }} disabled={loading==="startMultiVote"} aria-busy={loading==="startMultiVote"} className={loading==="startMultiVote"?"btnLoading":""}>
{loading==="startMultiVote" ? "Avvio…" : lobbyParticipantCount>=players ? "Pronti!" : "Avvia votazione"}
</button>
<div className="homeBackWrap">
<button type="button" className="backButton" onClick={goBack} aria-label="Torna al setup">Indietro</button>
</div>
</div>
)}
      
{screen==="setup" &&(

      <>
      <h2>Imposta la partita</h2>
      
      <h3>Giocatori</h3>
      
      {Array.from({length:players}).map((_,i)=>(
      <div key={i} className="setupRow">
      <button
      type="button"
      className="avatarTrigger"
      onClick={()=>setOpenPicker({type:"player",i})}
      title="Scegli icona"
      aria-label={`Scegli icona giocatore ${i+1}`}
      >
      <img src={PLAYER_AVATARS[playerAvatars[i] ?? 0] ?? PLAYER_AVATARS[0]} alt="" className="avatarTriggerImg" />
      </button>
      <input
      type="text"
      placeholder={`Nome giocatore ${i+1}`}
      value={playerNames[i]||""}
      onChange={(e)=>{ setToast(null); updatePlayerName(i,e.target.value) }}
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
      aria-label={`Scegli icona ristorante ${i+1}`}
      >
      <img src={RESTAURANT_AVATARS[restaurantAvatars[i] ?? 0] ?? RESTAURANT_AVATARS[0]} alt="" className="avatarTriggerImg" />
      </button>
      <input
      type="text"
      placeholder={`Nome ristorante ${i+1}`}
      value={restaurantNames[i]||""}
      onChange={(e)=>{ setToast(null); updateRestaurantName(i,e.target.value) }}
      />
      </div>
      ))}
      
      {openPicker && (
      <div className="pickerOverlay" onClick={()=>setOpenPicker(null)} role="presentation">
      <div className="pickerModal" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="pickerTitle">
      <h4 id="pickerTitle">{openPicker.type==="player" ? "Scegli icona giocatore" : "Scegli icona ristorante"}</h4>
      <button type="button" ref={pickerCloseRef} className="pickerClose" onClick={()=>setOpenPicker(null)} aria-label="Chiudi modal">×</button>
      <div className="pickerGrid">
      {openPicker.type==="player" ? PLAYER_AVATARS.map((src,idx)=>(
      <button
      key={idx}
      type="button"
      className="pickerOption"
      onClick={()=>{ playSound("click"); updatePlayerAvatar(openPicker.i,idx); setOpenPicker(null) }}
      aria-label={`Icona giocatore ${idx+1}`}
      >
      <img src={src} alt="" />
      </button>
      )) : RESTAURANT_AVATARS.map((src,idx)=>(
      <button
      key={idx}
      type="button"
      className="pickerOption"
      onClick={()=>{ playSound("click"); updateRestaurantAvatar(openPicker.i,idx); setOpenPicker(null) }}
      aria-label={`Icona ristorante ${idx+1}`}
      >
      <img src={src} alt="" />
      </button>
      ))}
      </div>
      </div>
      </div>
      )}
      
      <label className="optionRow">
      <input type="checkbox" checked={bonusEnabled} onChange={(e)=>setBonusEnabled(e.target.checked)} />
      <span>Includi categoria Bonus nella votazione</span>
      </label>
      {!isSetupValid() && <p className="hintMsg">Compila tutti i nomi per continuare.</p>}
      
<button onClick={()=>{ playSound("click"); startGame() }} disabled={loading==="startGame" || !isSetupValid()} aria-busy={loading==="startGame"} className={loading==="startGame"?"btnLoading":""}>
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

{voteMode==="multi"&&user?.uid===gameOwner ? (
<>
<p className="hintMsg">Attendi che tutti votino da proprio dispositivo.</p>
<div className="whoVoted">
{Array.from({length:players}).map((i)=>{
const v=votes[currentRestaurant]||{}
const o=v[String(i)]||{}
const cats=voteCategories.filter(cat=>cat.key!=="bonus"||bonusEnabled)
const hasVoted=cats.every(c=>o[c.key]!=null)
return (
<span key={i} className={hasVoted?"voted":"pending"}>
{playerNames[i]||`Giocatore ${i+1}`}{hasVoted?" ✓":""}
</span>
)})}
</div>
<button onClick={()=>{ playSound("next"); nextRestaurant() }} disabled={savingNext} aria-busy={savingNext} className={savingNext?"btnLoading":""}>
{savingNext ? "Salvataggio…" : "Prossimo ristorante"}
</button>
</>
) : (
<>
{voteCategories.filter(cat=>cat.key!=="bonus"||bonusEnabled).map(cat=>{
const myVotes=voteMode==="multi"&&myPlayerIndex!=null ? (votes[currentRestaurant]||{})[String(myPlayerIndex)]||{} : votes[currentRestaurant]||{}
const sel=voteMode==="multi" ? myVotes[cat.key] : votes[currentRestaurant]?.[cat.key]
return (
<div key={cat.key} className="voteRow">
<p>{cat.label}</p>
<div className="voteButtons">
{[1,2,3,4,5].map(n=>(
<button key={n} className={sel===n?"selected":""} onClick={()=>selectVote(cat.key,n)}>{n}</button>
))}
</div>
</div>
)})}
{voteMode==="single"&&(
<button onClick={()=>{ playSound("next"); nextRestaurant() }} disabled={savingNext} aria-busy={savingNext} className={savingNext?"btnLoading":""}>
{savingNext ? "Salvataggio…" : "Prossimo ristorante"}
</button>
)}
</>
)}

</>
)}

{screen==="result" &&(

<>
<h2>Classifica</h2>

{!reveal &&(

<button onClick={()=>{ playSound("reveal"); setReveal(true) }}>
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

{screen!=="login" && screen!=="home" && screen!=="join" && screen!=="joinPickName" && screen!=="lobby" && (
<div className="bottomBar">
<button type="button" className="backButton" onClick={goBack} aria-label="Torna alla schermata precedente">Indietro</button>
</div>
)}

{toast && (
<div className={`toast toast--${toast.type}`} role="alert" onClick={()=>setToast(null)}>
{toast.message}
</div>
)}

</main>

</div>

</div>

</>

)

}
