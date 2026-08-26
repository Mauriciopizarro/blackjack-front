import React, { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from './config';
import Modal from 'react-modal';
import './JoinGame.css';
import { getTokenFromCookies } from './utils/GetTokenFromCookies';
import { getUserIdFromCookies } from './utils/GetUserIdFromCookies';
import { toast } from 'sonner';
import { createSocket } from './utils/socket';
import { isSessionExpired, redirectToLogin } from './utils/session';
import { useGame } from './GameContext';

Modal.setAppElement('#root');

const socket = createSocket();

interface LobbyPlayer {
  id: string;
  name: string;
}

type LobbyUser = LobbyPlayer;

interface LobbyData {
  admin: LobbyUser | null;
  players: LobbyPlayer[];
  status: string;
}

const JoinGame: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [gameId, setGameId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Lobby de espera: se abre al unirse y espera a que el host inicie la partida.
  const [lobbyOpen, setLobbyOpen] = useState(false);
  const [joinedGameId, setJoinedGameId] = useState('');
  const [lobbyAdmin, setLobbyAdmin] = useState<LobbyUser | null>(null);
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [lobbyStatus, setLobbyStatus] = useState('');
  const userId = getUserIdFromCookies();
  const { setCurrentGameId, openStatus } = useGame();

  const handleJoinClick = () => {
    setIsOpen(true);
  };

  const fetchLobbyStatus = useCallback(async (id: string) => {
    const token = getTokenFromCookies();
    if (!token) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/game/lobby/${id}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        // La partida puede tardar unos instantes en registrarse luego del join.
        if (isSessionExpired(response.status)) {
          redirectToLogin();
        }
        return;
      }

      const data: LobbyData = await response.json();
      setLobbyStatus(data.status ?? '');
      setLobbyAdmin(data.admin ? { id: data.admin.id, name: data.admin.name } : null);
      // Anti-parpadeo: cada poll crea arrays nuevos; solo seteamos si cambió
      // para no re-renderizar el lobby aun cuando no cambió nada (igual que
      // GetStatusGame/MyGames).
      setLobbyPlayers(prev => {
        const next = (data.players ?? []).map((player: LobbyUser) => ({
          id: player.id,
          name: player.name,
        }));
        return JSON.stringify(prev) === JSON.stringify(next) ? prev : next;
      });

      // Si la partida ya está jugándose o terminó, ya no corresponde esperar al host.
      if (data.status === 'started') {
        setLobbyOpen(false);
        setCurrentGameId(id);
        openStatus();
        toast.success('The game has started! Place your bets.');
      } else if (data.status === 'finished') {
        setLobbyOpen(false);
        toast.success('The game is over.');
      }
    } catch (error) {
      console.error('Error fetching lobby status:', error);
    }
  }, [openStatus, setCurrentGameId]);

  // Mientras el lobby esté abierto: refrescamos los jugadores periódicamente,
  // nos unimos a la sala del juego por socket (para enterarnos cuando el host
  // presiona "Start" vía el evento `newGame`) y esperamos el inicio.
  useEffect(() => {
    if (!lobbyOpen || !joinedGameId) {
      return;
    }

    const id = joinedGameId;

    const handleNewGame = () => {
      setLobbyOpen(false);
      openStatus();
      toast.success('The host started the game! Place your bets.');
    };

    const handleGameUpdated = ({ gameId: updatedGameId }: { gameId?: string }) => {
      if (updatedGameId === id) {
        void fetchLobbyStatus(id);
      }
    };

    socket.emit('joinGame', id);
    socket.on('newGame', handleNewGame);
    socket.on('gameUpdated', handleGameUpdated);
    void fetchLobbyStatus(id);

    const lobbyInterval = window.setInterval(() => {
      void fetchLobbyStatus(id);
    }, 3000);

    return () => {
      window.clearInterval(lobbyInterval);
      socket.emit('leaveGame', id);
      socket.off('newGame', handleNewGame);
      socket.off('gameUpdated', handleGameUpdated);
    };
  }, [lobbyOpen, joinedGameId, fetchLobbyStatus, openStatus]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGameId(event.target.value);
  };

  const handleConfirmClick = async () => {
    const token = getTokenFromCookies();

    if (token) {
      try {
        const response = await fetch(`${API_BASE_URL}/game/enroll_player/${gameId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });

        const responseData = await response.json();

        if (isSessionExpired(response.status, responseData.detail)) {
          redirectToLogin();
          return;
        }

        if (response.status !== 200) {
          toast.error(responseData.detail);
        } else {
          setCurrentGameId(gameId);
          socket.emit('gameUpdated', { gameId });
          setGameId('');
          setErrorMessage('');
          setIsOpen(false);
          setJoinedGameId(gameId);
          setLobbyAdmin(null);
          setLobbyPlayers([]);
          setLobbyStatus('');
          setLobbyOpen(true);
          toast.success(`You joined the game successfully ID ${gameId}`);
        }
      } catch (error) {
        setErrorMessage(String(error));
      }
    }
  };

  const closeModal = () => {
    setIsOpen(false);
  };

  return (
    <>
      <div className="join-game-container">
        <button className="join-game-button" onClick={handleJoinClick}>
          Join Game
        </button>
        <Modal
          isOpen={isOpen}
          onRequestClose={closeModal}
          contentLabel="Join Game Modal"
          className="modalJoin"
          overlayClassName="modal-overlay"
        >
          <h3>Enter the game ID</h3>
          <input
            type="text"
            className="join-game-input"
            placeholder="Enter the game ID"
            value={gameId}
            onChange={handleInputChange}
          />
          <div className="button-container">
            <button className="join-game-confirm-button" onClick={handleConfirmClick}>
              Join
            </button>
            <button onClick={closeModal} className="close-button">X</button>
          </div>
          {errorMessage && <div className="error-message">{errorMessage}</div>}
        </Modal>

        <Modal
          isOpen={lobbyOpen}
          onRequestClose={() => setLobbyOpen(false)}
          contentLabel="Game Lobby Modal"
          className="lobby-modal"
          overlayClassName="modal-overlay"
        >
          <div className="lobby-content">
            <button className="close-button" onClick={() => setLobbyOpen(false)}>&times;</button>

            <h3 className="lobby-title">Game Lobby</h3>
            <p className="lobby-game-id">Game ID: <span>{joinedGameId}</span></p>
            {lobbyStatus && (
              <p className="lobby-game-id">Status: <span>{lobbyStatus}</span></p>
            )}

            <div className="lobby-players">
              {!lobbyAdmin && lobbyPlayers.length === 0 ? (
                <p className="lobby-empty">Loading players...</p>
              ) : (
                <>
                  {lobbyAdmin && (
                    <div className="lobby-player-row host">
                      <span className="lobby-player-icon">&#9819;</span>
                      <span className="lobby-player-name">
                        {lobbyAdmin.name}{lobbyAdmin.id === userId ? ' (you)' : ''}
                      </span>
                      <span className="lobby-player-badge host">Host</span>
                    </div>
                  )}
                  {lobbyPlayers
                    .filter(player => player.id !== lobbyAdmin?.id)
                    .map(player => (
                      <div key={player.id} className="lobby-player-row">
                        <span className="lobby-player-icon">&#9827;</span>
                        <span className="lobby-player-name">
                          {player.name}{player.id === userId ? ' (you)' : ''}
                        </span>
                        <span className="lobby-player-badge joined">Joined</span>
                      </div>
                    ))}
                </>
              )}
            </div>

            <div className="lobby-pending">
              <span className="lobby-pending-emoji">&#9203;</span>
              <p className="lobby-pending-title">Waiting for the host to start the game</p>
              <p className="lobby-pending-subtitle">&#9642; Pending start from host &#9642;</p>
            </div>

            <button
              className="join-game-confirm-button"
              onClick={() => setLobbyOpen(false)}
              style={{ display: 'block', width: '100%', marginTop: '12px' }}
            >
              Close
            </button>
          </div>
        </Modal>
      </div>
    </>
  );
};

export default JoinGame;