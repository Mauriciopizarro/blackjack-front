import React from 'react'
import './Home.css'
import JoinGame from './JoinGame';
import CreateGame from './CreateGame';
import GameStatusButton from './GetStatusGame';
import WalletButton from './AccountMoney';
import PlayerHistoryGames from './PlayerHistoryGames';


const Home: React.FC = () => {

  return (
    <div className='home'>
      <div className='buttons'>
        {<JoinGame/>}
        {<CreateGame/>}
        {<GameStatusButton/>}
        {<WalletButton/>}
        {<PlayerHistoryGames/>}
      </div>
    </div>
  )
}

export default Home;