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
    setVotes(prev => ({
      ...prev,
      [category]:value
    }))
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

  /* HOME */

  if(screen==="home"){
    return(

      <div className="screen bg1">

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

  /* SETUP */

  if(screen==="setup"){
    return(

      <div className="screen bg2">

        <h2 className="title">Impostazioni partita</h2>

        {mode!=="oneshot" && (
          <>
            <p className="label">Giocatori: {players}</p>

            <input
              type="range"
              min="2"
              max="8"
              value={players}
              onChange={(e)=>setPlayers(Number(e.target.value))}
            />
          </>
        )}

        {mode==="custom" && (
          <>
            <p className="label">Ristoranti: {restaurants}</p>

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
            <p className="label">Giocatori: {players}</p>

            <input
              type="range"
              min="2"
              max="8"
              value={players}
              onChange={(e)=>setPlayers(Number(e.target.value))}
            />

            <p className="label">Ristorante: 1</p>
          </>
        )}

        <button onClick={startGame}>
          Inizia partita
        </button>

      </div>

    )
  }

  /* VOTAZIONE */

  if(screen==="vote"){
    return(

      <div className="screen bg2">

        <h2 className="title">Votazione</h2>

        <p className="label">
          Giocatori: {players} | Ristoranti: {restaurants}
        </p>

        {voteCategories.map(cat=>(
          <div key={cat.key} className="voteRow">

            <p className="voteLabel">{cat.label}</p>

            <div className="voteButtons">

              {[1,2,3,4,5].map(n=>(
                <button
                  key={n}
                  className={
                    votes[cat.key]===n ? "voteBtn selected" : "voteBtn"
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
          Fine votazione
        </button>

      </div>

    )
  }

  /* RISULTATO */

  if(screen==="result"){
    return(

      <div className="screen bg3">

        <h2 className="title">Risultato</h2>

        {Object.entries(votes).map(([k,v])=>(
          <p key={k} className="label">
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
