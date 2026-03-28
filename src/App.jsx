import "./App.css"
import { useState, useEffect, useRef, useCallback } from "react"
import { db, auth, googleProvider } from "./firebase"
import { signInWithPopup, signOut, onAuthStateChanged, deleteUser, reauthenticateWithPopup } from "firebase/auth"
import { collection, addDoc, doc, setDoc, getDoc, getDocs, query, where, deleteDoc, onSnapshot, writeBatch } from "firebase/firestore"
import { QRCodeSVG } from "qrcode.react"

function ModeDetails({
title,
info,
voteMode,
setVoteMode,
gameName,
setGameName,
players,
restaurants,
setPlayers,
setRestaurants,
playSound,
createGame,
loadingCreate,
isOneShot,
onBack,
showSliders,
showRestaurantSlider,
}) {
return (
<>
<button className="selected">{title}</button>
{info && <p>{info}</p>}
<div className="homeGameNameWrap" role="group" aria-labelledby="homeGameNameLabel">
<span id="homeGameNameLabel" className="setupGameNameLabel">Nome partita (opzionale)</span>
<input
type="text"
placeholder="es. Cena di compleanno"
value={gameName||""}
onChange={(e)=>setGameName(e.target.value)}
maxLength={60}
className="setupGameNameInput"
aria-label="Nome partita opzionale"
/>
</div>
<h3 className="customLabel">Come votare?</h3>
<div className="voteModeChoice">
<button
type="button"
className={voteMode==="single"?"selected":""}
onClick={()=>setVoteMode("single")}
>
Tutti da questo dispositivo
</button>
<button
type="button"
className={voteMode==="multi"?"selected":""}
onClick={()=>setVoteMode("multi")}
>
Ognuno dal proprio (codice partita)
</button>
</div>
{showSliders && (
<>
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
{showRestaurantSlider ? (
<div className="sliderWrap">
<h3 className="customLabel">Numero ristoranti: {restaurants}</h3>
<input
type="range"
min={isOneShot?1:2}
max="8"
value={restaurants}
onChange={(e)=>setRestaurants(parseInt(e.target.value))}
/>
</div>
):(
<p>Ristoranti: 1 (One shot)</p>
)}
</>
)}
<div className="startButtonWrap">
<button
onClick={()=>{ playSound("click"); createGame() }}
disabled={loadingCreate==="createGame"}
>
{loadingCreate==="createGame" ? "Caricamento…" : "Avvia partita"}{voteMode==="multi" ? " (codice/QR)" : ""}
</button>
</div>
<div className="homeBackWrap">
<button type="button" className="backButton" onClick={onBack} aria-label="Torna alla schermata precedente">
Indietro
</button>
</div>
</>
)
}

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
const [currentPlayerTurn,setCurrentPlayerTurn] = useState(0)
const [reveal,setReveal] = useState(false)
const [revealPhase,setRevealPhase] = useState(null)
const [countdownNum,setCountdownNum] = useState(3)
const [resultRevealStep,setResultRevealStep] = useState(0)
const [resultDetailIndex,setResultDetailIndex] = useState(null)

const [loading,setLoading] = useState(null)
const [toast,setToast] = useState(null)
const [myGames,setMyGames] = useState([])
const [myGamesCategory,setMyGamesCategory] = useState("salvate")
const [loadingGameId,setLoadingGameId] = useState(null)
const [openPicker,setOpenPicker] = useState(null)
const [soundEnabled,setSoundEnabled] = useState(true)
const [bonusEnabled,setBonusEnabled] = useState(true)
const [bonusLabel,setBonusLabel] = useState("")
const [savingNext,setSavingNext] = useState(false)
const [savingPartita,setSavingPartita] = useState(false)
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
const [voteSavedAt,setVoteSavedAt] = useState(null)
const [voteSaveSyncing,setVoteSaveSyncing] = useState(false)
const [voteSaveError,setVoteSaveError] = useState(null)
const votesRef = useRef(votes)
const [gameName,setGameName] = useState("")
const [loginMessage,setLoginMessage] = useState(null)
const pickerCloseRef = useRef(null)
const multiSaveTimeoutRef = useRef(null)

useEffect(()=>{ votesRef.current = votes },[votes])

useEffect(()=>{
if(screen!=="vote"){
if(multiSaveTimeoutRef.current){ clearTimeout(multiSaveTimeoutRef.current); multiSaveTimeoutRef.current=null }
setVoteSaveSyncing(false)
setVoteSaveError(null)
}
},[screen])

const voteCategories=[
{key:"location",label:"Atmosfera"},
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
}catch{
void 0
}
}

useEffect(()=>{
onAuthStateChanged(auth,(u)=>{
if(u){
setUser(u)
setScreen("home")
}else{
setUser(null)
setScreen("login")
}
})
},[])
useEffect(()=>{
if("serviceWorker"in navigator && import.meta.env.PROD && !window.location.hostname.includes("localhost")){
navigator.serviceWorker.register("/sw.js").catch(()=>{})
}
},[])

const fetchMyGames = useCallback(async ()=>{
if(!user) return
try{
const q = query(collection(db,"games"), where("owner","==",user.uid))
const snap = await getDocs(q)
const list = snap.docs.map(d=>({ id: d.id, ...d.data() }))
list.sort((a,b)=>(b.createdAt||0)-(a.createdAt||0))
setMyGames(list.slice(0,15))
}catch{
setMyGames([])
}
},[user])

useEffect(()=>{ fetchMyGames() },[fetchMyGames])
useEffect(()=>{ if(screen==="setup") fetchMyGames() },[screen, fetchMyGames])
useEffect(()=>{ if(screen!=="setup") setOpenPicker(null) },[screen])
useEffect(()=>{
if(!toast) return
const t = setTimeout(()=>setToast(null),4000)
return ()=>clearTimeout(t)
},[toast])
useEffect(()=>{
if(!voteSavedAt) return
const t = setTimeout(()=>setVoteSavedAt(null),2000)
return ()=>clearTimeout(t)
},[voteSavedAt])
useEffect(()=>{
if(screen!=="vote"||voteMode!=="multi"||!gameId) return
const unsub=onSnapshot(doc(db,"games",gameId),(snap)=>{
if(!snap.exists()){ setScreen("home"); setGameId(null); showToast("Partita chiusa dall’host."); return }
const d=snap.data()
setCurrentRestaurant(d.currentRestaurant??0)
setVotes(d.votes||[])
if(d.status==="result"){ setBg("bg3"); setReveal(true); setRevealPhase("done"); setResultRevealStep(0); setScreen("result") }
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
if(!bonusEnabled && bonusLabel){
setBonusLabel("")
}
},[bonusEnabled, bonusLabel])
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

useEffect(()=>{
if(revealPhase!=="counting") return
const t1=setTimeout(()=>{ setCountdownNum(2); playSound("click"); }, 800)
const t2=setTimeout(()=>{ setCountdownNum(1); playSound("click"); }, 1600)
const t3=setTimeout(()=>{ setRevealPhase("done"); setReveal(true); setResultRevealStep(0); playSound("next"); setCountdownNum(3); }, 2400)
return ()=>{ clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); }
// playSound usa soundEnabled dal render; aggiungerlo qui resetterebbe i timer al toggle audio
// eslint-disable-next-line react-hooks/exhaustive-deps
},[revealPhase])

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
setLoginMessage("Sessione scaduta. Accedi di nuovo.")
})
}

const flushMultiVoteSave = useCallback(async (opts = {}) => {
const showBar = opts.showSyncing === true
if(voteMode!=="multi"||myPlayerIndex==null||!gameId) return
if(multiSaveTimeoutRef.current){
clearTimeout(multiSaveTimeoutRef.current)
multiSaveTimeoutRef.current=null
}
if(showBar) setVoteSaveSyncing(true)
try{
await setDoc(doc(db,"games",gameId),{ votes:votesRef.current },{merge:true})
setVoteSaveSyncing(false)
setVoteSaveError(null)
setVoteSavedAt(Date.now())
}catch(e){
setVoteSaveSyncing(false)
if(isAuthError(e)){ handleSessionExpired(); throw e }
setVoteSaveError(getUserMessage(e,"nextRestaurant"))
throw e
}
// getUserMessage è definito nello stesso render; includerlo instabilizza il callback
// eslint-disable-next-line react-hooks/exhaustive-deps -- vedi sopra
},[voteMode,myPlayerIndex,gameId])

useEffect(()=>{
const flushIfHidden=()=>{
if(voteMode!=="multi"||myPlayerIndex==null||!gameId) return
if(document.visibilityState==="hidden") void flushMultiVoteSave({ showSyncing:false })
}
const onPageHide=()=>{
if(voteMode!=="multi"||myPlayerIndex==null||!gameId) return
void flushMultiVoteSave({ showSyncing:false })
}
document.addEventListener("visibilitychange",flushIfHidden)
window.addEventListener("pagehide",onPageHide)
return ()=>{
document.removeEventListener("visibilitychange",flushIfHidden)
window.removeEventListener("pagehide",onPageHide)
}
},[voteMode,myPlayerIndex,gameId,flushMultiVoteSave])

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
setBonusLabel(d.bonusLabel||"")
setVoteMode(d.voteMode||"single")
setJoinCode(d.joinCode||"")
setGameName(d.gameName||"")
setMyPlayerIndex(d.participants?.[user.uid]??null)
setVotes(d.votes||[])
setCurrentRestaurant(d.currentRestaurant!= null ? Math.min(d.currentRestaurant, (d.restaurants||4)-1) : 0)
setCurrentPlayerTurn(d.currentPlayerTurn != null ? Math.min(d.currentPlayerTurn, (d.players||4)-1) : 0)
setReveal(false)
const status = d.status||"setup"
if(status==="result"){ setBg("bg3"); setReveal(true); setRevealPhase("done"); setResultRevealStep(0) }
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
const gSnap=await getDoc(doc(db,"games",id))
const jc=(gSnap.exists()&&gSnap.data().joinCode)?String(gSnap.data().joinCode):""
if(jc){
try{ await deleteDoc(doc(db,"joinCodes",jc)) }catch{ void 0 }
}
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
else if(screen==="vote"){ setScreen(voteMode==="multi"?"home":"setup"); fetchMyGames() }
else if(screen==="result"){ setBg("bg1"); setScreen("home"); setReveal(false); setRevealPhase(null); setCountdownNum(3); setResultRevealStep(0); setResultDetailIndex(null); fetchMyGames() }
else if(screen==="join"||screen==="joinPickName"){ setScreen("home"); setJoinInput(""); setJoinNickname(""); setJoiningGameId(null) }
}

async function login(){
setToast(null)
setLoginMessage(null)
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
for(const d of snap.docs){
const jc=d.data()?.joinCode?String(d.data().joinCode):""
if(jc){
try{ await deleteDoc(doc(db,"joinCodes",jc)) }catch{ void 0 }
}
await deleteDoc(doc(db,"games",d.id))
}
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
setCurrentRestaurant(0)
setCurrentPlayerTurn(0)
setPlayerNames(Array.from({length:players},(_,i)=> i===0 ? (user?.displayName?.split(/\s+/)[0]?.trim() || "") : ""))
setRestaurantNames(Array.from({length:restaurants},()=>""))
setBonusLabel("")
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
const gameRef=doc(db,"games",gameId)
const batch=writeBatch(db)
batch.set(gameRef,{
playerNames,
restaurantNames,
playerAvatars: playerAvatars.slice(0,players),
restaurantAvatars: restaurantAvatars.slice(0,restaurants),
bonusEnabled,
bonusLabel:(bonusLabel||"").trim()||null,
voteMode:"multi",
gameName:(gameName||"").trim()||null,
joinCode:code,
votes:votesMultiInit,
participants:{},
status:"lobby",
currentRestaurant:0
},{merge:true})
batch.set(doc(db,"joinCodes",code),{ gameId },{merge:false})
await batch.commit()
setVotes(votesMultiInit)
setCurrentRestaurant(0)
setJoinCode(code)
setScreen("lobby")
showToast("Condividi il codice con i giocatori.","success")
}else{
const votesInit=Array.from({length:restaurants},()=>({}))
setVotes(votesInit)
setCurrentRestaurant(0)
setCurrentPlayerTurn(0)
await setDoc(doc(db,"games",gameId),{
playerNames,
restaurantNames,
playerAvatars: playerAvatars.slice(0,players),
restaurantAvatars: restaurantAvatars.slice(0,restaurants),
bonusEnabled,
bonusLabel:(bonusLabel||"").trim()||null,
voteMode:"single",
gameName:(gameName||"").trim()||null,
votes:votesInit,
status:"vote",
currentRestaurant:0,
currentPlayerTurn:0
},{merge:true})
setScreen("vote")
showToast("Votazione avviata.","success")
}
}catch(e){
if(isAuthError(e)){ handleSessionExpired(); return }
showToast(getUserMessage(e,"startGame"))
}finally{
setLoading(null)
}
}
async function startMultiVote(){
setLoading("startMultiVote")
try{
setCurrentRestaurant(0)
await setDoc(doc(db,"games",gameId),{ status:"vote", currentRestaurant: 0 },{merge:true})
setScreen("vote")
showToast("Votazione avviata.","success")
}catch(e){
if(isAuthError(e)){ handleSessionExpired(); return }
showToast(getUserMessage(e,"startMultiVote"))
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
const jcSnap=await getDoc(doc(db,"joinCodes",code))
if(!jcSnap.exists()){
showToast("Partita non trovata o codice non valido. Chiedi all’host di aver avviato la lobby dopo l’ultimo aggiornamento dell’app.")
return
}
const gid=jcSnap.data()?.gameId
if(!gid||typeof gid!=="string"){
showToast("Dati del codice partita non validi. Riprova o chiedi un nuovo codice.")
return
}
const snap=await getDoc(doc(db,"games",gid))
if(!snap.exists()){
showToast("Partita non trovata o già terminata.")
return
}
const data=snap.data()
const st=data.status
const vm=data.voteMode
if(vm!=="multi"||(st!=="lobby"&&st!=="vote")){
showToast("Partita non trovata o già terminata. Controlla il codice o chiedi all’host se è ancora aperta.")
return
}
setGameId(gid)
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
setCurrentPlayerTurn(0)
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
if(freeIndex==null){ showToast("Partita piena. Chiedi all'host di avviare una nuova partita."); return }
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
votesRef.current=updated
setVotes(updated)
setVoteSaveError(null)
if(multiSaveTimeoutRef.current) clearTimeout(multiSaveTimeoutRef.current)
multiSaveTimeoutRef.current=setTimeout(()=>{
multiSaveTimeoutRef.current=null
void flushMultiVoteSave({ showSyncing:false })
},350)
return
}
if(voteMode==="single"){
const key=String(currentPlayerTurn)
const updated=[...votes]
const rest={...updated[currentRestaurant]}
rest[key]={...(rest[key]||{}),[category]:value}
updated[currentRestaurant]=rest
setVotes(updated)
return
}
const updated=[...votes]
updated[currentRestaurant]={...updated[currentRestaurant],[category]:value}
setVotes(updated)
}

async function nextRestaurant(){
setSavingNext(true)
try{
if(voteMode==="single"){
const nextPlayer=currentPlayerTurn+1
if(nextPlayer<players){
setCurrentPlayerTurn(nextPlayer)
await setDoc(doc(db,"games",gameId),{ votes, currentRestaurant, currentPlayerTurn: nextPlayer },{merge:true})
}else{
const nextRest=currentRestaurant+1
setCurrentPlayerTurn(0)
if(nextRest<restaurants){
setCurrentRestaurant(nextRest)
await setDoc(doc(db,"games",gameId),{ votes, currentRestaurant: nextRest, currentPlayerTurn: 0 },{merge:true})
}else{
try{ await setDoc(doc(db,"games",gameId),{ status:"result" },{merge:true}) }catch{ void 0 }
setBg("bg3")
setScreen("result")
}
}
return
}
const next = currentRestaurant + 1
await setDoc(doc(db,"games",gameId),{ votes, currentRestaurant: next },{merge:true})
if(currentRestaurant < restaurants-1){
setCurrentRestaurant(next)
}else{
try{ await setDoc(doc(db,"games",gameId),{ status:"result" },{merge:true}) }catch{ void 0 }
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

async function savePartita(){
if(!gameId) return
setSavingPartita(true)
try{
if(voteMode==="multi"&&myPlayerIndex!=null){
await flushMultiVoteSave({ showSyncing:true })
}
const payload = voteMode==="single" ? { votes, currentRestaurant, currentPlayerTurn } : { votes: votesRef.current, currentRestaurant }
await setDoc(doc(db,"games",gameId), payload,{merge:true})
showToast("Partita salvata.","success")
}catch(e){
if(isAuthError(e)){ handleSessionExpired(); return }
showToast(getUserMessage(e,"nextRestaurant"))
}finally{
setSavingPartita(false)
}
}

function ranking(){
if(!Array.isArray(restaurantNames)) return []
const v = votes || {}
return restaurantNames.map((name,i)=>{
const vv = v[i]||{}
let total=0
try {
const isPerPlayer=typeof vv==="object"&&!Array.isArray(vv)&&Object.keys(vv).length>0&&typeof Object.values(vv)[0]==="object"
if(isPerPlayer){
Object.values(vv).forEach((o)=>{
if(o&&typeof o==="object") total+=Object.values(o).reduce((a,b)=>a+(b||0),0)
})
}else{
total=Object.values(vv).reduce((a,b)=>a+(b||0),0)
}
} catch { void 0 }
return { name: String(name||""), total }
}).sort((a,b)=>b.total-a.total)
}

function whoVotedLikeMe(){
if(voteMode!=="multi"||myPlayerIndex==null) return []
const categories = voteCategories.filter(cat=>cat.key!=="bonus"||bonusEnabled)
const result = []
for(let p=0;p<players;p++){
if(p===myPlayerIndex) continue
let sameCount = 0
for(let r=0;r<restaurants;r++){
const myV = (votes[r]||{})[String(myPlayerIndex)]||{}
const theirV = (votes[r]||{})[String(p)]||{}
if(!myV||!theirV) continue
categories.forEach(cat=>{
if(myV[cat.key]!=null && myV[cat.key]===theirV[cat.key]) sameCount++
})
}
result.push({ playerIndex: p, name: (playerNames[p]||"").trim() || `Giocatore ${p+1}`, sameCount })
}
return result.sort((a,b)=>b.sameCount-a.sameCount)
}

function getVoteBreakdownDetailed(restaurantIndex){
const v = (votes||{})[restaurantIndex]||{}
const categories = voteCategories.filter(cat=>cat.key!=="bonus"||bonusEnabled)
const firstKey = Object.keys(v).sort((a,b)=>Number(a)-Number(b))[0]
const sample = firstKey!=null ? v[firstKey] : null
const isPerPlayer = typeof sample==="object" && sample!==null && !Array.isArray(sample)
const usePlayerRows = isPerPlayer || (voteMode==="multi" && players>0)
return categories.map(cat=>{
const label = cat.key==="bonus" && (typeof bonusLabel==="string"&&bonusLabel.trim()) ? `Bonus – ${bonusLabel.trim()}` : cat.label
const byPlayer = []
let total = 0
if(usePlayerRows){
for(let p=0;p<players;p++){
const pv = v[String(p)]
const pname = (playerNames[p]||"").trim() || `Giocatore ${p+1}`
if(pv&&typeof pv==="object"){
const val = pv[cat.key]
const num = Number(val)
if(!Number.isNaN(num)) total += num
byPlayer.push({ name: pname, value: val!=null&&val!=="" ? val : null })
}else{
byPlayer.push({ name: pname, value: null })
}
}
}else{
const val = v[cat.key]
const num = Number(val)
if(!Number.isNaN(num)) total += num
byPlayer.push({ name: voteMode==="single" ? "Voti (questo dispositivo)" : "Voto", value: val!=null&&val!=="" ? val : null })
}
return { key: cat.key, label, total, byPlayer }
})
}

const data = ranking()
const maxRevealStep = data.length >= 3 ? data.length + 1 : data.length
useEffect(()=>{
if(screen!=="result"||!reveal||data.length===0) return
if(resultRevealStep>=maxRevealStep) return
const t=setTimeout(()=>setResultRevealStep(s=>Math.min(s+1,maxRevealStep)),1200)
return ()=>clearTimeout(t)
},[screen,reveal,data.length,resultRevealStep,maxRevealStep])

const isBusy = loading!=null || loadingGameId!=null || savingNext || savingPartita || deletingGameId!=null

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

<div className="homeScreen">
<header className="homeHeader" aria-hidden="true" />
<div className="homeBody">
<h1 className="srOnly">Forchette & Polpette</h1>
<button onClick={()=>{ playSound("click"); login() }} disabled={loading==="login"} aria-busy={loading==="login"} aria-label="Accedi con Google" className={loading==="login"?"btnLoading":""}>
{loading==="login" ? "Caricamento…" : "Login con Google"}
</button>
{loginMessage && <p className="loginMessage" role="status">{loginMessage}</p>}
</div>
</div>

)}

{screen==="home" &&(

<div className="homeScreen">
      <header className="homeHeader" aria-hidden="true" />
      <div className="homeBody">
      <div className="welcomeRow">
      {user?.photoURL && <img src={user.photoURL} alt="" className="avatar" />}
      <h2>Benvenuto {user?.displayName?.split(/\s+/)[0] ?? ""}</h2>
      </div>
      <h3>Modalità gioco</h3>
      <p className="homeIntro">Crea una partita, vota i ristoranti da 1 a 5 e scopri la classifica.</p>
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
      <ModeDetails
      title="Classica"
      info="4 giocatori e 4 ristoranti"
      voteMode={voteMode}
      setVoteMode={setVoteMode}
      gameName={gameName}
      setGameName={setGameName}
      players={players}
      restaurants={restaurants}
      setPlayers={setPlayers}
      setRestaurants={setRestaurants}
      playSound={playSound}
      createGame={createGame}
      loadingCreate={loading}
      isOneShot={false}
      onBack={goBack}
      showSliders={false}
      showRestaurantSlider={false}
      />
      )}

      {/* Dettaglio modalità PERSONALIZZATA: slider giocatori e ristoranti da 2 a 8 */}
      {mode==="custom" && (
      <ModeDetails
      title="Personalizzata"
      info={null}
      voteMode={voteMode}
      setVoteMode={setVoteMode}
      gameName={gameName}
      setGameName={setGameName}
      players={players}
      restaurants={restaurants}
      setPlayers={setPlayers}
      setRestaurants={setRestaurants}
      playSound={playSound}
      createGame={createGame}
      loadingCreate={loading}
      isOneShot={false}
      onBack={goBack}
      showSliders={true}
      showRestaurantSlider={true}
      />
      )}

      {/* Dettaglio modalità ONE SHOT: 1 ristorante, slider solo per numero giocatori */}
      {mode==="oneshot" && (
      <ModeDetails
      title="One shot"
      info={null}
      voteMode={voteMode}
      setVoteMode={setVoteMode}
      gameName={gameName}
      setGameName={setGameName}
      players={players}
      restaurants={restaurants}
      setPlayers={setPlayers}
      setRestaurants={setRestaurants}
      playSound={playSound}
      createGame={createGame}
      loadingCreate={loading}
      isOneShot={true}
      onBack={goBack}
      showSliders={true}
      showRestaurantSlider={false}
      />
      )}

      {mode===null && (
      <>
      <h3 className="sectionTitle">Le tue partite</h3>
      <div className="myGamesCategoryWrap" role="group" aria-label="Categoria partite">
      <button type="button" className={myGamesCategory==="salvate"?"selected":""} onClick={()=>setMyGamesCategory("salvate")}>
      Partite salvate
      </button>
      <button type="button" className={myGamesCategory==="giocate"?"selected":""} onClick={()=>setMyGamesCategory("giocate")}>
      Partite giocate
      </button>
      </div>
      {(()=>{
      const filtered = myGamesCategory==="giocate" ? myGames.filter(g=>g.status==="result") : myGames.filter(g=>g.status!=="result")
      if(filtered.length===0) return (
      <p className="hintMsg emptyState">
      {myGamesCategory==="giocate" ? "Nessuna partita giocata. Le partite finite appariranno qui." : "Nessuna partita salvata. Le partite in corso appariranno qui."}
      </p>
      )
      return (
      <div className="gameList">
      {filtered.map((g)=>(
      <div key={g.id} className="gameItem">
      <span className="gameLabel">{g.gameName && g.gameName.trim() ? g.gameName.trim() : `${g.mode==="classic"?"Classica":g.mode==="custom"?"Personalizzata":"One shot"} – ${g.restaurants} ristoranti`}</span>
      <div className="gameItemActions">
      <button type="button" className="smallButton" onClick={()=>loadGame(g.id)} disabled={loadingGameId!=null}>
      {loadingGameId===g.id ? "Caricamento…" : myGamesCategory==="giocate" ? "Vedi classifica" : "Riprendi"}
      </button>
      <button type="button" className="smallButton deleteButton" onClick={(e)=>deleteGame(g.id,e)} disabled={deletingGameId!=null}>
      {deletingGameId===g.id ? "Eliminazione…" : "Elimina"}
      </button>
      </div>
      </div>
      ))}
      </div>
      )
      })()}
      </>
      )}

      <div className="homeBackWrap deleteAccountWrap homeLegalStrip">
      <button type="button" className="backButton deleteAccountButton" onClick={deleteAccount} disabled={loading==="deleteAccount"} aria-busy={loading==="deleteAccount"} aria-label="Elimina account e tutti i dati">
      {loading==="deleteAccount" ? "Cancellazione…" : "Cancella account e dati"}
      </button>
      <a href="privacy.html" target="_blank" rel="noopener noreferrer" className="privacyLink">Informativa privacy</a>
      <a href="termini.html" target="_blank" rel="noopener noreferrer" className="privacyLink">Termini di utilizzo</a>
      </div>

</div>
      </div>

      )}

{screen==="join" &&(
<div className="homeScreen">
<header className="homeHeader" aria-hidden="true" />
<div className="homeBody">
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
</div>
)}

{screen==="joinPickName" &&(
<div className="homeScreen">
<header className="homeHeader" aria-hidden="true" />
<div className="homeBody">
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
<p className="hintMsg">I giocatori aprono il link nel browser (o inquadrano il QR), inseriscono il codice, fanno login Google e scrivono il proprio nickname. Se chiudono la pagina possono riaprire lo stesso link per rientrare.</p>
<p className="lobbyCount">Giocatori collegati: {lobbyParticipantCount} / {players}</p>
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
      <div
      className={`pickerModal pickerModal--${openPicker.type}`}
      onClick={e=>e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="pickerTitle"
      >
      <h4 id="pickerTitle">{openPicker.type==="player" ? "Scegli icona giocatore" : "Scegli icona ristorante"}</h4>
      <button type="button" ref={pickerCloseRef} className="pickerClose" onClick={()=>setOpenPicker(null)} aria-label="Chiudi modal">×</button>
      <div className={`pickerGrid pickerGrid--${openPicker.type==="player"?"players":"restaurants"}`}>
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
      {bonusEnabled && (
      <div className="bonusLabelWrap">
      <input
      type="text"
      className="bonusLabelInput"
      placeholder="Oggetto del bonus"
      value={bonusLabel}
      maxLength={60}
      onChange={(e)=>setBonusLabel(e.target.value)}
      aria-label="Oggetto del bonus"
      />
      </div>
      )}
      {!isSetupValid() && <p className="hintMsg">Compila tutti i nomi per continuare.</p>}
      
<button onClick={()=>{ playSound("click"); startGame() }} disabled={loading==="startGame" || !isSetupValid()} aria-busy={loading==="startGame"} className={loading==="startGame"?"btnLoading":""}>
{loading==="startGame" ? "Caricamento…" : "Inizia votazione"}
</button>
      
      </>
      
      )}
      
      
      {screen==="vote" &&(
<div className="voteScreenWrap">
<p className="voteHeaderLine">
{voteMode==="multi" && user?.uid===gameOwner
  ? `Votazione: ${restaurantNames[currentRestaurant] || ""}`
  : voteMode==="multi" && myPlayerIndex!=null
    ? `${playerNames[myPlayerIndex] || "Giocatore " + (myPlayerIndex+1)} vota ${restaurantNames[currentRestaurant] || ""}`
    : voteMode==="single"
      ? `${playerNames[currentPlayerTurn] || "Giocatore " + (currentPlayerTurn+1)} vota ${restaurantNames[currentRestaurant] || ""}`
      : `${restaurantNames[currentRestaurant] || ""}`}
</p>
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
<div className="voteSaveRow">
<button type="button" className="backButton voteSaveButton" onClick={()=>{ playSound("click"); savePartita() }} disabled={savingPartita} aria-busy={savingPartita}>
{savingPartita ? "Salvataggio…" : "Salva la partita"}
</button>
</div>
</>
) : (
<>
{voteMode==="multi" && myPlayerIndex!=null && user?.uid!==gameOwner && (
<p className="hintMsg">Se perdi la connessione riapri lo stesso link: tornerai alla tua scheda di voto.</p>
)}
{voteMode==="multi" && myPlayerIndex!=null && user?.uid!==gameOwner && voteSaveSyncing && (
<p className="voteSaveStatus voteSaveStatus--syncing" role="status">Salvataggio in corso…</p>
)}
{voteMode==="multi" && myPlayerIndex!=null && user?.uid!==gameOwner && voteSaveError && (
<div className="voteSaveStatus voteSaveStatus--errWrap" role="alert">
<p className="voteSaveStatus--error">{voteSaveError}</p>
<button type="button" className="voteRetryBtn" onClick={()=>{ void flushMultiVoteSave({ showSyncing:true }) }}>Riprova salvataggio</button>
</div>
)}
{voteSavedAt && !voteSaveError && !voteSaveSyncing && (
<p className="voteSavedFeedback" role="status">Salvato ✓</p>
)}
{voteCategories.filter(cat=>cat.key!=="bonus"||bonusEnabled).map(cat=>{
const myVotes=voteMode==="multi"&&myPlayerIndex!=null ? (votes[currentRestaurant]||{})[String(myPlayerIndex)]||{} : voteMode==="single" ? (votes[currentRestaurant]||{})[String(currentPlayerTurn)]||{} : votes[currentRestaurant]||{}
const sel=voteMode==="multi" ? myVotes[cat.key] : voteMode==="single" ? myVotes[cat.key] : votes[currentRestaurant]?.[cat.key]
return (
<div key={cat.key} className="voteRow">
<p>{cat.key==="bonus" && bonusLabel.trim() ? `Bonus – ${bonusLabel.trim()}` : cat.label}</p>
<div className="voteButtons">
{[1,2,3,4,5].map(n=>(
<button
key={n}
type="button"
className={sel===n?"selected":""}
onClick={()=>selectVote(cat.key,n)}
aria-label={`Voto ${n}`}
>
{n}
</button>
))}
</div>
</div>
)})}
{voteMode==="single"&&(
<button onClick={()=>{ playSound("next"); nextRestaurant() }} disabled={savingNext} aria-busy={savingNext} className={savingNext?"btnLoading":""}>
{savingNext ? "Salvataggio…" : currentPlayerTurn<players-1 ? "Prossimo giocatore" : currentRestaurant<restaurantNames.length-1 ? "Prossimo ristorante" : "Vedi classifica"}
</button>
)}
<div className="voteSaveRow">
<button type="button" className="backButton voteSaveButton" onClick={()=>{ playSound("click"); savePartita() }} disabled={savingPartita} aria-busy={savingPartita}>
{savingPartita ? "Salvataggio…" : "Salva la partita"}
</button>
</div>
</>
)}

</div>
)}

{screen==="result" &&(

<>
<h2>Classifica</h2>

{revealPhase==="counting" && (
<div className="revealCountdown" role="status" aria-live="polite">
<span className="revealCountdownNum">{countdownNum}</span>
<p className="revealCountdownLabel">La classifica sta per arrivare...</p>
</div>
)}

{!reveal && revealPhase!=="counting" &&(

<button className="openEnvelopeBtn" onClick={()=>{ playSound("reveal"); setRevealPhase("counting"); setCountdownNum(3) }}>
Apri la busta
</button>

)}

{reveal &&(

<div className="resultReveal" role="region" aria-live="polite">

{data.length > 0 && resultRevealStep >= maxRevealStep && (
<p className="resultWinnerLine">🏆 Vincitore: <strong>{data[0].name}</strong></p>
)}

{data.length > 0 && resultRevealStep > 0 && (()=>{
const names = Array.isArray(restaurantNames) ? restaurantNames : []
const avatars = Array.isArray(restaurantAvatars) ? restaurantAvatars : []
function getIcon(r){
if(!r||!r.name) return RESTAURANT_AVATARS[0]
const origIndex = names.indexOf(r.name)
return RESTAURANT_AVATARS[avatars[origIndex] ?? 0] ?? RESTAURANT_AVATARS[0]
}
const n = data.length
if(n<3){
return (
<div className="resultRevealList resultRevealListFromBottom">
{data.slice(n-resultRevealStep).slice().reverse().map((r,i)=>{
const idx = data.indexOf(r)
const rank = idx >= 0 ? idx + 1 : (n - resultRevealStep + i + 1)
const iconSrc = getIcon(r)
const origIndex = names.indexOf(r.name)
return (
<div key={i} className="resultBlock resultRevealCard resultBlockClickable" role="button" tabIndex={0} onClick={()=>origIndex>=0&&setResultDetailIndex(origIndex)} onKeyDown={e=>{ if(e.key==="Enter"||e.key===" ") { e.preventDefault(); origIndex>=0&&setResultDetailIndex(origIndex) } }} aria-label={`Vedi votazioni per ${r.name}`}>
<h3>
<img src={iconSrc} alt="" className="resultIconImg" />
#{rank} {r.name}
</h3>
<p>{r.total} punti</p>
</div>
)
})}
</div>
)
}
const restCount = n - 3
const restItems = restCount > 0 ? data.slice(n - Math.min(resultRevealStep, restCount)) : []
const showPodium = resultRevealStep >= n - 2
const podiumFilledStep = showPodium ? Math.min(3, Math.max(0, resultRevealStep - (n - 3))) : 0
return (
<>
{showPodium && (
<div className="resultPodiumWrap">
<h3 className="resultPodiumTitle">Podio</h3>
<div className="resultPodium" role="group" aria-label="Primi tre classificati">
<div className="podiumStep podiumSecond" role="button" tabIndex={podiumFilledStep>=2?0:-1} onClick={()=>{ const o=names.indexOf(data[1]?.name); if(o>=0) setResultDetailIndex(o) }} onKeyDown={e=>{ if((e.key==="Enter"||e.key===" ")&&podiumFilledStep>=2){ e.preventDefault(); const o=names.indexOf(data[1]?.name); if(o>=0) setResultDetailIndex(o) } }} aria-label={podiumFilledStep>=2?`Secondo posto, ${data[1]?.name}`:"Secondo posto"}>
<div className="podiumStepInner">
{podiumFilledStep >= 2 && data[1] ? (
<>
<span className="podiumMedal" aria-hidden="true">🥈</span>
<img src={getIcon(data[1])} alt="" className="podiumIcon" />
<span className="podiumName">{data[1].name}</span>
<span className="podiumPoints">{data[1].total} punti</span>
</>
) : (
<span className="podiumEmpty">?</span>
)}
</div>
<div className="podiumPedestal podiumPedestal--second" aria-hidden="true"><span className="podiumPlaceNum">2</span></div>
</div>
<div className="podiumStep podiumFirst" role="button" tabIndex={podiumFilledStep>=3?0:-1} onClick={()=>{ const o=names.indexOf(data[0]?.name); if(o>=0) setResultDetailIndex(o) }} onKeyDown={e=>{ if((e.key==="Enter"||e.key===" ")&&podiumFilledStep>=3){ e.preventDefault(); const o=names.indexOf(data[0]?.name); if(o>=0) setResultDetailIndex(o) } }} aria-label={podiumFilledStep>=3?`Primo posto, ${data[0]?.name}`:"Primo posto"}>
<div className="podiumStepInner">
{podiumFilledStep >= 3 && data[0] ? (
<>
<span className="podiumMedal" aria-hidden="true">🥇</span>
<img src={getIcon(data[0])} alt="" className="podiumIcon podiumIcon--first" />
<span className="podiumName">{data[0].name}</span>
<span className="podiumPoints">{data[0].total} punti</span>
</>
) : (
<span className="podiumEmpty">?</span>
)}
</div>
<div className="podiumPedestal podiumPedestal--first" aria-hidden="true"><span className="podiumPlaceNum">1</span></div>
</div>
<div className="podiumStep podiumThird" role="button" tabIndex={podiumFilledStep>=1?0:-1} onClick={()=>{ const o=names.indexOf(data[2]?.name); if(o>=0) setResultDetailIndex(o) }} onKeyDown={e=>{ if((e.key==="Enter"||e.key===" ")&&podiumFilledStep>=1){ e.preventDefault(); const o=names.indexOf(data[2]?.name); if(o>=0) setResultDetailIndex(o) } }} aria-label={podiumFilledStep>=1?`Terzo posto, ${data[2]?.name}`:"Terzo posto"}>
<div className="podiumStepInner">
{podiumFilledStep >= 1 && data[2] ? (
<>
<span className="podiumMedal" aria-hidden="true">🥉</span>
<img src={getIcon(data[2])} alt="" className="podiumIcon" />
<span className="podiumName">{data[2].name}</span>
<span className="podiumPoints">{data[2].total} punti</span>
</>
) : (
<span className="podiumEmpty">?</span>
)}
</div>
<div className="podiumPedestal podiumPedestal--third" aria-hidden="true"><span className="podiumPlaceNum">3</span></div>
</div>
</div>
</div>
)}
{restCount > 0 && restItems.length > 0 && (
<div className="resultBelowPodium">
<h3 className="resultBelowPodiumTitle">{showPodium ? "Altri classificati" : "Classifica"}</h3>
<ul className="resultRestList" aria-label="Posizioni dalla quarta in giù">
{restItems.map((r)=>{
const idx = data.indexOf(r)
const rank = idx + 1
const iconSrc = getIcon(r)
const origIndex = names.indexOf(r.name)
return (
<li key={`rest-${idx}`} className="resultRestRow resultBlockClickable" role="button" tabIndex={0} onClick={()=>origIndex>=0&&setResultDetailIndex(origIndex)} onKeyDown={e=>{ if(e.key==="Enter"||e.key===" ") { e.preventDefault(); origIndex>=0&&setResultDetailIndex(origIndex) } }} aria-label={`${rank}° posto, ${r.name}, ${r.total} punti. Vedi votazioni`}>
<span className="resultRestRank">{rank}°</span>
<img src={iconSrc} alt="" className="resultRestAvatar" />
<span className="resultRestName">{r.name}</span>
<span className="resultRestPoints">{r.total} <span className="resultRestPtsLabel">pt</span></span>
</li>
)
})}
</ul>
</div>
)}
</>
)
})()}

{voteMode==="multi" && myPlayerIndex!=null && data.length>0 && resultRevealStep>=maxRevealStep && (()=>{
const pals = whoVotedLikeMe()
if(pals.length===0 || pals[0].sameCount===0) return null
const top = pals[0]
const sameLabel = top.sameCount === 1 ? "volta" : "volte"
return (
<div className="whoVotedLikeMeWrap">
<h3 className="whoVotedLikeMeTitle">Chi ha votato come te</h3>
<p className="whoVotedLikeMeText">
Hai votato come <strong>{top.name || `Giocatore ${top.playerIndex+1}`}</strong> per <strong>{top.sameCount}</strong> {sameLabel}.
</p>
{pals.length > 1 && pals[1].sameCount > 0 && (
<p className="whoVotedLikeMeSub">
Anche <strong>{pals[1].name || `Giocatore ${pals[1].playerIndex+1}`}</strong> ha scelto come te per {pals[1].sameCount} {pals[1].sameCount===1?"volta":"volte"}.
</p>
)}
</div>
)})()}

{resultDetailIndex!=null && (()=>{
const name = (restaurantNames[resultDetailIndex]||"").trim() || `Ristorante ${resultDetailIndex+1}`
const breakdown = getVoteBreakdownDetailed(resultDetailIndex)
return (
<div className="resultDetailOverlay" role="dialog" aria-modal="true" aria-labelledby="resultDetailTitle" onClick={()=>setResultDetailIndex(null)}>
<div className="resultDetailPanel" onClick={e=>e.stopPropagation()}>
<h3 id="resultDetailTitle">Votazioni – {name}</h3>
<p className="resultDetailHint">Totale per categoria e voto di ogni partecipante (scala 1–5).</p>
<div className="resultDetailScroll">
{breakdown.map(c=>(
<div key={c.key} className="resultDetailCatBlock">
<div className="resultDetailCatRow">
<span className="resultDetailCatLabel">{c.label}</span>
<strong className="resultDetailCatTotal">{c.total} punti</strong>
</div>
<ul className="resultDetailSubList" aria-label={`Dettaglio ${c.label}`}>
{c.byPlayer.map((row,i)=>(
<li key={`${c.key}-p-${i}`}>
<span className="resultDetailSubName">{row.name}</span>
<span className="resultDetailSubVal" aria-label={row.value!=null?`Voto ${row.value}`:"Nessun voto"}>{row.value!=null?row.value:"—"}</span>
</li>
))}
</ul>
</div>
))}
</div>
<button type="button" className="resultDetailClose" onClick={()=>setResultDetailIndex(null)}>Chiudi</button>
</div>
</div>
)
})()}

</div>
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
