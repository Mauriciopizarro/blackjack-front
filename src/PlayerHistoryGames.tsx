
import React, { useEffect, useState } from 'react';
import './PlayerHistoryGames.css';
import { getUserIdFromCookies } from './utils/GetUserIdFromCookies';

interface Game {
  game_id: string;
  status: string;
  player_status: string;
}

const playerId = getUserIdFromCookies();

const PlayerHistoryGames: React.FC = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchGames = async () => {
      try {
        const response = await fetch(`https://api-gateway-z0qe.onrender.com/player/history/${playerId}`);
        if (!response.ok) {
          throw new Error('Error fetching data');
        }
        const data = await response.json();
        const latestGames = data.results.reverse().slice(0, 5);
        setGames(latestGames);
      } catch (err) {
        
      } finally {
        setLoading(false);
      }
    };

    fetchGames();
  }, [playerId]);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="player-history">
      <h2>Last games</h2>
      <ul>
        {games.map(game => (
          <li key={game.game_id} className="game-item">
            <div>Status: {game.status}</div>
            <div style={{ color: game.player_status === 'winner' ? 'green' : game.player_status === 'loser' ? 'red' : game.player_status === 'playing' ? 'yellow' : 'red' }}>
              {game.player_status}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default PlayerHistoryGames;
