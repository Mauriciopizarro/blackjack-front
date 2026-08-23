import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from './config';
import Modal from 'react-modal';
import { Toaster, toast } from 'sonner';
import { getTokenFromCookies } from './utils/GetTokenFromCookies';
import { getUserIdFromCookies } from './utils/GetUserIdFromCookies';
import './GetStatusGame.css';
import { createSocket } from './utils/socket';
import { useGame } from './GameContext';

Modal.setAppElement('#root');

const socket = createSocket();

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
  const [betAmount, setBetAmount] = useState('');
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const { currentGameId, statusOpen, openStatus, closeStatus } = useGame();
  const token = getTokenFromCookies();
  const playerId = getUserIdFromCookies();

  const fetchGameStatus = useCallback(async () => {
    const gameId = currentGameId;
    if (!gameId) {
      toast.error('No game selected');
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/game/status/${gameId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      const responseData = await response.json();

      if (!response.ok) {
        toast.error(responseData.detail);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Anti-parpadeo: solo actualizamos el estado si los datos realmente
      // cambiaron. Si devolvemos la referencia anterior, React no re-renderiza
      // y el tablero queda estable entre polls.
      setGameStatus(prev =>
        prev && JSON.stringify(prev) === JSON.stringify(responseData)
          ? prev
          : (responseData as GameStatus)
      );
      return responseData as GameStatus;

    } catch (error) {
      console.error('Error getting game status:', error);
      return null;
    }
  }, [currentGameId, token]);

  useEffect(() => {
    if (!statusOpen || !currentGameId) {
      return;
    }

    const gameId = currentGameId;

    // Al abrir o CAMBIAR de partida limpiamos el tablero anterior (si no,
    // quedarían visibles los datos del juego anterior hasta el próximo poll)
    // y traemos el estado fresco del juego seleccionado de inmediato.
    setGameStatus(null);
    setBetAmount('');
    void fetchGameStatus();

    const rejoinGame = () => socket.emit('joinGame', gameId);

    const handleGameUpdated = ({ gameId: updatedGameId }: { gameId?: string }) => {
      if (updatedGameId === gameId) {
        void fetchGameStatus();
      }
    };

    // Entramos a la sala del juego. Socket.IO pierde la membresía de las salas
    // cuando el cliente se reconecta (servidor reiniciado / red cortada / tab
    // dormida), así que nos volvemos a unir en cada evento `connect`.
    socket.emit('joinGame', gameId);
    socket.on('connect', rejoinGame);
    socket.on('gameUpdated', handleGameUpdated);

    // Refresco periódico de respaldo: garantiza que el tablero se actualice
    // en vivo aunque el evento socket se pierda por completo.
    const statusInterval = window.setInterval(() => {
      void fetchGameStatus();
    }, 3000);

    return () => {
      socket.off('connect', rejoinGame);
      socket.emit('leaveGame', gameId);
      socket.off('gameUpdated', handleGameUpdated);
      window.clearInterval(statusInterval);
    };
  }, [fetchGameStatus, statusOpen, currentGameId]);

  const notifyGameUpdated = (gameId: string, statusGame?: string) => {
    socket.emit('gameUpdated', { gameId });

    if (statusGame === 'finished') {
      socket.emit('newGame');
    }
  };

  const handleClick = async () => {
    const status = await fetchGameStatus();

    if (status) {
      openStatus();
    }
  };

  const handleDealCard = async () => {
    const gameId = currentGameId;
    if (!gameId) {
      toast.error('No game selected');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/game/deal_card/${gameId}`, {
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

      const updatedData = await fetchGameStatus();
      if (updatedData) {
        notifyGameUpdated(gameId, updatedData.status_game);
      }
    } catch (error) {
      console.error('Error dealing card:', error);
    }
  };

  const handleStand = async () => {
    const gameId = currentGameId;
    if (!gameId) {
      toast.error('No game selected');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/game/stand/${gameId}`, {
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

      const updatedData = await fetchGameStatus();
      if (updatedData) {
        notifyGameUpdated(gameId, updatedData.status_game);
      }
    } catch (error) {
      console.error('Error standing player:', error);
    }
  };

  const handleBetSubmit = async () => {
    const gameId = currentGameId;
    if (!gameId) {
      toast.error('No game selected');
      return;
    }

    const numericBet = Math.floor(Number(betAmount));
    if (!numericBet || numericBet < 1) {
      toast.error('Enter a valid bet amount');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/game/make_bet/${gameId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bet_amount: numericBet, player_id: playerId }),
      });

      if (!response.ok) {
        const responseData = await response.json();
        toast.error(responseData.detail);
        return;
      }

      toast.success('Bet placed successfully!');
      setBetAmount('');

      const updatedData = await fetchGameStatus();
      if (updatedData) {
        notifyGameUpdated(gameId, updatedData.status_game);
      }
    } catch (error) {
      console.error('Error placing bet:', error);
    }
  };

  const renderCards = (cards: string[]) => {
    return cards.map((card, index) => (
      <img key={index} src={cardImages[card]} alt={`${card} card`} width="80" height="120" />
    ));
  };

  const currentPlayer = gameStatus?.players.find(p => p.id === playerId);

  const handleBetInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value === '') {
      setBetAmount('');
    } else {
      const numericValue = Math.floor(Math.max(Number(value), 0));
      if (numericValue > 0) {
        setBetAmount(numericValue.toString());
      }
    }
  };

  return (
    <>
      <Toaster position="bottom-center" richColors />
      <div>
        <button className="createButton2" onClick={handleClick}>Game Status</button>
        <Modal
          isOpen={statusOpen}
          onRequestClose={closeStatus}
          className="game-status-modal"
          overlayClassName="game-status-overlay"
        >
          <button className="close-button" onClick={closeStatus}>&times;</button>
          {gameStatus ? (
            <div className="game-hub">
              {gameStatus.status_game === 'pending_bet' ? (
                <div className="bet-phase">
                  <h3 className="bet-phase-title">Place your bets to start the round</h3>
                  <p className="bet-phase-subtitle">
                    The cards are dealt automatically once every player has placed a bet.
                  </p>

                  <div className="bet-phase-players">
                    {gameStatus.players.map(player => (
                      <div key={player.id} className="bet-phase-player">
                        <span className="bet-phase-player-name">
                          {player.name}{player.id === playerId ? ' (you)' : ''}
                        </span>
                        {player.bet_amount > 0 ? (
                          <span className="bet-phase-player-bet placed">&#10003; Bet: ${player.bet_amount}</span>
                        ) : (
                          <span className="bet-phase-player-bet pending">No bet yet</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {currentPlayer && currentPlayer.bet_amount > 0 ? (
                    <div className="bet-waiting">
                      &#9203; You already placed ${currentPlayer.bet_amount}. Waiting for the other players...
                    </div>
                  ) : (
                    <div className="bet-form">
                      <label htmlFor="bet-amount">Your bet amount</label>
                      <input
                        id="bet-amount"
                        type="number"
                        value={betAmount}
                        onChange={handleBetInputChange}
                        placeholder="Enter bet amount"
                        min="1"
                      />
                      <button className="submit-bet-button" onClick={handleBetSubmit}>Place My Bet</button>
                    </div>
                  )}
                </div>
              ) : (
                <>
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
                        {player.id === playerId && gameStatus.status_game === 'started' && (
                          <div className="player-buttons">
                            <button className="deal-card-button" onClick={handleDealCard}>Deal Card</button>
                            <button className="stand-button" onClick={handleStand}>Stand</button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div>Loading...</div>
          )}
        </Modal>
      </div>
    </>
  );
};

export default GameStatusButton;