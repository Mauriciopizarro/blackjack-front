import './session.css';

/**
 * Manejo centralizado de sesión expirada.
 *
 * El gateway responde HTTP 400 + detail "Invalid Token" cuando el JWT
 * expiró o es inválido (ver fast_api_authentication.py). También tratamos
 * 401/403 por si el backend cambia a códigos estándar más adelante.
 */
export const isSessionExpired = (status: number, detail?: string): boolean => {
  if (status === 401 || status === 403) {
    return true;
  }
  return Boolean(detail && String(detail).toLowerCase().includes('invalid token'));
};

const expireCookie = (name: string) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`;
};

export const clearSessionCookies = () => {
  expireCookie('token');
  expireCookie('userId');
};

let sessionExpiredModalShown = false;

/**
 * Limpia la sesión y muestra un modal bloqueante "Session Expired" con un
 * botón "Login". El usuario NO puede seguir usando la app: el overlay cubre
 * toda la pantalla y la única salida es volver a loguearse (recarga completa).
 * Es idempotente: llamarlo N veces muestra un único modal.
 */
export const redirectToLogin = (_reason?: string) => {
  clearSessionCookies();

  if (sessionExpiredModalShown) {
    return;
  }
  sessionExpiredModalShown = true;

  const overlay = document.createElement('div');
  overlay.id = 'session-expired-overlay';

  const card = document.createElement('div');
  card.className = 'session-expired-card';

  const icon = document.createElement('div');
  icon.className = 'session-expired-icon';
  icon.textContent = '🔒';

  const title = document.createElement('h2');
  title.className = 'session-expired-title';
  title.textContent = 'Session Expired';

  const message = document.createElement('p');
  message.className = 'session-expired-message';
  message.textContent = 'Your session has expired. Please log in again to keep playing.';

  const button = document.createElement('button');
  button.className = 'session-expired-login-button';
  button.textContent = 'Login';
  button.addEventListener('click', () => {
    window.location.href = '/login';
  });

  card.appendChild(icon);
  card.appendChild(title);
  card.appendChild(message);
  card.appendChild(button);
  overlay.appendChild(card);
  document.body.appendChild(overlay);
};