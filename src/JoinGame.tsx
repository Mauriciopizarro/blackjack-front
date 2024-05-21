import React, { useState } from 'react';
import Modal from 'react-modal';
import './JoinGame.css';
import { getTokenFromCookies } from './utils/GetTokenFromCookies';
import { Toaster, toast } from 'sonner';

Modal.setAppElement('#root');

const JoinGame: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [gameId, setGameId] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleJoinClick = () => {
    setIsOpen(true);
  };

  function setGameInCookies(name: string, value: string) {
    const expires = new Date();
    expires.setTime(expires.getTime() + 1 * 24 * 60 * 60 * 1000);
    const cookie = `${name}=${value};expires=${expires.toUTCString()};path=/`;
    document.cookie = cookie;
  }

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setGameId(event.target.value);
  };

  const handleConfirmClick = async () => {
    const token = getTokenFromCookies();

    if (token) {
      try {
        const response = await fetch(`https://api-gateway-z0qe.onrender.com/game/enroll_player/${gameId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });

        const responseData = await response.json();

        if (response.status !== 200) {
          toast.error(responseData.detail);
        } else {
          setGameInCookies("gameId", gameId)
          setGameId('');
          setIsOpen(false);
          setErrorMessage('');
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
      <Toaster position="bottom-center" richColors />
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
      </div>
    </>
  );
};

export default JoinGame;
