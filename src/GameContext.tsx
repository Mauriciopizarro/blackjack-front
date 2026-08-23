import React, { createContext, useContext, useState, type ReactNode } from 'react';

interface GameContextValue {
  currentGameId: string | null;
  setCurrentGameId: (id: string) => void;
  statusOpen: boolean;
  openStatus: () => void;
  closeStatus: () => void;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider: React.FC<GameProviderProps> = ({ children }) => {
  const [currentGameId, setCurrentGameIdState] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);

  const setCurrentGameId = (id: string) => setCurrentGameIdState(id);
  const openStatus = () => setStatusOpen(true);
  const closeStatus = () => setStatusOpen(false);

  return (
    <GameContext.Provider
      value={{ currentGameId, setCurrentGameId, statusOpen, openStatus, closeStatus }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameContextValue => {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return ctx;
};