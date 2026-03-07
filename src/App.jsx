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

const players = 4
const restaurants = 4

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
owner:user.uid
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

<>

<h1>Forchette & Polpette</h1>

<button onClick={login}>
Login con Google
</button>

</>

)}

{screen==="home" &&(

<>

<h2>Benvenuto {user?.displayName}</h2>

<button onClick={createGame}>
Crea partita
</button>

</>

)}

{screen==="setup" &&(

<>

<h2>Setup partita</h2>

<p>Giocatori: 4</p>
<p>Ristoranti: 4</p>

<h3>Nomi giocatori</h3>

{Array.from({length:players}).map((_,i)=>(

<input
key={i}
placeholder={`Giocatore ${i+1}`}
onChange={(e)=>updatePlayerName(i,e.target.value)}
/>

))}

<h3>Nomi ristoranti</h3>

{Array.from({length:restaurants}).map((_,i)=>(

<input
key={i}
placeholder={`Ristorante ${i+1}`}
onChange={(e)=>updateRestaurantName(i,e.target.value)}
/>

))}

<button onClick={startGame}>
Inizia partita
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

<XAxis dataKey="name"/>

<YAxis/>

<Tooltip/>

<Bar dataKey="total"/>

</BarChart>

</>

)}

</>

)}

</div>

</>

)

}
