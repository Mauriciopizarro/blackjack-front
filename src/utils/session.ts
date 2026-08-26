import { toast } from 'sonner';

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

/** Limpia la sesión y manda al login; no hay vuelta hasta re-loguearse. */
export const redirectToLogin = (reason?: string) => {
  clearSessionCookies();
  toast.error(reason ?? 'Your session expired. Please log in again.');
  // location.href recarga la app completa: ningún estado queda vivo.
  window.location.href = '/login';
};