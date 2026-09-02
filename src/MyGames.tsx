import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from './config';
import { getUserIdFromCookies } from './utils/GetUserIdFromCookies';
import { getTokenFromCookies } from './utils/GetTokenFromCookies';
import { isSessionExpired, redirectToLogin } from './utils/session';
import { useGame } from './GameContext';
import Modal from 'react-modal';
import { createSocket } from './utils/socket';
import './MyGames.css';

Modal.setAppElement('#root');

interface LobbyItem {
  game_id: string;
  status: string;
  admin: { name: string; user_id: string } | null;
}

const socket = createSocket();

const MyGames: React.FC = () => {
  const { setCurrentGameId, openStatus } = useGame();
  const [open, setOpen] = useState(false);
  const [games, setGames] = useState<LobbyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const loadedRef = useRef(false);

  const fetchGames = useCallback(async () => {
    const playerId = getUserIdFromCookies();
    const token = getTokenFromCookies();
    if (!playerId || !token) {
      redirectToLogin();
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/game/lobby/list/${playerId}`);
      if (!response.ok) {
        if (isSessionExpired(response.status)) {
          redirectToLogin();
          return;
        }
        // 429: rate limit del hosting free del downstream. Silencioso: la
        // lista se refresca por socket/visibility y setear un error acá
        // solo asustaría en el modal.
        if (response.status === 429) {
          return;
        }
        throw new Error('Error fetching games');
      }
      const data = await response.json();
      const activeGames = (data.games ?? []).filter(
        (g: LobbyItem) => g.status !== 'finished'
      );

      // Anti-parpadeo: no tocar el estado si la lista no cambió.
      setGames(prev =>
        JSON.stringify(prev) === JSON.stringify(activeGames) ? prev : activeGames
      );
      loadedRef.current = true;
      setError(null);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching my games:', err);
      if (!loadedRef.current) {
        // Sin datos previos: sí informamos el error.
        setError('Failed to fetch my games');
        setLoading(false);
      }
      // Si ya había una lista visible, la falla es silenciosa: los refrescos
      // de fondo nunca deben hacer titilar el modal.
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    void fetchGames();

    const handleUpdate = () => void fetchGames();
    socket.on('newGame', handleUpdate);
    socket.on('gameUpdated', handleUpdate);

    // Sin polling: la lista se refresca por socket (`newGame` al crearse una
    // partida / `gameUpdated` al unirse alguien) y al volver a la pestaña.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void fetchGames();
      }
    };
    const handleFocus = () => void fetchGames();
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleFocus);

    return () => {
      socket.off('newGame', handleUpdate);
      socket.off('gameUpdated', handleUpdate);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleFocus);
    };
  }, [open, fetchGames]);

  const handlePlay = (gameId: string) => {
    setCurrentGameId(gameId);
    setOpen(false);
    openStatus();
  };

  return (
    <>
      <div className="my-games-container">
        <button
          className="my-games-button"
          onClick={() => {
            setOpen(true);
            void fetchGames();
          }}
        >
          My Games
        </button>
        <Modal
          isOpen={open}
          onRequestClose={() => setOpen(false)}
          contentLabel="My Games Modal"
          className="my-games-modal"
          overlayClassName="modal-overlay"
        >
          <div className="my-games-content">
            <button className="close-button" onClick={() => setOpen(false)}>&times;</button>
            <h3 className="my-games-title">My Active Games</h3>

            {loading && <p className="my-games-empty">Loading...</p>}
            {error && <p className="my-games-error">{error}</p>}

            {!loading && !error && games.length === 0 && (
              <p className="my-games-empty">You have no active games.</p>
            )}

            <div className="my-games-list">
              {games.map(game => (
                <div key={game.game_id} className="my-games-item">
                  <div className="my-games-item-info">
                    <div className="my-games-item-name">
                      Host: {game.admin?.name ?? '—'}
                    </div>
                    <div className="my-games-item-status" style={{ color: statusColor(game.status) }}>
                      {game.status}
                    </div>
                    <div className="my-games-item-id">{game.game_id}</div>
                  </div>
                  <button
                    className="my-games-play-button"
                    onClick={() => handlePlay(game.game_id)}
                  >
                    Play
                  </button>
                </div>
              ))}
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
};

function statusColor(status: string): string {
  switch (status) {
    case 'created':
      return '#fbbf24';
    case 'pending_bet':
      return '#fbbf24';
    case 'started':
      return '#4ade80';
    default:
      return '#bbbbbb';
  }
}

export default MyGames;