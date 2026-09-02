/**
 * Utilidades HTTP compartidas.
 *
 * fetchWithRetry reintenta automáticamente cuando el gateway devuelve
 * 429/502/503/504. Esos status significan que un servicio downstream
 * (Render free tier) está hibernado/despertando o saturado: el primer
 * request tras despertar suele ser rechazado por rate-limit hasta que la
 * instancia termina de levantar. Unos pocos reintentos con backoff
 * exponencial (y jitter) alcanzan para que la acción del usuario sobreviva
 * al cold-start sin que tenga que apretar el botón de nuevo.
 *
 * SOLO usar en operaciones idempotentes/lectura: create/start están
 * protegidos por el guard "already created" del game_management; las
 * lecturas (wallet/history/lobby/status) son seguras de reintentar. NO
 * reintentar POSTs de juego (deal/make_bet/stand) porque duplicaría la
 * acción si la primera llegó a ejecutarse pero la respuesta se perdió.
 */

const RETRIABLE_STATUS = new Set<number>([429, 502, 503, 504]);

const MAX_DELAY_MS = 30000;

const sleep = (ms: number): Promise<void> =>
  new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const backoffDelayMs = (attempt: number, baseDelayMs: number): number => {
  const exp = baseDelayMs * 2 ** attempt;
  return Math.min(exp + Math.random() * 300, MAX_DELAY_MS);
};

const retryAfterMs = (response: Response): number | null => {
  const header = response.headers.get('Retry-After');
  if (!header) {
    return null;
  }
  const seconds = Number(header);
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return null;
  }
  return Math.min(seconds * 1000, MAX_DELAY_MS);
};

interface FetchWithRetryOptions {
  /** Intentos totales (incluye el primero). Default 4. */
  attempts?: number;
  /** Delay base del backoff exponencial en ms. Default 1000. */
  baseDelayMs?: number;
  /** Callback opcional: avisar al usuario que se está reintentando. */
  onRetry?: (attempt: number, status: number, waitMs: number) => void;
}

export const fetchWithRetry = async (
  url: string,
  init?: RequestInit,
  options?: FetchWithRetryOptions,
): Promise<Response> => {
  const attempts = options?.attempts ?? 4;
  const baseDelayMs = options?.baseDelayMs ?? 1000;
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, init);
      lastResponse = response;

      if (!RETRIABLE_STATUS.has(response.status)) {
        return response;
      }
      if (attempt >= attempts - 1) {
        break; // agotamos reintentos: devolvemos la respuesta con su status
      }

      const waitMs = retryAfterMs(response) ?? backoffDelayMs(attempt, baseDelayMs);
      options?.onRetry?.(attempt + 1, response.status, waitMs);
      await sleep(waitMs);
    } catch (networkError) {
      // Error de red: el servicio puede estar todavía levantando.
      if (attempt >= attempts - 1) {
        throw networkError;
      }
      await sleep(backoffDelayMs(attempt, baseDelayMs));
    }
  }

  return lastResponse as Response;
};