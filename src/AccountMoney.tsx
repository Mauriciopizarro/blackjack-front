
import React, { useState } from 'react';
import { API_BASE_URL } from './config';
import Modal from 'react-modal';
import './AccountMoney.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDollarSign } from '@fortawesome/free-solid-svg-icons';
import { getUserIdFromCookies } from './utils/GetUserIdFromCookies';
import { getTokenFromCookies } from './utils/GetTokenFromCookies';
import { isSessionExpired, redirectToLogin } from './utils/session';

Modal.setAppElement('#root'); // Asegúrate de que el ID coincida con el de tu div principal en index.html


interface WalletData {
  amount: number | string;
}

const WalletButton: React.FC = () => {
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [walletData, setWalletData] = useState<WalletData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchWalletData = async () => {
    const playerId = getUserIdFromCookies();
    const token = getTokenFromCookies();
    if (!playerId || !token) {
      redirectToLogin();
      return;
    }
    try {
        const response = await fetch(`${API_BASE_URL}/wallet/get/${playerId}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        if (!response.ok) {
          if (isSessionExpired(response.status)) {
            redirectToLogin();
            return;
          }
          throw new Error('Error fetching wallet');
        }
        const data: WalletData = await response.json();
      setWalletData(data);
      setModalIsOpen(true);
    } catch (err) {
      setError('Error al obtener los datos del monedero');
      setModalIsOpen(true);
    }
  };

  const closeModal = () => {
    setModalIsOpen(false);
    setWalletData(null);
    setError(null);
  };

  return (
    <div>
      <button className="wallet-button" onClick={fetchWalletData}>
            <FontAwesomeIcon icon={faDollarSign} />
      </button>
      <Modal
        isOpen={modalIsOpen}
        onRequestClose={closeModal}
        contentLabel="Wallet Data"
        className="wallet-modal"
        overlayClassName="wallet-overlay"
      >
        <button onClick={closeModal} className="close-button">X</button>
        {error ? (
          <div className="error-message">{error}</div>
        ) : (
          walletData && (
            <div className="wallet-data">
              <h2>Account money details</h2>
              <p style={{ fontSize: '22px', color: 'red'}}><strong>${walletData.amount}</strong></p>
            </div>
          )
        )}
      </Modal>
    </div>
  );
};

export default WalletButton;
