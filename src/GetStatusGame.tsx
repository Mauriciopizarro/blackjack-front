import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from './config';
import Modal from 'react-modal';
import { toast } from 'sonner';
import { getTokenFromCookies } from './utils/GetTokenFromCookies';
import { getUserIdFromCookies } from './utils/GetUserIdFromCookies';
import './GetStatusGame.css';
import { createSocket } from './utils/socket';
import { useGame } from './GameContext';
// Cartas locales: Vite las importa estáticamente, las cachea con hash de
// contenido y las sirve desde el mismo origen (sin dependencia de CDNs externos).
import cardTwo from './assets/cards/two.png';
import cardThree from './assets/cards/three.png';
import cardFour from './assets/cards/four.png';
import cardFive from './assets/cards/five.png';
import cardSix from './assets/cards/six.png';
import cardSeven from './assets/cards/seven.png';
import cardEight from './assets/cards/eight.png';
import cardNine from './assets/cards/nine.png';
import cardTen from './assets/cards/ten.png';
import cardJack from './assets/cards/jack.png';
import cardQueen from './assets/cards/queen.png';
import cardKing from './assets/cards/king.png';
import cardAce from './assets/cards/ace.png';
import cardHidden from './assets/cards/hidden.jpg';

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
  '2': cardTwo,
  '3': cardThree,
  '4': cardFour,
  '5': cardFive,
  '6': cardSix,
  '7': cardSeven,
  '8': cardEight,
  '9': cardNine,
  '10': cardTen,
  'J': cardJack,
  'Q': cardQueen,
  'K': cardKing,
  'A': cardAce,
  'hidden card': cardHidden,
};

const GameStatusButton: React.FC = () => {
  const [pendingChips, setPendingChips] = useState<number[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  const { currentGameId, statusOpen, closeStatus } = useGame();
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
    setPendingChips([]);
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

    const numericBet = pendingBetAmount;
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
      setPendingChips([]);

      const updatedData = await fetchGameStatus();
      if (updatedData) {
        notifyGameUpdated(gameId, updatedData.status_game);
      }
    } catch (error) {
      console.error('Error placing bet:', error);
    }
  };

  const renderCards = (
    cards: string[],
    opts?: { baseDelay?: number; delayStep?: number; dealVars?: React.CSSProperties }
  ) => {
    const baseDelay = opts?.baseDelay ?? 0;
    const delayStep = opts?.delayStep ?? 350;
    return cards.map((card, index) => (
      <img
        key={index}
        src={cardImages[card]}
        alt={`${card} card`}
        className="table-card deal-anim"
        style={{
          animationDelay: `${baseDelay + index * delayStep}ms`,
          ...(opts?.dealVars ?? {}),
        }}
      />
    ));
  };

  const currentPlayer = gameStatus?.players.find(p => p.id === playerId);

  const pendingBetAmount = pendingChips.reduce((acc, chip) => acc + chip, 0);

  const addChip = (denom: number) => {
    setPendingChips(prev => [...prev, denom]);
  };

  const undoChip = () => {
    setPendingChips(prev => prev.slice(0, -1));
  };

  const clearChips = () => {
    setPendingChips([]);
  };

  const winners = gameStatus
    ? gameStatus.players.filter(p => p.status === 'winner').map(p => p.name)
    : [];

  return (
    <>
      <div>
        <Modal
          isOpen={statusOpen}
          onRequestClose={closeStatus}
          className="game-status-modal"
          overlayClassName="game-status-overlay"
        >
          <button className="close-button" onClick={closeStatus}>&times;</button>
          {gameStatus ? (
            <>
              {gameStatus.status_game === 'pending_bet' ? (
                <div className="table-felt table-felt-bet">
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
                    <div className="chips-bet">
                      <p className="chips-total">
                        Your bet: <span className="chips-total-amount">${pendingBetAmount}</span>
                      </p>

                      <div className="chip-rack">
                        {[100, 500, 1000].map(denom => (
                          <button
                            key={denom}
                            type="button"
                            className="chip"
                            data-denom={denom}
                            onClick={() => addChip(denom)}
                          >
                            <span className="chip-inner">{denom}</span>
                          </button>
                        ))}
                      </div>

                      <div className="chips-stack">
                        {pendingChips.map((chip, idx) => (
                          <span
                            key={idx}
                            className={`chip-stacked chip-stacked-denom-${chip}`}
                          />
                        ))}
                      </div>

                      <div className="chips-actions">
                        <button
                          type="button"
                          className="chip-undo"
                          onClick={undoChip}
                          disabled={pendingChips.length === 0}
                        >
                          Undo
                        </button>
                        <button
                          type="button"
                          className="chip-clear"
                          onClick={clearChips}
                          disabled={pendingChips.length === 0}
                        >
                          Clear
                        </button>
                        <button
                          type="button"
                          className="submit-bet-button chips-submit"
                          onClick={handleBetSubmit}
                          disabled={pendingBetAmount < 1}
                        >
                          Confirm Bet ({pendingBetAmount ? `$${pendingBetAmount}` : '$0'})
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              ) : (
                <div className="table-felt">
                  <div className="table-branding" aria-hidden="true">
                    <div className="arc-line arc-big">BLACKJACK PAYS 3 TO 2</div>
                    <div className="arc-line arc-small">DEALER MUST STAND ON 17 AND DRAW TO 16</div>
                    <div className="arc-line arc-spaced">INSURANCE PAYS 2 TO 1</div>
                  </div>

                  <div className="dealer-spot">
                    <div className="spot-name dealer-title">{gameStatus.croupier.name}</div>
                    <div className="cards-container">
                      {renderCards(gameStatus.croupier.cards, {
                        baseDelay: gameStatus.players.length * 700,
                        dealVars: { '--deal-dx': '-150px', '--deal-dy': '0px' } as React.CSSProperties,
                      })}
                    </div>
                    <div className="spot-points">
                      Points: <span>{gameStatus.croupier.total_points.join(', ')}</span>
                    </div>
                  </div>

                  <div className="table-slots" aria-hidden="true">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const t = i / 6;
                      const angle = Math.PI * t;
                      return (
                        <span
                          key={i}
                          className="table-slot"
                          style={{
                            left: `${50 + 41 * Math.cos(angle)}%`,
                            bottom: `${40 + 17 * Math.sin(angle)}%`,
                            transform: 'translateX(-50%)',
                          }}
                        />
                      );
                    })}
                  </div>

                  {gameStatus.players.map((player, pIndex) => {
                    const t = gameStatus.players.length === 1
                      ? 0.5
                      : pIndex / (gameStatus.players.length - 1);
                    const angle = Math.PI * t;
                    const spotStyle: React.CSSProperties = {
                      left: `${50 + 41 * Math.cos(angle)}%`,
                      bottom: `${9 + 18 * Math.sin(angle)}%`,
                      transform: 'translateX(-50%)',
                    };
                    return (
                      <div
                        key={player.id}
                        className={`player-spot${player.id === playerId ? ' current' : ''}`}
                        style={spotStyle}
                      >
                        <div className="spot-name">
                          {player.name}{player.id === playerId ? ' (you)' : ''}
                        </div>
                        <div className="cards-container">
                          {renderCards(player.cards, {
                            baseDelay: pIndex * 700,
                            dealVars: { '--deal-dx': '0px', '--deal-dy': '-300px' } as React.CSSProperties,
                          })}
                        </div>
                        <div className="spot-points">
                          Points: <span>{player.total_points.join(', ')}</span>
                          {' '}&middot; Bet: <span>${player.bet_amount}</span>
                          {' '}&middot; <span className={`spot-status st-${player.status}`}>{player.status}</span>
                        </div>
                        {player.id === playerId && gameStatus.status_game === 'started' && (
                          <div className="player-buttons">
                            <button
                              className="deal-card-button"
                              onClick={handleDealCard}
                              disabled={player.status !== 'playing'}
                            >
                              Deal Card
                            </button>
                            <button
                              className="stand-button"
                              onClick={handleStand}
                              disabled={player.status !== 'playing'}
                            >
                              Stand
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {gameStatus.status_game === 'finished' && (
                    <div className="table-result">
                      {winners.length
                        ? `🏆 ${winners.join(', ')} win${winners.length > 1 ? '' : 's'}!`
                        : 'Round finished'}
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div>Loading...</div>
          )}
        </Modal>
      </div>
    </>
  );
};

export default GameStatusButton;