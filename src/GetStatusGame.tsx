import React, { useState } from 'react';
import Modal from 'react-modal';
import { Toaster, toast } from 'sonner';
import { getTokenFromCookies } from './utils/GetTokenFromCookies';
import { getGameFromCookies } from './utils/GetGameFromCookies';
import { getUserIdFromCookies } from './utils/GetUserIdFromCookies';
import './GetStatusGame.css';

Modal.setAppElement('#root');

interface GameStatus {
  croupier: {
    cards: string[];
    name: string;
    status: string;
    total_points: number[];
  };
  players: {
    cards: string[];
    id: string;
    name: string;
    status: string;
    total_points: number[];
    bet_amount: number;
  }[];
  players_quantity: number;
  status_game: string;
}

const cardImages: { [key: string]: string } = {
  '2': 'https://cdn.pixabay.com/photo/2012/04/11/13/34/two-28257_1280.png',
  '3': 'https://cdn.pixabay.com/photo/2012/04/11/13/44/hearts-28297_1280.png',
  '4': 'https://cdn.pixabay.com/photo/2012/04/11/13/34/four-28259_1280.png',
  '5': 'https://cdn.pixabay.com/photo/2012/04/11/14/03/hearts-28352_1280.png',
  '6': 'https://cdn.pixabay.com/photo/2012/04/11/13/58/six-28340_1280.png',
  '7': 'https://cdn.pixabay.com/photo/2012/04/11/13/54/seven-28328_1280.png',
  '8': 'https://cdn.pixabay.com/photo/2012/04/11/13/43/diamonds-28289_1280.png',
  '9': 'https://cdn.pixabay.com/photo/2012/04/11/13/43/diamonds-28290_1280.png',
  '10': 'https://cdn.pixabay.com/photo/2012/04/11/13/57/ten-28335_1280.png',
  'J': 'https://cdn.pixabay.com/photo/2012/04/11/14/05/hearts-28358_1280.png',
  'Q': 'https://cdn.pixabay.com/photo/2012/04/11/13/57/clubs-28334_1280.png',
  'K': 'https://cdn.pixabay.com/photo/2012/04/11/14/11/king-28374_1280.png',
  'A': 'https://cdn.pixabay.com/photo/2012/04/11/14/04/ace-28357_1280.png',
  'hidden card': 'https://img.freepik.com/vector-premium/signo-interrogacion-rojo-grande_122818-781.jpg?w=2000',
};

const GameStatusButton: React.FC = () => {
  const [modalOpen, setModalOpen] = useState(false);
  const [betModalOpen, setBetModalOpen] = useState(false);
  const [betAmount, setBetAmount] = useState('');
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const token = getTokenFromCookies();
  const playerId = getUserIdFromCookies();

  const handleClick = async () => {
    const gameId = getGameFromCookies();
    try {
      const response = await fetch(`https://api-gateway-z0qe.onrender.com/game/status/${gameId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        },
      });

      const responseData = await response.json();

      if (!response.ok) {
        toast.error(responseData.detail);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      setGameStatus(responseData);
      setModalOpen(true);

    } catch (error) {
      console.error('Error getting game status:', error);
    }
  };

  const handleDealCard = async () => {
    const gameId = getGameFromCookies();
    try {
      const response = await fetch(`https://api-gateway-z0qe.onrender.com/game/deal_card/${gameId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const responseData = await response.json();
        toast.error(responseData.detail);
        return;
      }

      // Fetch updated game status after dealing the card
      const updatedResponse = await fetch(`https://api-gateway-z0qe.onrender.com/game/status/${gameId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const updatedData = await updatedResponse.json();

      if (!updatedResponse.ok) {
        toast.error(updatedData.detail);
      }

      setGameStatus(updatedData);
    } catch (error) {
      console.error('Error dealing card:', error);
    }
  };


  const handleStand = async () => {
    const gameId = getGameFromCookies();
    try {
      const response = await fetch(`https://api-gateway-z0qe.onrender.com/game/stand/${gameId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const responseData = await response.json();
        toast.error(responseData.detail);
        return;
      }

      // Fetch updated game status after dealing the card
      const updatedResponse = await fetch(`https://api-gateway-z0qe.onrender.com/game/status/${gameId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const updatedData = await updatedResponse.json();

      if (!updatedResponse.ok) {
        toast.error(updatedData.detail);
      }

      setGameStatus(updatedData);
    } catch (error) {
      console.error('Error standing player:', error);
    }
  };


  const handleBetSubmit = async () => {
    const gameId = getGameFromCookies();
    try {
      const response = await fetch(`https://api-gateway-z0qe.onrender.com/game/make_bet/${gameId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bet_amount: betAmount, player_id: {playerId} }),
      });

      if (!response.ok) {
        const responseData = await response.json();
        toast.error(responseData.detail);
        return;
      }

      toast.success('Bet placed successfully!');
      setBetModalOpen(false);


      // Fetch updated game status after dealing the card
      const updatedResponse = await fetch(`https://api-gateway-z0qe.onrender.com/game/status/${gameId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      const updatedData = await updatedResponse.json();

      if (!updatedResponse.ok) {
        toast.error(updatedData.detail);
      }

      setGameStatus(updatedData);

    } catch (error) {
      console.error('Error placing bet:', error);
    }
  };

  const renderCards = (cards: string[]) => {
    return cards.map((card, index) => (
      <img key={index} src={cardImages[card]} alt={`${card} card`} width="80" height="120" />
    ));
  };

  return (
    <>
      <Toaster position="bottom-center" richColors />
      <div>
        <button className="createButton2" onClick={handleClick}>Game Status</button>
        <Modal
          isOpen={modalOpen}
          onRequestClose={() => setModalOpen(false)}
          className="game-status-modal"
          overlayClassName="game-status-overlay"
        >
          <button className="close-button" onClick={() => setModalOpen(false)}>&times;</button>
          {gameStatus ? (
            <div className="game-hub">
              <div className="dealer-section">
                <h3 className="section-title">Croupier</h3>
                <div className="dealer-info">
                  <h4 className="dealer-name">{gameStatus.croupier.name}</h4>
                  <div className="dealer-status">
                    <p style={{ fontSize: '20px' }}>Status: <span>{gameStatus.croupier.status}</span></p>
                    <p style={{ fontSize: '20px' }}>Total Points: <span>{gameStatus.croupier.total_points.join(', ')}</span></p>
                    <div className="cards-container">
                      {renderCards(gameStatus.croupier.cards)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="players-section">
                <h3 className="section-title">Players</h3>
                {gameStatus.players.map(player => (
                  <div key={player.id} className="player-info">
                    <h4 className="player-name">{player.name}</h4>
                    <div className="player-status">
                      <p style={{ fontSize: '20px' }}>Status: <span>{player.status}</span></p>
                      <p style={{ fontSize: '20px' }}>Total Points: <span>{player.total_points.join(', ')}</span></p>
                      <p style={{ fontSize: '20px' }}>Bet Amount: <span>{player.bet_amount}</span></p>
                    </div>
                    <div className="cards-container">
                      {renderCards(player.cards)}
                    </div>
                    {player.id === playerId && (
                      <div className="player-buttons">
                        <button className="deal-card-button" onClick={handleDealCard}>Deal Card</button>
                        <button className="stand-button" onClick={handleStand}>Stand</button>
                        <button className="bet-button" onClick={() => setBetModalOpen(true)}>Make a Bet</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
          <div>Loading...</div>
        )}
        </Modal>
        {betModalOpen && (
          <div className="bet-modal">
            <div className="bet-modal-content">
              <button className="close-button" onClick={() => setBetModalOpen(false)}>&times;</button>
              <h3>Place Your Bet</h3>
              <input
                type="number"
                value={betAmount}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    setBetAmount('');
                  } else {
                    const numericValue = Math.floor(Math.max(Number(value), 0));
                    if (numericValue > 0) {
                      setBetAmount(numericValue.toString());
                    }
                  }
                }}
                placeholder="Enter bet amount"
                min="1"
              />
              <button className="submit-bet-button" onClick={handleBetSubmit}>Submit Bet</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default GameStatusButton;
