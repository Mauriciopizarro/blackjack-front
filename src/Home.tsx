import React, { useEffect, useLayoutEffect, useState } from 'react'
import './Home.css'
import JoinGame from './JoinGame';
import CreateGame from './CreateGame';
import GameStatusButton from './GetStatusGame';
import WalletButton from './AccountMoney';
import PlayerHistoryGames from './PlayerHistoryGames';
import MyGames from './MyGames';
import { GameProvider } from './GameContext';
import { getTokenFromCookies } from './utils/GetTokenFromCookies';
import { redirectToLogin } from './utils/session';
import LogoutButton from './LogoutButton';


const MOBILE_BREAKPOINT = 768;

const Home: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // useLayoutEffect: corre antes del paint, evita flash del layout desktop
  useLayoutEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Cerrar el menú al cambiar a desktop
  useEffect(() => {
    if (!isMobile) setMobileMenuOpen(false);
  }, [isMobile]);

  // Cerrar menú al presionar Escape
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    document.addEventListener('keyup', handleEscape);
    return () => document.removeEventListener('keyup', handleEscape);
  }, [mobileMenuOpen]);

  // Sin token no hay nada que hacer acá. Chequeo al entrar Y de forma
  // continua: si borran/expira la cookie mientras estás en la home,
  // te manda al login sin dejar interactuar.
  useEffect(() => {
    const checkSession = () => {
      if (!getTokenFromCookies()) {
        redirectToLogin();
      }
    };
    checkSession();
    // Chequeo barato (solo lee la cookie, sin requests): lo corremos al volver
    // a la pestaña en vez de en un timer que corre constantemente.
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkSession();
      }
    };
    window.addEventListener('focus', checkSession);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('focus', checkSession);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const toggleMobileMenu = () => setMobileMenuOpen(v => !v);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  if (isMobile) {
    return (
      <div className='home'>
        <GameProvider>
                    <GameStatusButton />
          <PlayerHistoryGames />

          {/* Hamburger button — colapsa todos los botones en un "sandwich" */}
          <button
            className={`hamburger-button ${mobileMenuOpen ? 'open' : ''}`}
            onClick={toggleMobileMenu}
            aria-label="Abrir menú"
            aria-expanded={mobileMenuOpen}
          >
            <span className="hamburger-bar"></span>
            <span className="hamburger-bar"></span>
            <span className="hamburger-bar"></span>
          </button>

          {/* Mobile menu overlay — click fuera para cerrar */}
          <div
            className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}
            onClick={(e) => {
              if (e.target === e.currentTarget) closeMobileMenu();
            }}
          >
            <div className="mobile-menu-content">
              <CreateGame />
              <JoinGame />
              <MyGames />
              <WalletButton />
              <LogoutButton />
            </div>
          </div>
        </GameProvider>
      </div>
    )
  }

  return (
    <div className='home'>
      <GameProvider>
        <LogoutButton />
        <GameStatusButton />
        <div className='topbar'>
          {<CreateGame/>}
          {<JoinGame/>}
          {<MyGames/>}
        </div>
        <div className='buttons'>
          {<WalletButton/>}
          {<PlayerHistoryGames/>}
        </div>
      </GameProvider>
    </div>
  )
}

export default Home;
