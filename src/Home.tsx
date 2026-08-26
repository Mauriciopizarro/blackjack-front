import React, { useEffect } from 'react'
import './Home.css'
import JoinGame from './JoinGame';
import CreateGame from './CreateGame';
import GameStatusButton from './GetStatusGame';
import WalletButton from './AccountMoney';
import PlayerHistoryGames from './PlayerHistoryGames';
import MyGames from './MyGames';
import { GameProvider } from './GameContext';
import { getTokenFromCookies } from './utils/GetTokenFromCookies';
import { redirectToLogin } from './utils/session';


const Home: React.FC = () => {
  // Sin token no hay nada que hacer acá: directo al login.
  useEffect(() => {
    if (!getTokenFromCookies()) {
      redirectToLogin();
    }
  }, []);

  return (
    <div className='home'>
      <GameProvider>
        <GameStatusButton />
        <div className='topbar'>
          {<CreateGame/>}
          {<JoinGame/>}
          {<MyGames/>}
        </div>
        <div className='buttons'>
          {<WalletButton/>}
          {<PlayerHistoryGames/>}
        </div>
      </GameProvider>
    </div>
  )
}

export default Home;