import { useState } from "react";

export default function App() {

  const [screen,setScreen] = useState("home")
  const [mode,setMode] = useState(null)

  const [players,setPlayers] = useState(4)
  const [restaurants,setRestaurants] = useState(4)

  const [votes,setVotes] = useState({
    location:null,
    menu:null,
    service:null,
    price:null,
    bonus:null
  })

  function startClassic(){
    setMode("classic")
    setPlayers(4)
    setRestaurants(4)
    setScreen("vote")
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
    setScreen("vote")
  }

  function selectVote(category,value){
    setVotes({
      ...votes,
      [category]:value
    })
  }

  function endGame(){
    setScreen("result")
  }

  const voteCategories = [
    {key:"location",label:"Location"},
    {key:"menu",label:"Menu"},
    {key:"service",label:"Servizio"},
    {key:"price",label:"Conto"},
    {key:"bonus",label:"Bonus"}
  ]

  if(screen==="home"){
    return(

      <div className="screen bg1">

        <h1>4 Spadellate</h1>

        <button onClick={startClassic}>
          Modalità Classica
        </button>

        <button onClick={startOneShot}>
          One Shot
        </button>

        <button onClick={startCustom}>
          Partita Personalizzata
        </button>

      </div>

    )
  }

  if(screen==="setup"){
    return(

      <div className="screen bg1">

        <h2>Impostazioni</h2>

        {mode!=="oneshot" && (
          <>
            <p>Giocatori: {players}</p>

            <input
              type="range"
              min="2"
              max="8"
              value={players}
              onChange={(e)=>setPlayers(Number(e.target.value))}
            />
          </>
        )}

        {mode!=="oneshot" && (
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
        )}

        {mode==="oneshot" && (
          <>
            <p>Giocatori: {players}</p>

            <input
              type="range"
              min="2"
              max="8"
              value={players}
              onChange={(e)=>setPlayers(Number(e.target.value))}
            />

            <p>Ristorante: 1</p>
          </>
        )}

        <button onClick={startGame}>
          Inizia
        </button>

      </div>

    )
  }

  if(screen==="vote"){
    return(

      <div className="screen bg2">

        <h2>Votazione</h2>

        <p>
        Giocatori: {players} | Ristoranti: {restaurants}
        </p>

        {voteCategories.map(cat=>(
          <div key={cat.key} className="voteRow">

            <p>{cat.label}</p>

            <div className="voteButtons">

              {[1,2,3,4,5].map(n=>(
                <button
                  key={n}
                  className={
                    votes[cat.key]===n ? "selected" : ""
                  }
                  onClick={()=>selectVote(cat.key,n)}
                >
                  {n}
                </button>
              ))}

            </div>

          </div>
        ))}

        <button onClick={endGame}>
          Fine
        </button>

      </div>

    )
  }

  if(screen==="result"){
    return(

      <div className="screen bg3">

        <h2>Risultato</h2>

        {Object.entries(votes).map(([k,v])=>(
          <p key={k}>
            {k}: {v ?? "-"}
          </p>
        ))}

        <button onClick={()=>setScreen("home")}>
          Nuova partita
        </button>

      </div>

    )
  }

}
