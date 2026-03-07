import "./App.css"
import { useState, useEffect } from "react"
import { db, auth, googleProvider } from "./firebase"
import { signInWithPopup, onAuthStateChanged } from "firebase/auth"
import { collection, addDoc, doc, setDoc } from "firebase/firestore"
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
const [votes,setVotes] = useState([])
const [currentRestaurant,setCurrentRestaurant] = useState(0)
const [reveal,setReveal] = useState(false)

const voteCategories=[
{key:"location",label:"Location"},
{key:"menu",label:"Menu"},
{key:"service",label:"Servizio"},
{key:"price",label:"Conto"},
{key:"bonus",label:"Bonus"}
]

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

async function login(){
await signInWithPopup(auth,googleProvider)
}

async function createGame(){

setBg("bg2")

const docRef = await addDoc(collection(db,"games"),{
owner:user.uid,
players,
restaurants,
mode
})

setGameId(docRef.id)
setScreen("setup")

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

async function startGame(){

const votesInit=[]

for(let i=0;i<restaurants;i++){
votesInit.push({...emptyVotes})
}

setVotes(votesInit)

await setDoc(doc(db,"games",gameId),{
playerNames,
restaurantNames,
votes:votesInit
},{merge:true})

setScreen("vote")

}

function selectVote(category,value){

const updated=[...votes]

updated[currentRestaurant]={
...updated[currentRestaurant],
[category]:value
}

setVotes(updated)

}

function nextRestaurant(){

if(currentRestaurant < restaurants-1){

setCurrentRestaurant(currentRestaurant+1)

}else{

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

<div className={`background ${bg}`}></div>

<div className="app">

{screen==="login" &&(

<div className="homeContent">
<h1>Forchette & Polpette</h1>
<button onClick={login}>
Login con Google
</button>
</div>

)}

{screen==="home" &&(

<div className="homeContent">

      <h2>Benvenuto {user?.displayName}</h2>
      
      <h3>Modalità gioco</h3>
      
      {/* Scelta iniziale delle modalità: mostra tutti i bottoni finché non è stata scelta una modalità */}
      {mode===null && (
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
      )}
      
      {/* Dettaglio modalità CLASSICA: 4 giocatori, 4 ristoranti non modificabili */}
      {mode==="classic" && (
      <>
      <button className="selected">Classica</button>
      <p>4 giocatori e 4 ristoranti</p>
      <div className="startButtonWrap">
      <button onClick={createGame}>
      Avvia partita
      </button>
      </div>
      </>
      )}
      
      {/* Dettaglio modalità PERSONALIZZATA: slider giocatori e ristoranti da 2 a 8 */}
      {mode==="custom" && (
      <>
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
      <button onClick={createGame}>
      Avvia partita
      </button>
      </div>
      </>
      )}
      
      {/* Dettaglio modalità ONE SHOT: 1 ristorante, slider solo per numero giocatori */}
      {mode==="oneshot" && (
      <>
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
      <button onClick={createGame}>
      Avvia partita
      </button>
      </div>
      </>
      )}

</div>

      )}
      
      {screen==="setup" &&(
      
      <>
      
      <h2>Imposta la partita</h2>
      
      <h3>Giocatori</h3>
      
      {Array.from({length:players}).map((_,i)=>(
      
      <input
      key={i}
      type="text"
      placeholder={`Nome giocatore ${i+1}`}
      value={playerNames[i]||""}
      onChange={(e)=>updatePlayerName(i,e.target.value)}
      />
      ))}
      
      <h3>Ristoranti</h3>
      
      {Array.from({length:restaurants}).map((_,i)=>(
      
      <input
      key={i}
      type="text"
      placeholder={`Nome ristorante ${i+1}`}
      value={restaurantNames[i]||""}
      onChange={(e)=>updateRestaurantName(i,e.target.value)}
      />
      ))}
      
      <button onClick={startGame}>
      Inizia votazione
      </button>
      
      </>
      
      )}
      
      
      {screen==="vote" &&(

<>

<h2>{restaurantNames[currentRestaurant]}</h2>

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

{data.map((r,i)=>(

<div key={i} className="resultBlock">

<h3>
#{i+1} {r.name}
</h3>

<p>{r.total} punti</p>

</div>

))}

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

</>

)

}
