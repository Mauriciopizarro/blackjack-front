import React, { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from './config';
import './PlayerHistoryGames.css';
import { getUserIdFromCookies } from './utils/GetUserIdFromCookies';
import { getTokenFromCookies } from './utils/GetTokenFromCookies';
import { createSocket } from './utils/socket';
import { isSessionExpired, redirectToLogin } from './utils/session';
import { fetchWithRetry } from './utils/http';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

interface Game {
  game_id: string;
  status: string;
  player_status: string;
}

const socket = createSocket();

// Los eventos `newGame` se emiten en cada creación/start de partida y llegan
// a TODOS los clientes. Sin este mínimo de separación (2s), una ráfaga de
// acciones dispararía N fetches de /player/history en cada pestaña abierta
// (el hosting free de Render responde 429 ante ráfagas).
const SOCKET_REFETCH_MIN_GAP_MS = 2000;

const PlayerHistoryGames: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchRef = useRef(0);

  const fetchGames = useCallback(async () => {
    const now = Date.now();
    if (now - lastFetchRef.current < SOCKET_REFETCH_MIN_GAP_MS) {
      return; // coalescing: ya se refrescó hace poco (evento socket redundante)
    }
    lastFetchRef.current = now;

    const playerId = getUserIdFromCookies();
    const token = getTokenFromCookies();
    if (!playerId || !token) {
      redirectToLogin();
      return;
    }
    try {
      const response = await fetchWithRetry(`${API_BASE_URL}/player/history/${playerId}`, undefined, {
        attempts: 4,
      });
      if (!response.ok) {
        if (isSessionExpired(response.status)) {
          redirectToLogin();
          return;
        }
        // 429/502/503: servicio downstream despertando/saturado. Silencioso:
        // el error ya lo maneja el retry y la lista vieja sigue visible.
        if (response.status === 429 || response.status === 502 || response.status === 503) {
          return;
        }
        throw new Error('Error fetching data');
      }
      const data = await response.json();
      const results = Array.isArray(data.results) ? data.results : [];
      const latestGames = [...results].reverse().slice(0, 5);
      setGames(latestGames);
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      setError('Failed to fetch game history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    socket.on('newGame', fetchGames);
    void fetchGames();

    return () => {
      socket.off('newGame', fetchGames);
    };
  }, [fetchGames]);

  if (loading) {
    return (
      <div className="player-history">
        <h2>Last games</h2>
        <ul>
          {[...Array(5)].map((_, index) => (
            <li key={index} className="game-item">
               <SkeletonTheme baseColor="#1c1c1c" highlightColor="#f5f5f5">
                <div><Skeleton width={100} height={20} /></div>
                <div><Skeleton width={50} height={20} /></div>
              </SkeletonTheme>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (error) {
    return <div className="player-history"><h6>{error}</h6></div>;
  }

  return (
    <div className="player-history">
      <h2>Last games</h2>
      <ul>
        {games.map(game => (
          <li key={game.game_id} className="game-item">
            <div>Status: {game.status}</div>
            <div style={{ color: game.player_status === 'winner' ? 'green' : game.player_status === 'looser' ? 'red' : game.player_status === 'playing' ? 'yellow' : 'white' }}>
              {game.player_status}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PlayerHistoryGames;
