import React, { useState } from "react";

export default function App() {

  /* =========================
  STATE
  ========================= */

  const [screen, setScreen] = useState("home");
  const [mode, setMode] = useState(null);

  const [players, setPlayers] = useState(4);
  const [restaurants, setRestaurants] = useState(4);

  const [currentPlayer, setCurrentPlayer] = useState(1);
  const [currentRestaurant, setCurrentRestaurant] = useState(1);

  const [votes, setVotes] = useState([]);

  const [vote, setVote] = useState({
    menu:5,
    servizio:5,
    location:5,
    conto:5,
    bonus:false
  });

  /* =========================
  NAVIGATION
  ========================= */

  function startMode(selectedMode){

    setMode(selectedMode)

    if(selectedMode==="classica"){
      setPlayers(4)
      setRestaurants(4)
    }

    if(selectedMode==="oneshot"){
      setRestaurants(1)
    }

    setScreen("setup")
  }

  function startGame(){
    setCurrentPlayer(1)
    setCurrentRestaurant(1)
    setVotes([])
    setScreen("vote")
  }

  /* =========================
  VOTE HANDLER
  ========================= */

  function updateVote(field,value){
    setVote({
      ...vote,
      [field]:value
    })
  }

  function confirmVote(){

    const total =
      vote.menu +
      vote.servizio +
      vote.location +
      vote.conto +
      (vote.bonus ? 5 : 0)

    const newVotes = [
      ...votes,
      {
        player:currentPlayer,
        restaurant:currentRestaurant,
        total
      }
    ]

    setVotes(newVotes)

    if(currentRestaurant < restaurants){
      setCurrentRestaurant(currentRestaurant+1)
    }
    else{

      if(currentPlayer < players){

        setCurrentPlayer(currentPlayer+1)
        setCurrentRestaurant(1)

      }else{

        setScreen("result")
        return
      }

    }

    setVote({
      menu:5,
      servizio:5,
      location:5,
      conto:5,
      bonus:false
    })
  }

  /* =========================
  RESULT
  ========================= */

  function calculateResults(){

    const totals = {}

    votes.forEach(v=>{

      if(!totals[v.restaurant]){
        totals[v.restaurant]=0
      }

      totals[v.restaurant]+=v.total

    })

    return Object.entries(totals)
      .sort((a,b)=>b[1]-a[1])
  }

  /* =========================
  HOME
  ========================= */

  if(screen==="home"){
    return(

      <div className="screen">

        <h1>🍝 Forchette & Polpette</h1>

        <p>Scegli la modalità</p>

        <button onClick={()=>startMode("classica")}>
        Modalità Classica
        </button>

        <button onClick={()=>startMode("oneshot")}>
        One Shot
        </button>

        <button onClick={()=>startMode("custom")}>
        Personalizzata
        </button>

      </div>

    )
  }

  /* =========================
  SETUP
  ========================= */

  if(screen==="setup"){
    return(

      <div className="screen">

        <h2>Impostazioni partita</h2>

        <p>Giocatori: {players}</p>

        {mode!=="classica" &&

        <input
        type="range"
        min="2"
        max="8"
        value={players}
        onChange={(e)=>setPlayers(Number(e.target.value))}
        />
        }

        {mode!=="oneshot" &&

        <>
        <p>Ristoranti: {restaurants}</p>

        <input
        type="range"
        min="2"
        max="8"
        value={restaurants}
        onChange={(e)=>setRestaurants(Number(e.target.value))}
        />
        </>
        }

        <button onClick={startGame}>
        Avvia la cena 🍷
        </button>

      </div>

    )
  }

  /* =========================
  VOTE
  ========================= */

  if(screen==="vote"){
    return(

      <div className="screen">

        <h2>
        Giocatore {currentPlayer}
        </h2>

        <h3>
        Ristorante {currentRestaurant}
        </h3>

        <VoteSlider
        label="Menu"
        value={vote.menu}
        onChange={(v)=>updateVote("menu",v)}
        />

        <VoteSlider
        label="Servizio"
        value={vote.servizio}
        onChange={(v)=>updateVote("servizio",v)}
        />

        <VoteSlider
        label="Location"
        value={vote.location}
        onChange={(v)=>updateVote("location",v)}
        />

        <VoteSlider
        label="Conto"
        value={vote.conto}
        onChange={(v)=>updateVote("conto",v)}
        />

        <label>

        Bonus +5

        <input
        type="checkbox"
        checked={vote.bonus}
        onChange={(e)=>updateVote("bonus",e.target.checked)}
        />

        </label>

        <button onClick={confirmVote}>
        Conferma voto
        </button>

      </div>

    )
  }

  /* =========================
  RESULT
  ========================= */

  if(screen==="result"){

    const ranking = calculateResults()

    return(

      <div className="screen">

        <h2>Classifica finale</h2>

        {ranking.map((r,i)=>(
          <div key={i}>
          {i+1}° Ristorante {r[0]} — {r[1]} punti
          </div>
        ))}

        <button onClick={()=>setScreen("home")}>
        Nuova partita
        </button>

      </div>

    )
  }

}

/* =========================
SLIDER COMPONENT
========================= */

function VoteSlider({label,value,onChange}){

  return(

    <div style={{margin:"20px 0"}}>

      <label>

      {label}: {value}

      </label>

      <input
      type="range"
      min="0"
      max="10"
      value={value}
      onChange={(e)=>onChange(Number(e.target.value))}
      />

    </div>

  )

}
