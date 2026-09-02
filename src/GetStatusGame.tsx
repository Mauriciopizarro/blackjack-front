import React, { useCallback, useEffect, useState } from "react";
import { API_BASE_URL } from "./config";
import Modal from "react-modal";
import { toast } from "sonner";
import { getTokenFromCookies } from "./utils/GetTokenFromCookies";
import { getUserIdFromCookies } from "./utils/GetUserIdFromCookies";
import "./GetStatusGame.css";
import { createSocket } from "./utils/socket";
import { isSessionExpired, redirectToLogin } from "./utils/session";
import { useGame } from "./GameContext";
// Cartas locales: Vite las importa estáticamente, las cachea con hash de
// contenido y las sirve desde el mismo origen (sin dependencia de CDNs externos).
import cardTwo from "./assets/cards/two.png";
import cardThree from "./assets/cards/three.png";
import cardFour from "./assets/cards/four.png";
import cardFive from "./assets/cards/five.png";
import cardSix from "./assets/cards/six.png";
import cardSeven from "./assets/cards/seven.png";
import cardEight from "./assets/cards/eight.png";
import cardNine from "./assets/cards/nine.png";
import cardTen from "./assets/cards/ten.png";
import cardJack from "./assets/cards/jack.png";
import cardQueen from "./assets/cards/queen.png";
import cardKing from "./assets/cards/king.png";
import cardAce from "./assets/cards/ace.png";
import cardHidden from "./assets/cards/hidden.jpg";

Modal.setAppElement("#root");

const socket = createSocket();

interface GameStatus {
  croupier: {
    cards: string[];
    name: string;
    status: string;
    total_points: number[];
  };
  players: {
    cards: string[];
    id: string;
    name: string;
    status: string;
    total_points: number[];
    bet_amount: number;
  }[];
  players_quantity: number;
  status_game: string;
}

const cardImages: { [key: string]: string } = {
  "2": cardTwo,
  "3": cardThree,
  "4": cardFour,
  "5": cardFive,
  "6": cardSix,
  "7": cardSeven,
  "8": cardEight,
  "9": cardNine,
  "10": cardTen,
  J: cardJack,
  Q: cardQueen,
  K: cardKing,
  A: cardAce,
  "hidden card": cardHidden,
};

// Denominaciones de casino, de mayor a menor para el desglose del saldo.
const CHIP_DENOMS = [1000, 500, 100, 25, 10, 5, 1];

// Valores de blackjack para el conteo animado de puntos. El total OFICIAL
// (con ases flexibles y pares de puntaje) lo provee el backend en
// total_points; este cálculo solo alimenta la animación mientras las cartas
// van cayendo.
const cardValue = (card: string): number => {
  if (card === "A") return 11;
  const n = Number(card);
  return Number.isNaN(n) ? 10 : n;
};

/** Total acumulado carta a carta, bajando el as de 11 a 1 si se pasa de 21. */
const runningTotals = (cards: string[]): number[] => {
  let total = 0;
  let softAces = 0;
  const totals: number[] = [];
  for (const card of cards) {
    if (card === "A") {
      softAces += 1;
      total += 11;
    } else {
      total += cardValue(card);
    }
    while (total > 21 && softAces > 0) {
      total -= 10;
      softAces -= 1;
    }
    totals.push(total);
  }
  return totals;
};

/**
 * Cantidad de cartas ya "aterrizadas" según la animación de reparto.
 * Compartido por el contador de puntos y el status del jugador para que
 * ambos se revelen recién después de que sus cartas aparecieron.
 */
const useRevealCount = (
  cardsLength: number,
  baseDelay: number,
  delayStep: number,
): number => {
  const revealedRef = React.useRef(0);
  const [revealed, setRevealed] = useState(0);

  useEffect(() => {
    // Nueva mano o reset: volvemos a cero.
    if (cardsLength < revealedRef.current) {
      revealedRef.current = 0;
      setRevealed(0);
    }

    const from = Math.min(revealedRef.current, cardsLength);
    const timers: number[] = [];
    for (let i = from; i < cardsLength; i++) {
      // El número aparece recién DESPUÉS de que la carta aterrizó por completo
      // (vuelo de 550ms + margen), para no hacer spoiler del puntaje.
      const t = window.setTimeout(
        () => {
          revealedRef.current = i + 1;
          setRevealed(i + 1);
        },
        baseDelay + i * delayStep + 700,
      );
      timers.push(t);
    }
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [cardsLength, baseDelay, delayStep]);

  return revealed;
};

interface PointsCounterProps {
  cards: string[];
  /** Valor oficial del backend (total_points.join(', ')) para el estado final. */
  finalText: string;
  /** Retiene el valor oficial mientras la compuerta global esté activa. */
  hold?: boolean;
  baseDelay?: number;
  delayStep?: number;
}

/**
 * Cuenta los puntos a medida que las cartas van cayendo: muestra el total
 * acumulado de las cartas ya visibles (sincronizado con la animación de
 * reparto) y, cuando terminó, muestra el valor oficial del backend.
 */
const PointsCounter: React.FC<PointsCounterProps> = ({
  cards,
  finalText,
  hold = false,
  baseDelay = 0,
  delayStep = 350,
}) => {
  const totals = React.useMemo(() => runningTotals(cards), [cards]);
  const revealed = useRevealCount(cards.length, baseDelay, delayStep);

  // El valor oficial del backend solo se muestra cuando todas las cartas
  // propias aterrizaron Y la compuerta global de resultados está levantada
  // (puntajes finales de otros spots / cartas del croupier ya visibles).
  const finished = !hold && revealed >= cards.length;
  return <>{finished ? finalText : String(totals[revealed - 1] ?? 0)}</>;
};

/**
 * Slot de carta del croupier: el nodo se mantiene montado siempre para una
 * posición dada, de modo que cuando la carta pasa de oculta (hidden card) a
 * visible el giro 3D es continuo — no hay desaparición/reaparición.
 *
 * Reglas internas:
 *  - Si la carta es `hidden card`  → muestra el dorso (face-down), sin flip.
 *  - Si pasa de `hidden card` a una carta real → gira 180° para revelarla
 *    (con un breve delay mostrando el dorso).
 *  - Si la carta ya era visible y se mantiene igual → no anima.
 */
const CardSlot: React.FC<{
  card: string;
  style?: React.CSSProperties;
}> = ({ card, style }) => {
  const isHidden = card === "hidden card";
  const [flipped, setFlipped] = useState(!isHidden);
  const prevCardRef = React.useRef(card);

  useEffect(() => {
    const prev = prevCardRef.current;
    prevCardRef.current = card;

    if (prev === "hidden card" && card !== "hidden card") {
      // Revelación: dejo el dorso visible unos 250ms y luego giro.
      const t = window.setTimeout(() => setFlipped(true), 250);
      return () => window.clearTimeout(t);
    }
    // Sincronizo el estado con el nuevo valor (caso inicial / reset).
    setFlipped(!isHidden);
  }, [card, isHidden]);

  const backSrc = cardImages["hidden card"];
  const frontSrc = cardImages[card];

  return (
    <div className="flip-card deal-anim" style={style}>
      <div className={`flip-card-inner${flipped ? " flipped" : ""}`}>
        <img
          className="flip-face flip-face-back"
          src={backSrc}
          alt="hidden card"
        />
        <img
          className="flip-face flip-face-front"
          src={frontSrc}
          alt={`${card} card`}
        />
      </div>
    </div>
  );
};

/**
 * El status del jugador (playing / waiting / winner...) también se revela
 * recién cuando terminaron de caer todas sus cartas Y la compuerta global
 * de resultados (`hold`) está levantada — así un winner/looser jamás aparece
 * antes de que las cartas del resto de la mesa (croupier incluido) estén
 * visibles.
 */
const DelayedStatus: React.FC<{
  cards: string[];
  status: string;
  hold?: boolean;
  baseDelay?: number;
  delayStep?: number;
}> = ({ cards, status, hold = false, baseDelay = 0, delayStep = 350 }) => {
  const revealed = useRevealCount(cards.length, baseDelay, delayStep);

  if (hold || revealed < cards.length) {
    return null;
  }
  return <span className={`spot-status st-${status}`}>{status}</span>;
};

/* ===== Compuerta global de resultados ===== */

/** Total de cartas sobre la mesa para una instantánea del juego. */
const countTableCards = (gs: GameStatus): number =>
  gs.croupier.cards.length +
  gs.players.reduce((acc, p) => acc + p.cards.length, 0);

/** Margen extra tras aterrizar la última carta antes de mostrar resultados. */
const RESULT_SETTLE_MS = 450;

/**
 * Milisegundos que hay que retener los resultados (totales oficiales y
 * winner/looser) tras recibir una nueva instantánea, para que aparezcan
 * recién cuando TODAS las cartas de esa actualización ya se vieron en
 * pantalla: las que sacó el croupier tras un stand/bust y el giro 3D de su
 * carta oculta. Devuelve 0 si no hay nada nuevo que esperar.
 */
const computeGateMs = (prev: GameStatus | null, next: GameStatus): number => {
  const totalNow = countTableCards(next);
  const playersBase = next.players.length * 700;

  if (!prev) {
    // Primera carga del tablero: se reparte todo desde cero.
    return playersBase + totalNow * 350 + RESULT_SETTLE_MS;
  }

  const totalPrev = countTableCards(prev);

  // Mano nueva / tablero reseteado (menos cartas que antes): reparto íntegro.
  if (totalNow < totalPrev) {
    return playersBase + totalNow * 350 + RESULT_SETTLE_MS;
  }

  const newCards = totalNow - totalPrev;
  const croupierFlipped =
    prev.croupier.cards.includes("hidden card") &&
    !next.croupier.cards.includes("hidden card");

  if (newCards === 0 && !croupierFlipped) {
    return 0; // Actualización sin cartas nuevas ni flip: no retenemos nada.
  }

  // Cada carta tarda ~350ms en el ciclo de reparto + su vuelo de aterrizaje;
  // el giro del croupier añade 250ms de dorso + 800ms de rotación.
  const flipExtra = croupierFlipped ? 1050 : 0;
  const landingBuffer = newCards > 0 ? 700 : 0;
  return newCards * 350 + flipExtra + landingBuffer + RESULT_SETTLE_MS;
};

const GameStatusButton: React.FC = () => {
  const [pendingChips, setPendingChips] = useState<number[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus | null>(null);
  // Compuerta de resultados: timestamp (epoch ms) hasta el cual se retienen
  // los totales oficiales y los winner/looser. 0 = sin retención.
  const [gateUntil, setGateUntil] = useState(0);
  // Espejo del último gameStatus aplicado; lo usa computeGateMs para
  // comparar instantáneas sin depender de closures stale.
  const gameStatusRef = React.useRef<GameStatus | null>(null);
  // Backoff ante 429 (rate limit del hosting free del downstream): mientras
  // esté activo, el respaldo por polling no llama a la API para no agravar
  // el límite. Los errores puntuales de acciones sí muestran su toast.
  const rateLimitUntilRef = React.useRef(0);
  const { currentGameId, statusOpen, closeStatus } = useGame();
  const playerId = getUserIdFromCookies();

  // Los resultados están retenidos hasta que expire la compuerta. Este
  // timeout fuerza el re-render que los revela apenas vence.
  const resultsReady = gateUntil <= 0 || Date.now() >= gateUntil;
  useEffect(() => {
    if (resultsReady) {
      return;
    }
    const t = window.setTimeout(
      () => setGateUntil((g) => (g > 0 ? 0 : g)),
      Math.max(gateUntil - Date.now(), 0),
    );
    return () => window.clearTimeout(t);
  }, [gateUntil, resultsReady]);

  // El token se lee SIEMPRE fresco: si la cookie desapareció (sesión
  // expirada/borrada), corta todo y manda al login.
  const getAuthHeaders = (): Record<string, string> | null => {
    const token = getTokenFromCookies();
    if (!token) {
      redirectToLogin();
      return null;
    }
    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  const fetchGameStatus = useCallback(async () => {
    const gameId = currentGameId;
    if (!gameId) {
      toast.error("No game selected");
      return null;
    }

    const headers = getAuthHeaders();
    if (!headers) {
      return null;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/game/status/${gameId}`, {
        method: "GET",
        headers,
      });

      // 429 = rate limit del downstream (hosting free): pausa silenciosa del
      // polling — sin toast, que el propio intervalo de respaldo reintenta
      // pasado el backoff y spamearlo solo agrava el límite.
      if (response.status === 429) {
        rateLimitUntilRef.current = Date.now() + 30000;
        console.warn("Downstream rate-limited (429); pausing status polling for 30s");
        return null;
      }

      const responseData = await response.json();

      if (!response.ok) {
        if (isSessionExpired(response.status, responseData.detail)) {
          redirectToLogin();
          return null;
        }
        toast.error(responseData.detail);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Anti-parpadeo + compuerta de resultados: solo actualizamos el estado
      // si los datos realmente cambiaron (evita re-renders entre polls) y, al
      // aplicar una instantánea nueva, calculamos cuánto hay que retener los
      // resultados hasta que TODAS las cartas nuevas aterrizaron en pantalla.
      const next = responseData as GameStatus;
      const prev = gameStatusRef.current;
      if (prev && JSON.stringify(prev) === JSON.stringify(next)) {
        return next;
      }
      const gateMs = computeGateMs(prev, next);
      gameStatusRef.current = next;
      setGameStatus(next);
      setGateUntil(gateMs > 0 ? Date.now() + gateMs : 0);
      return next;
    } catch (error) {
      console.error("Error getting game status:", error);
      return null;
    }
  }, [currentGameId]);

  useEffect(() => {
    if (!statusOpen || !currentGameId) {
      return;
    }

    const gameId = currentGameId;

    // Al abrir o CAMBIAR de partida limpiamos el tablero anterior (si no,
    // quedarían visibles los datos del juego anterior hasta el próximo poll)
    // y traemos el estado fresco del juego seleccionado de inmediato.
    setGameStatus(null);
    gameStatusRef.current = null;
    setPendingChips([]);
    setGateUntil(0);
    void fetchGameStatus();

    const rejoinGame = () => {
      socket.emit("joinGame", gameId);
      void fetchGameStatus();
    };

    const handleGameUpdated = ({
      gameId: updatedGameId,
    }: {
      gameId?: string;
    }) => {
      if (updatedGameId === gameId) {
        void fetchGameStatus();
      }
    };

    // Entramos a la sala del juego. Socket.IO pierde la membresía de las salas
    // cuando el cliente se reconecta (servidor reiniciado / red cortada / tab
    // dormida), así que nos volvemos a unir y refrescamos en cada `connect`.
    socket.emit("joinGame", gameId);
    socket.on("connect", rejoinGame);
    socket.on("gameUpdated", handleGameUpdated);

    // Sin polling agresivo: la fuente primaria de actualizaciones en vivo es
    // el socket (`gameUpdated`). El respaldo refresca solo al volver a la
    // pestaña y, como última red de seguridad, cada 20s PERO únicamente si el
    // socket está desconectado — así no golpeamos la API (hosting free).
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        void fetchGameStatus();
      }
    };
    const handleFocus = () => void fetchGameStatus();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    const statusInterval = window.setInterval(() => {
      if (!socket.connected && Date.now() >= rateLimitUntilRef.current) {
        void fetchGameStatus();
      }
    }, 20000);

    return () => {
      socket.off("connect", rejoinGame);
      socket.emit("leaveGame", gameId);
      socket.off("gameUpdated", handleGameUpdated);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      window.clearInterval(statusInterval);
    };
  }, [fetchGameStatus, statusOpen, currentGameId]);

  // Saldo del jugador: se consulta al abrir el modal y alimenta la
  // conversión a fichas (stock limitado por denominación).
  const [walletAmount, setWalletAmount] = useState<number | null>(null);
  useEffect(() => {
    if (!statusOpen || !currentGameId) {
      return;
    }
    const playerIdFresh = getUserIdFromCookies();
    const headers = getAuthHeaders();
    if (!headers || !playerIdFresh) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/wallet/get/${playerIdFresh}`,
          { headers },
        );
        if (!response.ok || isSessionExpired(response.status)) {
          if (isSessionExpired(response.status)) {
            redirectToLogin();
          }
          return;
        }
        const data = await response.json();
        if (!cancelled) {
          setWalletAmount(Math.max(0, Math.floor(Number(data.amount ?? 0))));
        }
      } catch (error) {
        console.error("Error fetching wallet for chips:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [statusOpen, currentGameId]);

  const notifyGameUpdated = (gameId: string, statusGame?: string) => {
    socket.emit("gameUpdated", { gameId });

    if (statusGame === "finished") {
      socket.emit("newGame");
    }
  };

  const handleDealCard = async () => {
    const gameId = currentGameId;
    if (!gameId) {
      toast.error("No game selected");
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/game/deal_card/${gameId}`, {
        method: "POST",
        headers,
      });

      if (!response.ok) {
        const responseData = await response.json();
        if (isSessionExpired(response.status, responseData.detail)) {
          redirectToLogin();
          return;
        }
        toast.error(responseData.detail);
        return;
      }

      const updatedData = await fetchGameStatus();
      if (updatedData) {
        notifyGameUpdated(gameId, updatedData.status_game);
      }
    } catch (error) {
      console.error("Error dealing card:", error);
    }
  };

  const handleStand = async () => {
    const gameId = currentGameId;
    if (!gameId) {
      toast.error("No game selected");
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/game/stand/${gameId}`, {
        method: "POST",
        headers,
      });

      if (!response.ok) {
        const responseData = await response.json();
        if (isSessionExpired(response.status, responseData.detail)) {
          redirectToLogin();
          return;
        }
        toast.error(responseData.detail);
        return;
      }

      const updatedData = await fetchGameStatus();
      if (updatedData) {
        notifyGameUpdated(gameId, updatedData.status_game);
      }
    } catch (error) {
      console.error("Error standing player:", error);
    }
  };

  const handleBetSubmit = async () => {
    const gameId = currentGameId;
    if (!gameId) {
      toast.error("No game selected");
      return;
    }

    const numericBet = pendingBetAmount;
    if (!numericBet || numericBet < 1) {
      toast.error("Enter a valid bet amount");
      return;
    }
    if (walletAmount !== null && numericBet > walletAmount) {
      toast.error("Insufficient balance for this bet");
      return;
    }

    const headers = getAuthHeaders();
    if (!headers) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/game/make_bet/${gameId}`, {
        method: "POST",
        headers,
        body: JSON.stringify({ bet_amount: numericBet, player_id: playerId }),
      });

      if (!response.ok) {
        const responseData = await response.json();
        if (isSessionExpired(response.status, responseData.detail)) {
          redirectToLogin();
          return;
        }
        toast.error(responseData.detail);
        return;
      }

      toast.success("Bet placed successfully!");
      setPendingChips([]);

      const updatedData = await fetchGameStatus();
      if (updatedData) {
        notifyGameUpdated(gameId, updatedData.status_game);
      }
    } catch (error) {
      console.error("Error placing bet:", error);
    }
  };

  const renderCards = (
    cards: string[],
    opts?: {
      baseDelay?: number;
      delayStep?: number;
      dealVars?: React.CSSProperties;
      flipSlot?: boolean;
    },
  ) => {
    const baseDelay = opts?.baseDelay ?? 0;
    const delayStep = opts?.delayStep ?? 350;
    return cards.map((card, index) => {
      if (opts?.flipSlot) {
        return (
          <CardSlot
            key={index}
            card={card}
            style={{
              animationDelay: `${baseDelay + index * delayStep}ms`,
              ...(opts.dealVars ?? {}),
            }}
          />
        );
      }
      return (
        <img
          key={index}
          src={cardImages[card]}
          alt={`${card} card`}
          className="table-card deal-anim"
          style={{
            animationDelay: `${baseDelay + index * delayStep}ms`,
            ...(opts?.dealVars ?? {}),
          }}
        />
      );
    });
  };

  const currentPlayer = gameStatus?.players.find((p) => p.id === playerId);

  const pendingBetAmount = pendingChips.reduce((acc, chip) => acc + chip, 0);

  const addChip = (denom: number) => {
    setPendingChips((prev) => [...prev, denom]);
  };

  const undoChip = () => {
    setPendingChips((prev) => prev.slice(0, -1));
  };

  const clearChips = () => {
    setPendingChips([]);
  };

  // Modelo de casino dinámico: de lo que te queda sin apostar podés sacar
  // hasta floor(restante / denominación) fichas de cada tipo. Cada ficha
  // puesta o removida recalcula todos los stocks al instante.
  const remainingMoney = Math.max(0, (walletAmount ?? 0) - pendingBetAmount);
  const availableFor = (denom: number): number =>
    Math.floor(remainingMoney / denom);

  return (
    <>
      <div>
        <Modal
          isOpen={statusOpen}
          onRequestClose={closeStatus}
          className="game-status-modal"
          overlayClassName="game-status-overlay"
        >
          <button className="close-button" onClick={closeStatus}>
            &times;
          </button>
          {gameStatus ? (
            <>
              {gameStatus.status_game === "pending_bet" ? (
                <div className="table-felt table-felt-bet">
                  <div className="bet-phase">
                    <h3 className="bet-phase-title">
                      Place your bets to start the round
                    </h3>
                    <p className="bet-phase-subtitle">
                      The cards are dealt automatically once every player has
                      placed a bet.
                    </p>

                    <div className="bet-phase-players">
                      {gameStatus.players.map((player) => (
                        <div key={player.id} className="bet-phase-player">
                          <span className="bet-phase-player-name">
                            {player.name}
                            {player.id === playerId ? " (you)" : ""}
                          </span>
                          {player.bet_amount > 0 ? (
                            <span className="bet-phase-player-bet placed">
                              &#10003; Bet: ${player.bet_amount}
                            </span>
                          ) : (
                            <span className="bet-phase-player-bet pending">
                              No bet yet
                            </span>
                          )}
                        </div>
                      ))}
                    </div>

                    {currentPlayer && currentPlayer.bet_amount > 0 ? (
                      <div className="bet-waiting">
                        &#9203; You already placed ${currentPlayer.bet_amount}.
                        Waiting for the other players...
                      </div>
                    ) : (
                      <div className="chips-bet">
                        <p className="chips-total">
                          Balance:{" "}
                          <span className="chips-total-balance">
                            ${walletAmount ?? "…"}
                          </span>{" "}
                          · Your bet:{" "}
                          <span className="chips-total-amount">
                            ${pendingBetAmount}
                          </span>
                        </p>

                        <div className="chip-rack">
                          {[...CHIP_DENOMS].reverse().map((denom) => {
                            const available = availableFor(denom);
                            return (
                              <button
                                key={denom}
                                type="button"
                                className="chip"
                                data-denom={denom}
                                onClick={() => addChip(denom)}
                                disabled={available <= 0}
                                title={`${available.toLocaleString("en-US")} x $${denom} left`}
                              >
                                <span className="chip-inner">{denom}</span>
                                <span className="chip-count">
                                  {available > 999
                                    ? "999+"
                                    : available.toLocaleString("en-US")}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        <div className="chips-stack">
                          {[...CHIP_DENOMS].reverse().map((denom) => {
                            const count = pendingChips.filter(
                              (c) => c === denom,
                            ).length;
                            if (count === 0) {
                              return null;
                            }
                            return (
                              <div
                                key={denom}
                                className="chips-pile"
                                data-denom={denom}
                                title={`${count} x $${denom}`}
                              >
                                <span className="chips-pile-chip" />
                                <span className="chips-pile-count">
                                  {count > 99 ? "99+" : count}
                                </span>
                              </div>
                            );
                          })}
                        </div>

                        <div className="chips-actions">
                          <button
                            type="button"
                            className="chip-undo"
                            onClick={undoChip}
                            disabled={pendingChips.length === 0}
                          >
                            Undo
                          </button>
                          <button
                            type="button"
                            className="chip-clear"
                            onClick={clearChips}
                            disabled={pendingChips.length === 0}
                          >
                            Clear
                          </button>
                          <button
                            type="button"
                            className="submit-bet-button chips-submit"
                            onClick={handleBetSubmit}
                            disabled={pendingBetAmount < 1}
                          >
                            Confirm Bet (
                            {pendingBetAmount ? `$${pendingBetAmount}` : "$0"})
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="table-felt">
                  <div className="table-branding" aria-hidden="true">
                    <div className="arc-line arc-big">
                      BLACKJACK PAYS 3 TO 2
                    </div>
                    <div className="arc-line arc-small">
                      DEALER MUST STAND ON 17 AND DRAW TO 16
                    </div>
                    <div className="arc-line arc-spaced">
                      INSURANCE PAYS 2 TO 1
                    </div>
                  </div>

                  <div className="dealer-spot">
                    <div className="spot-name dealer-title">
                      {gameStatus.croupier.name}
                    </div>
                    <div className="cards-container">
                      {renderCards(gameStatus.croupier.cards, {
                        baseDelay: gameStatus.players.length * 700,
                        dealVars: {
                          "--deal-dx": "-150px",
                          "--deal-dy": "0px",
                        } as React.CSSProperties,
                        flipSlot: true,
                      })}
                    </div>
                    <div className="spot-points">
                      Points:{" "}
                      <PointsCounter
                        cards={gameStatus.croupier.cards}
                        finalText={gameStatus.croupier.total_points.join(", ")}
                        hold={!resultsReady}
                        baseDelay={gameStatus.players.length * 700}
                      />
                    </div>
                  </div>

                  <div className="table-slots" aria-hidden="true">
                    {Array.from({ length: 7 }).map((_, i) => {
                      const t = i / 6;
                      const angle = Math.PI * t;
                      return (
                        <span
                          key={i}
                          className="table-slot"
                          style={{
                            left: `${50 + 41 * Math.cos(angle)}%`,
                            bottom: `${40 + 17 * Math.sin(angle)}%`,
                            transform: "translateX(-50%)",
                          }}
                        />
                      );
                    })}
                  </div>

                  {gameStatus.players.map((player, pIndex) => {
                    const t =
                      gameStatus.players.length === 1
                        ? 0.5
                        : pIndex / (gameStatus.players.length - 1);
                    const angle = Math.PI * t;
                    const spotStyle: React.CSSProperties = {
                      left: `${50 + 41 * Math.cos(angle)}%`,
                      bottom: `${9 + 18 * Math.sin(angle)}%`,
                      transform: "translateX(-50%)",
                    };
                    return (
                      <div
                        key={player.id}
                        className={`player-spot${player.id === playerId ? " current" : ""}`}
                        style={spotStyle}
                      >
                        <div className="spot-name">
                          {player.name}
                          {player.id === playerId ? " (you)" : ""}
                        </div>
                        <div className="cards-container">
                          {renderCards(player.cards, {
                            baseDelay: pIndex * 700,
                            dealVars: {
                              "--deal-dx": "0px",
                              "--deal-dy": "-300px",
                            } as React.CSSProperties,
                          })}
                        </div>
                        <div className="spot-points">
                          Points:{" "}
                          <PointsCounter
                            cards={player.cards}
                            finalText={player.total_points.join(", ")}
                            hold={!resultsReady}
                            baseDelay={pIndex * 700}
                          />{" "}
                          &middot; Bet: <span>${player.bet_amount}</span>{" "}
                          &middot;{" "}
                          <DelayedStatus
                            cards={player.cards}
                            status={player.status}
                            hold={!resultsReady}
                            baseDelay={pIndex * 700}
                          />
                        </div>
                        {player.id === playerId &&
                          gameStatus.status_game === "started" && (
                            <div className="player-buttons">
                              <button
                                className="deal-card-button"
                                onClick={handleDealCard}
                                disabled={player.status !== "playing"}
                              >
                                Deal Card
                              </button>
                              <button
                                className="stand-button"
                                onClick={handleStand}
                                disabled={player.status !== "playing"}
                              >
                                Stand
                              </button>
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div>Loading...</div>
          )}
        </Modal>
      </div>
    </>
  );
};

export default GameStatusButton;
