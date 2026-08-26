import React, { useState, useEffect, useRef, useCallback } from 'react';
import { API_BASE_URL } from './config';
import Modal from 'react-modal';
import './CreateGame.css';
import { getTokenFromCookies } from './utils/GetTokenFromCookies';
import { toast } from 'sonner';
import type { Socket } from 'socket.io-client';
import { createSocket } from './utils/socket';
import { useGame } from './GameContext';

Modal.setAppElement('#root');

interface GameInfo {
    id: string;
    admin?: unknown;
}

const CreateGame: React.FC = () => {
    const [gameInfo, setGameInfo] = useState<GameInfo | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');
    // El socket es un valor transitorio, no estado de render: usamos una ref.
    // Además ya es un singleton desde utils/socket, así que lo guardamos una vez.
    const socketRef = useRef<Socket | null>(null);
    const [starting, setStarting] = useState(false);
    const { setCurrentGameId, openStatus } = useGame();

    useEffect(() => {
        // createSocket() devuelve el singleton; lo guardamos sin disparar re-renders.
        socketRef.current = createSocket();
        return () => {
            socketRef.current = null;
        };
    }, []);

    const handleCreateGameClick = useCallback(async () => {
        const token = getTokenFromCookies();

        if (token && socketRef.current) {
            try {
                const response = await fetch(`${API_BASE_URL}/game/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({}),
                });

                const responseData = await response.json();

                if (response.ok) {
                    setCurrentGameId(responseData.id);
                    setGameInfo(responseData);
                } else if (responseData.detail?.includes("is already created, please start them")) {
                    const gameIdMatch = responseData.detail.match(/Game id ([a-f0-9-]+) is already created/);
                    if (gameIdMatch) {
                        const existingGameId = gameIdMatch[1];
                        setCurrentGameId(existingGameId);
                        setGameInfo({
                            id: existingGameId,
                            admin: responseData.admin // Ajusta esto según la estructura de tu respuesta
                        });
                    } else {
                        toast.error(responseData.detail);
                    }
                } else {
                    toast.error(responseData.detail);
                }
            } catch (error) {
                setErrorMessage('Error creating the game');
            }
        }
    }, [setCurrentGameId]);

    const startGame = useCallback(async () => {
        if (!gameInfo) {
            return;
        }

        setStarting(true);
        try {
            const token = getTokenFromCookies();
            const response = await fetch(`${API_BASE_URL}/game/start/${gameInfo.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                toast.success('Game started successfully!');
                openStatus();
                socketRef.current?.emit('gameUpdated', { gameId: gameInfo.id });
                socketRef.current?.emit('newGame');
            } else {
                const errorData = await response.json();
                toast.error(errorData.detail);
            }
        } catch (error) {
            setErrorMessage('Error starting the game');
        } finally {
            setStarting(false);
        }
    }, [gameInfo, openStatus]);

    const closeModal = () => {
        setGameInfo(null);
        setErrorMessage('');
    };

    return (
        <>
            <div className="create-game-container">
                <button className='createButton' onClick={handleCreateGameClick}>Create Game</button>

                <Modal
                    isOpen={!!gameInfo}
                    onRequestClose={closeModal}
                    contentLabel="Game Info"
                    className="game-info-modal"
                    overlayClassName="modal-overlay"
                >
                    {gameInfo && (
                        <>
                            <p>The game was created successfully!</p>
                            <p>Game ID: {gameInfo.id}</p>
                            
                            <p>f you don't want to add anyone else to this game, you can click the start button.</p>
                            <div className="button-container">
                                <button
    onClick={async () => { await startGame(); closeModal(); }}
    disabled={starting}
>{starting ? 'Starting...' : 'Start Game'}</button>
                                <button className="closebutton" onClick={closeModal}>Close</button>
                            </div>
                        </>
                    )}
                </Modal>

                {errorMessage && (
                    <div className="error-message-container">
                        <div className="error-message">{errorMessage}</div>
                        <button className="close-error" onClick={() => setErrorMessage('')}>
                            X
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

export default CreateGame;
