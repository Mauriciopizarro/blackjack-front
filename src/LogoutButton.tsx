import React from 'react';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faRightFromBracket} from '@fortawesome/free-solid-svg-icons';
import {clearSessionCookies} from './utils/session';
import './LogoutButton.css';

const LogoutButton: React.FC = () => {
    const handleLogout = () => {
        // Limpiamos las cookies de sesión (token + userId) y vamos al login.
        // El redirect completo (window.location) destruye el contexto JS, por
        // lo que cualquier conexión socket.io se cierra de forma natural.
        clearSessionCookies();
        window.location.href = '/login';
    };

    return (
        <button
            className="logout-button"
            onClick={handleLogout}
            type="button"
            aria-label="Logout"
            title="Logout"
        >
            <FontAwesomeIcon icon={faRightFromBracket}/>
            Logout
        </button>
    );
};

export default LogoutButton;
