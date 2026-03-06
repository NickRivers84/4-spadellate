import { useState } from "react";

export default function App(){

const [screen,setScreen] = useState("home")
const [mode,setMode] = useState(null)

const [players,setPlayers] = useState(4)
const [restaurants,setRestaurants] = useState(4)

const [playerNames,setPlayerNames] = useState([])
const [restaurantNames,setRestaurantNames] = useState([])

const [currentPlayer,setCurrentPlayer] = useState(0)
const [currentRestaurant,setCurrentRestaurant] = useState(0)

const [allVotes,setAllVotes] = useState([])

const [votes,setVotes] = useState({
location:null,
menu:null,
service:null,
price:null,
bonus:null
})

const voteCategories=[
{key:"location",label:"Location"},
{key:"menu",label:"Menu"},
{key:"service",label:"Servizio"},
{key:"price",label:"Conto"},
{key:"bonus",label:"Bonus"}
]

function startClassic(){
setMode("classic")
setPlayers(4)
setRestaurants(4)
setScreen("setup")
}

function startOneShot(){
setMode("oneshot")
setRestaurants(1)
setScreen("setup")
}

function startCustom(){
setMode("custom")
setScreen("setup")
}

function startGame(){

let p=[]
let r=[]

for(let i=0;i<players;i++){
p.push(playerNames[i] || `Giocatore ${i+1}`)
}

for(let i=0;i<restaurants;i++){
r.push(restaurantNames[i] || `Ristorante ${i+1}`)
}

setPlayerNames(p)
setRestaurantNames(r)

setCurrentPlayer(0)
setCurrentRestaurant(0)

setScreen("vote")
}

function selectVote(category,value){

setVotes({
...votes,
[category]:value
})

}

function confirmVote(){

const voteData={
player:playerNames[currentPlayer],
restaurant:restaurantNames[currentRestaurant],
scores:votes
}

setAllVotes([...allVotes,voteData])

setVotes({
location:null,
menu:null,
service:null,
price:null,
bonus:null
})

let nextRestaurant=currentRestaurant+1
let nextPlayer=currentPlayer

if(nextRestaurant>=restaurants){
nextRestaurant=0
nextPlayer++
}

if(nextPlayer>=players){
setScreen("result")
return
}

setCurrentRestaurant(nextRestaurant)
setCurrentPlayer(nextPlayer)

}

if(screen==="home"){
return(

<div className="screen bg1">

<button onClick={startClassic}>Modalità Classica</button>

<button onClick={startOneShot}>One Shot</button>

<button onClick={startCustom}>Partita Personalizzata</button>

</div>

)
}

if(screen==="setup"){
return(

<div className="screen bg2">

<h2>Impostazioni</h2>

<p>Giocatori: {players}</p>

<input
type="range"
min="2"
max="8"
value={players}
onChange={(e)=>setPlayers(Number(e.target.value))}
/>

<p>Ristoranti: {restaurants}</p>

{mode!=="oneshot" && (
<input
type="range"
min="2"
max="8"
value={restaurants}
onChange={(e)=>setRestaurants(Number(e.target.value))}
/>
)}

<h3>Nomi Giocatori</h3>

{Array.from({length:players}).map((_,i)=>(
<input
key={i}
placeholder={`Giocatore ${i+1}`}
value={playerNames[i] || ""}
onChange={(e)=>{
let arr=[...playerNames]
arr[i]=e.target.value
setPlayerNames(arr)
}}
/>
))}

<h3>Nomi Ristoranti</h3>

{Array.from({length:restaurants}).map((_,i)=>(
<input
key={i}
placeholder={`Ristorante ${i+1}`}
value={restaurantNames[i] || ""}
onChange={(e)=>{
let arr=[...restaurantNames]
arr[i]=e.target.value
setRestaurantNames(arr)
}}
/>
))}

<button onClick={startGame}>Inizia</button>

</div>

)
}

if(screen==="vote"){
return(

<div className="screen bg2">

<h2>Votazione</h2>

<p>
{playerNames[currentPlayer]} → {restaurantNames[currentRestaurant]}
</p>

{voteCategories.map(cat=>(
<div key={cat.key} className="voteRow">

<p>{cat.label}</p>

<div className="voteButtons">

{[1,2,3,4,5].map(n=>(
<button
key={n}
className={votes[cat.key]===n ? "selected":""}
onClick={()=>selectVote(cat.key,n)}
>
{n}
</button>
))}

</div>

</div>
))}

<button onClick={confirmVote}>
Conferma voto
</button>

</div>

)
}

if(screen==="result"){
return(

<div className="screen bg3">

<h2>Risultati</h2>

{allVotes.map((v,i)=>(
<div key={i}>

<p>
<b>{v.player}</b> → {v.restaurant}
</p>

<p>
Location:{v.scores.location} |
Menu:{v.scores.menu} |
Servizio:{v.scores.service} |
Conto:{v.scores.price} |
Bonus:{v.scores.bonus}
</p>

</div>
))}

<button onClick={()=>window.location.reload()}>
Nuova partita
</button>

</div>

)
}

}
