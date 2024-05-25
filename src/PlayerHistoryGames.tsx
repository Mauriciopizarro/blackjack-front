import React, { useEffect, useState } from 'react';
import './PlayerHistoryGames.css';
import { getUserIdFromCookies } from './utils/GetUserIdFromCookies';
import io from 'socket.io-client';
import Skeleton, { SkeletonTheme } from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

interface Game {
  game_id: string;
  status: string;
  player_status: string;
}

const socket = io('http://localhost:3000');
const playerId = getUserIdFromCookies();

const PlayerHistoryGames: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await fetch(`https://api-gateway-z0qe.onrender.com/player/history/${playerId}`);
        if (!response.ok) {
          throw new Error('Error fetching data');
        }
        const data = await response.json();
        const latestGames = data.results?.reverse().slice(0, 5) || [];
        setGames(latestGames);
      } catch (err) {
        setError('Failed to fetch game history');
      } finally {
        setLoading(false);
      }
    };

    socket.on('newGame', fetchGames);
    fetchGames();

    return () => {
      socket.off('newGame', fetchGames);
    };
  }, [playerId]);

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
