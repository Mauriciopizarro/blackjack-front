
import React, { useState } from 'react';
import axios from 'axios';
import Modal from 'react-modal';
import './AccountMoney.css';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faDollarSign } from '@fortawesome/free-solid-svg-icons';
import { getUserIdFromCookies } from './utils/GetUserIdFromCookies';
import { getTokenFromCookies } from './utils/GetTokenFromCookies';

Modal.setAppElement('#root'); // Asegúrate de que el ID coincida con el de tu div principal en index.html


const playerId = getUserIdFromCookies();
const token = getTokenFromCookies();

const WalletButton: React.FC = () => {
  const [modalIsOpen, setModalIsOpen] = useState(false);
  const [walletData, setWalletData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchWalletData = async () => {
    try {
        const response = await axios.get(`https://api-gateway-z0qe.onrender.com/wallet/get/${playerId}`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
      setWalletData(response.data);
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
