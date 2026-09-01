// Configuración central del front.
//
// Las API calls apuntan al Gateway. Prioridad:
//  1. window.__API_BASE_URL__ — inyectado en runtime por server.js desde la
//     env `GATEWAY_URL` (solución para Render Docker sin build args).
//  2. import.meta.env.VITE_API_BASE_URL — build-time (dev / otros hosts).
//  3. fallback local http://localhost:8000 (docker compose local).
//
const injectedBaseUrl: string =
  typeof window !== 'undefined' &&
  (window as any).__API_BASE_URL__;
export const API_BASE_URL: string =
  injectedBaseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';