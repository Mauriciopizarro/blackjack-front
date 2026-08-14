import { io } from 'socket.io-client';

const getDefaultSocketUrl = () => {
  if (typeof window === 'undefined') {
    return 'http://localhost:3000';
  }

  if (import.meta.env.DEV) {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }

  return window.location.origin;
};

export const socketUrl = import.meta.env.VITE_SOCKET_URL || getDefaultSocketUrl();

const socket = io(socketUrl);

export const createSocket = () => socket;
