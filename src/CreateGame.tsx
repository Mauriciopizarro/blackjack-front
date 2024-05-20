import React, { useState } from 'react';
import Modal from 'react-modal';
import './CreateGame.css';
import { getTokenFromCookies } from './utils/GetTokenFromCookies';
import { Toaster, toast } from 'sonner';

Modal.setAppElement('#root');

const CreateGame: React.FC = () => {
    const [gameInfo, setGameInfo] = useState<any>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');

    function setGameInCookies(name: string, value: string) {
        const expires = new Date();
        expires.setTime(expires.getTime() + 1 * 24 * 60 * 60 * 1000);
        const cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
        document.cookie = cookie;
    }

    const handleCreateGameClick = async () => {
        const token = getTokenFromCookies();

        if (token) {
            try {
                const response = await fetch(`https://api-gateway-z0qe.onrender.com/game/create`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({}),
                });

                const responseData = await response.json();

                if (response.ok) {
                    setGameInCookies("gameId", responseData.id);
                    setGameInfo(responseData);
                } else if (responseData.detail.includes("is already created, please start them")) {
                    const gameIdMatch = responseData.detail.match(/Game id ([a-f0-9-]+) is already created/);
                    if (gameIdMatch) {
                        const existingGameId = gameIdMatch[1];
                        setGameInCookies("gameId", existingGameId);
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
    };

    const startGame = async () => {
        try {
            const token = getTokenFromCookies();
            const response = await fetch(`https://api-gateway-z0qe.onrender.com/game/start/${gameInfo.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
            });

            if (response.ok) {
                toast.success('Game started successfully!');
            } else {
                const errorData = await response.json();
                toast.error(errorData.detail);
            }
        } catch (error) {
            setErrorMessage('Error starting the game');
        }
    };

    const closeModal = () => {
        setGameInfo(null);
        setErrorMessage('');
    };

    return (
        <>
            <Toaster position="bottom-center" richColors />
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
                                <button onClick={() => {startGame(); closeModal();}}>Start Game</button>
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
