// Import necessary functions and types from other modules.
import { getUser } from "../auth/auth.ts";
import {
  sendWebSocketMessage,
  initLobbyConnection,
  disconnect,
} from "../lobby/websocket.ts";
import { navigate } from "../router/router.ts";
import { renderHeader } from "./components/Header.ts";
import { RoomStateForApi, Card, ChatMessage } from "../types/game.types.ts";
import { MAX_PLAYERS } from "../../../backend/src/config/game.config.ts";

// Base URL for the API.
const API_BASE_URL = "http://localhost:3001";

// Module-level state variables to hold game data.
let gameState: RoomStateForApi | null = null;
let myCards: Card[] = [];
let chatMessages: ChatMessage[] = [];
let selectedCardId: string[] = [];

/**
 * Renders the main game board page.
 * @param {HTMLElement} element - The root element to render the page into.
 * @param {string} [roomCode] - The code of the room to join.
 */
export const renderGameBoardPage = (
  element: HTMLElement,
  roomCode?: string
) => {
  // Get the current user; if no user or room code, navigate to the home page.
  const currentUser = getUser();
  if (!currentUser || !roomCode) {
    navigate("/");
    return;
  }

  // Set the inner HTML of the root element with the game layout.
  element.innerHTML = `
        <div id="header-container"></div>
        <div class="game-layout">
            <div id="game-area" class="game-area">
                <div class="game-table">
                    <div id="player-pods-container"></div>
                    <div class="center-pile">
                        <div id="reference-card-container"></div>
                        <p id="game-status-text" class="game-status-text">Waiting for game to start...</p>
                    </div>
                </div>

                <div class="player-hand-container">
                    <div id="my-info-area" class="my-info-area"></div>
                    <div class="player-hand-area">
                        <div id="my-hand-cards" class="hand-cards"></div>
                    </div>
                </div>

                <div id="action-buttons" class="action-buttons"></div>
            </div>
            
            <div class="chat-sidebar">
                 <div class="chat-panel">
                    <div class="chat-header"><span id="chat-title" class="chat-title">Live Chat (${roomCode})</span></div>
                    <div id="chat-messages" class="chat-messages scrollable-list"></div>
                    <form id="chat-form" class="chat-input-area">
                        <input type="text" id="chat-input" placeholder="Type your message..." class="chat-input" maxlength="100" autocomplete="off" />
                        <button type="submit" class="send-btn" aria-label="Send message">➤</button>
                    </form>
                </div>
                <div class="game-controls">
                    <button id="button-quit-game" class="button button-quit-game">
                        <span class="quit-icon">🚪</span><span class="quit-text">Leave Table</span>
                    </button>
                </div>
            </div>
        </div>
        ${renderQuitModal()}
        ${renderDynamicStyles()}
        <!-- Roulette overlay is hidden by default and shown during challenges -->
        <div id="roulette-overlay" class="roulette-overlay hidden">
            <div id="roulette-modal" class="roulette-modal">
                <h2 id="roulette-title"></h2>
                <div id="revealed-card-container"></div>
                <!-- This container holds the roulette wheel -->
                <div id="roulette-wheel-container"></div>
                <p id="roulette-result"></p>
            </div>
        </div>
    `;

  // Render the header component.
  renderHeader(document.getElementById("header-container")!);
  // Initialize the WebSocket connection and set up the message handler.
  initLobbyConnection(handleGameMessage);
  // Set up all event listeners for the page.
  setupEventListeners();
};

/**
 * Handles incoming WebSocket messages from the server.
 * @param {any} message - The message object received from the server.
 */
const handleGameMessage = (message: any) => {
  console.log("[Game WS] Received:", message);
  const currentUser = getUser();

  // Process message based on its type.
  switch (message.type) {
    case "ROOM_STATE_UPDATE":
      gameState = message.payload;
      myCards = message.payload.myCards || myCards;
      updateUI();
      break;
    case "CHAT_BROADCAST":
      chatMessages.push(message.payload);
      if (chatMessages.length > 100) chatMessages.shift(); // Keep chat history limited.
      renderChat();
      break;
    case "GAME_STARTED":
      alert(message.payload.message);
      break;
    case "GAME_FINISHED":
      // Delay showing the end screen to allow animations to complete.
      setTimeout(() => {
        showEndGameScreen(
          message.payload.winnerId === currentUser?.id,
          message.payload.message
        );
      }, 1000);
      break;
    case "CHALLENGE_RESULT":
      handleChallengeResult(message.payload);
      break;
    case "ERROR":
      alert(`Server error: ${message.payload.message}`);
      break;
    case "ROOM_CLOSED":
      alert(`The room "${message.payload.name}" has been closed.`);
      disconnect();
      navigate("/home");
      break;
  }
};

/**
 * Handles the visual sequence for a challenge result, including the roulette spin.
 * @param {any} payload - The data from the server about the challenge result.
 */
const handleChallengeResult = (payload: any) => {
  // Get all necessary DOM elements for the roulette modal.
  const overlay = document.getElementById("roulette-overlay")!;
  const title = document.getElementById("roulette-title")!;
  const wheelContainer = document.getElementById("roulette-wheel-container")!;
  const result = document.getElementById("roulette-result")!;
  const revealedCardContainer = document.getElementById(
    "revealed-card-container"
  )!;

  const punishedPlayer = gameState?.players.find(
    (p) => p.username === payload.punishedPlayerName
  );
  const riskLevel = punishedPlayer?.riskLevel || 0;
  const totalChambers = 6 - riskLevel; // Fewer chambers for higher risk.
  const heartChambers = totalChambers - 1; // Always one skull.

  // Construct the accusation message based on the challenge outcome.
  let accusationMessage = "";
  if (payload.wasLie) {
    accusationMessage = `${payload.targetName} was caught bluffing!`;
  } else {
    accusationMessage = `False accusation! ${payload.targetName} was telling the truth.`;
  }

  // --- Step 1: Show the accusation result and the revealed card. ---
  title.textContent = accusationMessage;
  if (payload.revealedCard && payload.revealedCard.length > 0) {
    revealedCardContainer.innerHTML = createRevealedCards(payload.revealedCard);
  } else {
    revealedCardContainer.innerHTML = "";
  }
  wheelContainer.innerHTML = "";
  wheelContainer.style.display = "none";
  result.textContent = "";
  overlay.classList.remove("hidden");

  // Define durations for each step of the animation sequence.
  const accusationDuration = 3000;
  const spinDuration = 4000;
  const resultDisplayDuration = 2500;

  // --- Step 2: After a delay, show the roulette wheel and start the spin. ---
  setTimeout(() => {
    revealedCardContainer.innerHTML = "";
    wheelContainer.style.display = "flex";
    title.textContent = `${payload.punishedPlayerName} spins the chamber... (${heartChambers} ❤️ | 1 💀)`;

    const cylinder = createRouletteWheel(
      wheelContainer,
      totalChambers,
      payload.isEliminated
    );

    // Reset and trigger the spin animation.
    cylinder.style.animation = "none";
    void cylinder.offsetWidth; // Trigger a reflow to restart the animation.
    cylinder.style.animation = `spin ${
      spinDuration / 1000
    }s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards`;

    // --- Step 3: After the spin animation finishes, show the result. ---
    setTimeout(() => {
      const resultText = payload.isEliminated
        ? "💀 BANG! ELIMINATED! 💀"
        : "❤️ *CLICK*... SURVIVED! ❤️";
      const resultColor = payload.isEliminated ? "#dc2626" : "#16a34a";

      result.innerHTML = `<div class="roulette-result-text" style="color: ${resultColor};">${resultText}</div>`;

      // Add a screen shake effect for dramatic impact if a player is eliminated.
      if (payload.isEliminated) {
        document.body.style.animation = "shake 0.5s ease-in-out";
        setTimeout(() => {
          document.body.style.animation = "";
        }, 500);
      }

      // --- Step 4: After showing the result, hide the overlay. ---
      setTimeout(() => {
        overlay.classList.add("hidden");
      }, resultDisplayDuration);
    }, spinDuration);
  }, accusationDuration);
};

/**
 * Creates a visual roulette wheel, separating the rotating cylinder from the static firing pin.
 * @param {HTMLElement} container - The container element to build the wheel in.
 * @param {number} totalChambers - Total number of chambers (e.g., 6, 5, 4...).
 * @param {boolean} willHitSkull - Whether the spin will result in elimination.
 * @returns {HTMLElement} The cylinder element that will be animated.
 */
const createRouletteWheel = (
  container: HTMLElement,
  totalChambers: number,
  willHitSkull: boolean
): HTMLElement => {
  container.innerHTML = "";
  container.className = "roulette-wheel";

  const cylinder = document.createElement("div");
  cylinder.className = "revolver-cylinder";

  const angleStep = 360 / totalChambers;

  // Randomly distribute one skull among the heart chambers.
  const chambers: ("skull" | "heart")[] = [];
  const skullPosition = Math.floor(Math.random() * totalChambers);

  for (let i = 0; i < totalChambers; i++) {
    chambers.push(i === skullPosition ? "skull" : "heart");
  }

  // Create and position the chamber elements inside the cylinder.
  for (let i = 0; i < totalChambers; i++) {
    const chamber = document.createElement("div");
    chamber.className = "chamber";

    const isSkull = chambers[i] === "skull";
    chamber.innerHTML = isSkull ? "💀" : "❤️";
    chamber.classList.add(isSkull ? "skull-chamber" : "heart-chamber");

    const angle = i * angleStep;
    chamber.style.transform = `rotate(${angle}deg) translateY(-60px) rotate(-${angle}deg)`;

    cylinder.appendChild(chamber);
  }

  const firingPin = document.createElement("div");
  firingPin.className = "firing-pin";
  firingPin.innerHTML = "▼";

  container.appendChild(cylinder);
  container.appendChild(firingPin);

  // Determine which chamber should land under the firing pin.
  let targetChamberIndex;
  if (willHitSkull) {
    targetChamberIndex = skullPosition;
  } else {
    const heartChamberIndices = chambers
      .map((c, index) => (c === "heart" ? index : -1))
      .filter((i) => i !== -1);
    targetChamberIndex =
      heartChamberIndices[
        Math.floor(Math.random() * heartChamberIndices.length)
      ];
  }

  // Calculate the final rotation angle for the animation.
  const baseRotation = 1080; // 3 full spins for drama.
  const targetAngle = targetChamberIndex * angleStep;
  const finalRotation = baseRotation - targetAngle;

  cylinder.style.setProperty("--final-rotation", `${finalRotation}deg`);

  return cylinder;
};

/**
 * Shows the end game screen when the game is over.
 * @param {boolean} didIWin - True if the current player won.
 * @param {string} message - The message to display (e.g., "John Doe wins!").
 */
const showEndGameScreen = (didIWin: boolean, message: string) => {
  const gameArea = document.getElementById("game-area")!;
  gameArea.innerHTML = `
        <div class="end-game-screen ${didIWin ? "win" : "lose"}">
            <h1>${didIWin ? "Victory!" : "Defeat!"}</h1>
            <p>${message}</p>
            <button id="back-to-lobby" class="button button-primary">Back to Lobby</button>
        </div>
    `;
  document.getElementById("back-to-lobby")?.addEventListener("click", () => {
    disconnect();
    navigate("/home");
  });
};

/**
 * Main function to update the entire UI based on the current game state.
 */
const updateUI = () => {
  if (!gameState) return;
  const currentUser = getUser();
  if (!currentUser) return;

  // If the current player is eliminated, show the end game screen for them.
  const me = gameState.players.find((p) => p.id === currentUser.id);
  if (me?.isEliminated) {
    showEndGameScreen(false, "You have been eliminated.");
    return;
  }

  const isMyTurn = gameState.game?.currentPlayerId === currentUser.id;
  const canChallenge =
    gameState.game?.lastPlayerId !== null &&
    gameState.game?.lastPlayerId !== currentUser.id;

  // Call individual render functions to update parts of the UI.
  renderPlayerPods(currentUser.id);
  renderMyInfo(currentUser.id);
  renderMyHand(isMyTurn);
  renderGameStatus();
  renderActionButtons(isMyTurn, canChallenge);
  renderReferenceCard();
};

/**
 * Determines the CSS position class for an opponent based on their turn order
 * and the total number of players, ensuring a clockwise layout.
 * @param {number} opponentIndex - The order of the opponent (1st, 2nd, etc.).
 * @param {number} totalPlayers - The total number of players in the game.
 * @returns {string} The CSS class for positioning (e.g., 'pos-top', 'pos-left').
 */
const getPlayerPositionClass = (
  opponentIndex: number,
  totalPlayers: number
): string => {
  // In a 1v1 game, the single opponent is always positioned at the top.
  if (totalPlayers === 2) {
    return "pos-top";
  }

  // In a 3-player game, opponents are on the left and right.
  if (totalPlayers === 3) {
    if (opponentIndex === 1) return "pos-left"; // 1st opponent in turn order.
    if (opponentIndex === 2) return "pos-right"; // 2nd opponent in turn order.
  }

  // In a 4-player game, opponents are at the left, top, and right.
  if (totalPlayers === 4) {
    if (opponentIndex === 1) return "pos-left"; // 1st opponent.
    if (opponentIndex === 2) return "pos-top"; // 2nd opponent.
    if (opponentIndex === 3) return "pos-right"; // 3rd opponent.
  }

  return ""; // Fallback for any other case.
};

/**
 * Renders the pods for all opponent players around the table in a clockwise order.
 * @param {string} currentUserId - The ID of the current user to exclude them from the pods.
 */
const renderPlayerPods = (currentUserId: string) => {
  const container = document.getElementById("player-pods-container");
  if (!container || !gameState) return;

  const players = gameState.players || [];
  const totalPlayers = Number(players.length);

  // Reorder players so the current user is conceptually at the bottom/start.
  const playerPositions = assignPlayerPositions(players, currentUserId);

  let opponentIndex = 0;

  container.innerHTML = playerPositions
    .map((player) => {
      // Skip rendering the current user in the opponent pods area.
      if (player.id === currentUserId) return "";

      opponentIndex++;

      // Get the correct position class using the layout logic function.
      const positionClass = getPlayerPositionClass(opponentIndex, totalPlayers);

      if (player.isEliminated) {
        return createEliminatedPod(player, positionClass);
      }

      const isCurrentTurn = player.id === gameState?.game?.currentPlayerId;
      return createPlayerPod(player, positionClass, isCurrentTurn);
    })
    .join("");
};

/**
 * Renders the info area for the current player.
 * @param {string} currentUserId - The ID of the current user.
 */
const renderMyInfo = (currentUserId: string) => {
  const container = document.getElementById("my-info-area");
  if (!container || !gameState) return;

  const me = gameState.players.find((p) => p.id === currentUserId);
  if (me) {
    container.innerHTML = createMyInfoPod(me);
  }
};

/**
 * Renders the current player's hand of cards.
 * @param {boolean} isMyTurn - True if it's the current player's turn.
 */
const renderMyHand = (isMyTurn: boolean) => {
  const container = document.getElementById("my-hand-cards");
  if (!container) return;
  container.innerHTML = myCards.map((card) => createHandCard(card)).join("");

  // Add click listeners to cards only if it's the player's turn.
  container.querySelectorAll(".hand-card").forEach((cardEl) => {
    if (isMyTurn) {
      cardEl.addEventListener("click", () => handleCardSelection(cardEl));
    }
    // Re-apply 'selected' class if a card was already selected.
    const cardId = cardEl.getAttribute("data-card-id");
    if (cardId && selectedCardId.includes(cardId)) {
      cardEl.classList.add("selected");
    }
  });
};

/**
 * Renders the current game status text, such as the required card or current player.
 */
const renderGameStatus = () => {
  const statusText = document.getElementById("game-status-text");
  if (!statusText || !gameState || !gameState.game) return;

  if (gameState.status === "playing") {
    const currentPlayer = gameState.players.find(
      (p) => p.id === gameState!.game!.currentPlayerId
    );
    statusText.textContent = `Required: ${
      gameState.game.currentCardType?.toUpperCase() || "ANY"
    } | Turn: ${currentPlayer?.username}`;
  } else {
    statusText.textContent = `Waiting for players... (${gameState.players.length}/${MAX_PLAYERS})`;
  }
};

/**
 * Renders the main action buttons (Play Card, Call Bluff).
 * @param {boolean} isMyTurn - True if it's the current player's turn.
 * @param {boolean} canChallenge - True if a challenge is possible.
 */
const renderActionButtons = (isMyTurn: boolean, canChallenge: boolean) => {
  const container = document.getElementById("action-buttons");
  if (!container) return;
  container.innerHTML = createActionButtons(isMyTurn, canChallenge);
  document
    .getElementById("play-card-btn")
    ?.addEventListener("click", handlePlayCardAction);
  document
    .getElementById("call-bluff-btn")
    ?.addEventListener("click", handleCallBluffAction);
};

/**
 * Renders the reference card in the center of the table.
 */
const renderReferenceCard = () => {
  const container = document.getElementById("reference-card-container");
  if (!container || !gameState || !gameState.game) return;

  const referenceType = gameState.game.currentCardType;
  if (referenceType) {
    container.innerHTML = `<div class="card-face reference-card">${referenceType
      .charAt(0)
      .toUpperCase()}</div>`;
  } else {
    container.innerHTML = "New Round...";
  }
};

/**
 * Renders the chat messages in the chat panel.
 */
const renderChat = () => {
  const container = document.getElementById("chat-messages");
  if (!container) return;
  container.innerHTML = chatMessages
    .map(
      (msg) => `
        <div class="message">
            <span class="timestamp">${new Date(
              msg.timestamp
            ).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}</span>
            <span class="content"><strong>${msg.authorName}:</strong> ${
        msg.message
      }</span>
        </div>
    `
    )
    .join("");
  // Auto-scroll to the latest message.
  container.scrollTop = container.scrollHeight;
};

/**
 * Handles the logic for selecting or deselecting a card in the hand.
 * @param {Element} cardEl - The card element that was clicked.
 */
const handleCardSelection = (cardEl: Element) => {
  const cardId = cardEl.getAttribute("data-card-id");
  if (!cardId) return;

  const isSelected = selectedCardId.includes(cardId);

  if (isSelected) {
    // Remove da seleção
    selectedCardId = selectedCardId.filter((id) => id !== cardId);
    cardEl.classList.remove("selected");
  } else {
    // Adiciona à seleção
    selectedCardId.push(cardId);
    cardEl.classList.add("selected");
  }
};

/**
 * Handles the "Play Card" action.
 */
const handlePlayCardAction = () => {
  if (selectedCardId.length === 0) {
    alert("Please select a card to play.");
    return;
  }
  sendWebSocketMessage({
    type: "PLAY_CARD",
    payload: { cardsId: selectedCardId },
  });

  selectedCardId = [];
};

/**
 * Handles the "Call Bluff" action.
 */
const handleCallBluffAction = () => {
  if (confirm("Are you sure you want to call a bluff?")) {
    sendWebSocketMessage({ type: "CALL_BLUFF", payload: {} });
  }
};

/**
 * Sets up all static event listeners for the page, such as chat and modals.
 */
const setupEventListeners = () => {
  const chatForm = document.getElementById("chat-form");
  chatForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    const chatInput = document.getElementById("chat-input") as HTMLInputElement;
    const message = chatInput.value.trim();
    if (message) {
      sendWebSocketMessage({ type: "CHAT_MESSAGE", payload: { message } });
      chatInput.value = "";
    }
  });

  const quitModal = document.getElementById(
    "quit-game-modal"
  ) as HTMLDivElement;
  const quitBtn = document.getElementById("button-quit-game");
  const confirmQuitBtn = document.getElementById("confirm-quit-btn");
  const cancelQuitBtn = document.getElementById("cancel-quit-btn");

  const openModal = () => quitModal.classList.add("show");
  const closeModal = () => quitModal.classList.remove("show");

  quitBtn?.addEventListener("click", openModal);
  cancelQuitBtn?.addEventListener("click", closeModal);
  confirmQuitBtn?.addEventListener("click", () => {
    sendWebSocketMessage({ type: "LEAVE_ROOM", payload: {} });
    closeModal();
  });
  quitModal.addEventListener("click", (e) => {
    if (e.target === quitModal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && quitModal.classList.contains("show"))
      closeModal();
  });
};

/**
 * Reorders the players array to position the current user at the logical start (index 0),
 * followed by other players in their natural turn order.
 * @param {any[]} players - The array of player objects.
 * @param {string} currentUserId - The ID of the current user.
 * @returns {any[]} The reordered array of players.
 */
function assignPlayerPositions(players: any[], currentUserId: string): any[] {
  const currentUserIndex = players.findIndex((p) => p.id === currentUserId);
  if (currentUserIndex === -1) return players;
  const reordered = [...players];
  // Slice the array at the current user's index and move the first part to the end.
  return reordered
    .slice(currentUserIndex)
    .concat(reordered.slice(0, currentUserIndex));
}

// --- HTML Template Creation Functions ---

/**
 * Creates the HTML for an opponent's pod.
 * @param player - The player object.
 * @param positionClass - The CSS class for table positioning (e.g., 'pos-top').
 * @param isCurrentTurn - Boolean indicating if it's this player's turn.
 * @returns The HTML string for the player pod.
 */
const createPlayerPod = (
  player: any,
  positionClass: string,
  isCurrentTurn: boolean
) => {
  const avatarSrc = player.avatar_url
    ? `${API_BASE_URL}${player.avatar_url}`
    : "https://via.placeholder.com/60";
  if (player.isInactive) {
    return createInactivePod(player, positionClass);
  }
  return `
        <div class="player-pod ${positionClass} ${
    isCurrentTurn ? "active-turn" : ""
  }" data-player-id="${player.id}">
            <div class="opponent-hand">
                ${Array(player.handSize || 0)
                  .fill('<div class="card-back small-card"></div>')
                  .join("")}
            </div>
            <div class="player-info">
                <img src="${avatarSrc}" alt="${
    player.username
  }'s avatar" class="player-avatar" />
                <div class="player-details">
                    <span class="player-name">${player.username}</span>
                    <span class="player-risk-level">Risk: ${
                      player.riskLevel || 0
                    }/6</span>
                </div>
            </div>
        </div>`;
};

/**
 * Creates the HTML for the current user's info display area.
 * @param player - The current user's player object.
 * @returns The HTML string for the user info area.
 */
const createMyInfoPod = (player: any) => {
  const avatarSrc = player.avatar_url
    ? `${API_BASE_URL}${player.avatar_url}`
    : "https://via.placeholder.com/60";
  const isMyTurn = gameState?.game?.currentPlayerId === player.id;
  return `
        <img src="${avatarSrc}" alt="${
    player.username
  }'s avatar" class="my-avatar ${isMyTurn ? "active-turn" : ""}" />
        <div class="my-details">
            <span class="my-name">${player.username}</span>
            <span class="my-risk-level">Risk: ${player.riskLevel || 0}/6</span>
        </div>
    `;
};

/**
 * Creates the HTML for an eliminated player's pod.
 * @param player - The eliminated player object.
 * @param positionClass - The CSS class for table positioning.
 * @returns The HTML string for the eliminated player pod.
 */
const createEliminatedPod = (player: any, positionClass: string) => {
  const avatarSrc = player.avatar_url
    ? `${API_BASE_URL}${player.avatar_url}`
    : "https://via.placeholder.com/60";
  return `
        <div class="player-pod ${positionClass} eliminated" data-player-id="${player.id}">
            <div class="player-info">
                <img src="${avatarSrc}" alt="${player.username}'s avatar" class="player-avatar eliminated-avatar" />
                <div class="player-details">
                    <span class="player-name">${player.username}</span>
                    <span class="player-risk-level">ELIMINATED</span>
                </div>
            </div>
        </div>`;
};

const createInactivePod = (player: any, position: string) => {
  const avatarSrc = player.avatar_url
    ? `${API_BASE_URL}${player.avatar_url}`
    : "https://via.placeholder.com/60";
  return `
    <div class="player-pod ${position} inactive" data-player-id="${player.id}">
      <div class="player-info">
        <img src="${avatarSrc}" alt="${player.username}'s avatar" class="player-avatar inactive-avatar" />
        <div class="player-details">
          <span class="player-name">${player.username}</span>
          <span class="player-risk-level">PLAYED ALL CARDS</span>
        </div>
      </div>
    </div>`;
};

/**
 * Creates the HTML for a single card in the player's hand.
 * @param card - The card object.
 * @returns The HTML string for the card.
 */
const createHandCard = (card: Card) => {
  const cardContent =
    card.type === "joker" ? "🃏" : card.type.charAt(0).toUpperCase();
  return `<div class="card-face hand-card" data-card-id="${card.id}">${cardContent}</div>`;
};

const createRevealedCards = (cards: Card[]) => {
  return cards
    .map(
      (card: Card) => `
        <div class="revealed-card">
            ${createHandCard(card)}
        </div>
    `
    )
    .join("");
};

/**
 * Creates the HTML for the main action buttons.
 * @param isMyTurn - Boolean indicating if it's the current player's turn.
 * @param canChallenge - Boolean indicating if a challenge is possible.
 * @returns The HTML string for the action buttons.
 */
const createActionButtons = (isMyTurn: boolean, canChallenge: boolean) => `
    <button id="play-card-btn" class="button button-primary action-btn" ${
      !isMyTurn ? "disabled" : ""
    }>Play Card</button>
    <button id="call-bluff-btn" class="button button-danger action-btn" ${
      !isMyTurn || !canChallenge ? "disabled" : ""
    }>Call Bluff</button>
`;

/**
 * Creates the HTML for the quit game confirmation modal.
 * @returns The HTML string for the modal.
 */
const renderQuitModal = () => `
    <div id="quit-game-modal" class="modal-overlay hidden">
        <div class="modal-content">
            <div class="modal-header"><h2 class="modal-title">🍺 Show Weakness?</h2></div>
            <div class="modal-body"><p>Leaving the table now is an admission of defeat. Are you sure you want to forfeit?</p></div>
            <div class="modal-actions">
                <button id="cancel-quit-btn" class="button button-secondary"><span>🎯 Stay & Fight</span></button>
                <button id="confirm-quit-btn" class="button button-danger"><span>🚪 Yes, I'm Out</span></button>
            </div>
        </div>
    </div>`;

/**
 * Generates and returns the CSS styles for the component as a string.
 * @returns {string} The HTML for the style tag.
 */
const renderDynamicStyles = () => {
  const style = document.createElement("style");
  style.textContent = `
        /* General Layout */
        .game-layout { display: flex; height: calc(100vh - 80px); background: #0f172a; }
        .game-area { flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 1rem; position: relative; }
        
        /* Game Table */
        .game-table { position: relative; width: 100%; flex-grow: 1; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at center, #166534 0%, #14532d 100%); border: 15px solid var(--color-wood-dark); border-radius: 50%; box-shadow: inset 0 0 50px rgba(0,0,0,0.6), 0 10px 30px rgba(0,0,0,0.5); }
        
        /* Player Pods (Opponents) */
        .player-pod { position: absolute; display: flex; flex-direction: column-reverse; align-items: center; gap: 0.5rem; transition: all 0.3s ease; }
        .player-pod.active-turn .player-avatar { box-shadow: 0 0 20px 5px #facc15; transform: scale(1.1); }
        .player-pod.inactive .player-avatar { filter: grayscale(100%) brightness(0.8);  border-color: #64748b; }
        .inactive-avatar { opacity: 0.7; }
        .player-pod.inactive .player-risk-level {   color: #64748b; font-weight: bold; }
        .player-info { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
        .player-avatar { width: 60px; height: 60px; border-radius: 50%; border: 3px solid var(--color-accent-gold); object-fit: cover; background: var(--color-wood-dark); }
        .player-details { display:flex; flex-direction:column; align-items: center; background: rgba(0,0,0,0.7); padding: 0.25rem 0.75rem; border-radius: 12px; }
        .player-name { font-weight: 700; color: #f1f5f9; font-size: var(--font-size-sm); }
        .player-risk-level { font-size: var(--font-size-xs); color: #fca5a5; }
        .opponent-hand { display: flex; justify-content: center; gap: -20px; margin-bottom: 5px; }
        .card-back { background: linear-gradient(45deg, #b91c1c, #7f1d1d); border: 1px solid var(--color-accent-gold); border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .small-card { width: 30px; height: 42px; }

        /* Generic positioning classes for players on the table. */
        .pos-top { /* Player positioned directly across from the user. */
            top: 2rem; 
            left: 50%; 
            transform: translateX(-50%); 
        }
        .pos-left { /* Player positioned on the left side of the table. */
            top: 50%;
            left: 2rem;
            transform: translateY(-50%);
        }
        .pos-right { /* Player positioned on the right side of the table. */
            top: 50%;
            right: 2rem;
            transform: translateY(-50%);
        }

        /* Center Pile */
        .center-pile { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; display: flex; flex-direction: column; gap: 1rem; align-items: center; }
        .reference-card { width: 70px; height: 98px; }
        .game-status-text { background: rgba(0,0,0,0.7); padding: 0.5rem 1rem; border-radius: 20px; color: #f1f5f9; }
        
        /* My Info and Hand */
        .player-hand-container { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
        .my-info-area { display: flex; align-items: center; gap: 1rem; background: rgba(0,0,0,0.4); padding: 0.5rem 1rem; border-radius: 20px; border: 1px solid var(--color-border); }
        .my-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; border: 3px solid var(--color-accent-gold); transition: all 0.3s ease;}
        .my-details { text-align: center; display: flex; flex-direction: column; }
        .my-name { font-weight: bold; color: var(--color-accent-gold); }
        .my-risk-level { font-size: 0.8rem; color: #fca5a5; }
        
        .player-hand-area { min-height: 100px; display: flex; justify-content: center; align-items: flex-end; padding-bottom: 1rem; }
        .hand-cards { display: flex; gap: 0.5rem; }
        .card-face { width: 70px; height: 98px; background: white; border: 2px solid #333; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: var(--font-size-xl); font-weight: bold; color: #333; cursor: pointer; transition: all 0.2s ease; }
        .hand-card:hover { transform: translateY(-10px); }
        .hand-card.selected { transform: translateY(-20px); border-color: var(--color-accent-gold); box-shadow: 0 5px 15px rgba(212, 175, 55, 0.5); }
        
        /* Action Buttons */
        .action-buttons { display: flex; justify-content: center; gap: 1rem; min-height: 50px; }
        .action-btn { padding: 0.75rem 1.5rem; font-size: 1rem; }
        .action-btn:disabled { background: var(--color-primary-disabled); cursor: not-allowed; opacity: 0.6; }
        
        /* Elimination & End Game */
        .player-pod.eliminated .player-avatar { filter: grayscale(100%) brightness(0.5); }
        .eliminated-screen, .end-game-screen { display: flex; flex-direction: column; justify-content: center; align-items: center; width: 100%; height: 100%; background: #0f172a; color: white; }
        .end-game-screen.win h1 { color: var(--color-success); }
        .end-game-screen.lose h1 { color: var(--color-danger); }
        .end-game-screen h1, .eliminated-screen h1 { font-family: var(--font-display); font-size: var(--font-size-2xl); }
        .end-game-screen p { font-size: 1.2rem; }
        
        /* Roulette Overlay */
        .roulette-overlay { 
            position: fixed; top: 0; left: 0; right: 0; bottom: 0; 
            background: linear-gradient(45deg, rgba(0,0,0,0.9), rgba(20,20,20,0.95)); 
            backdrop-filter: blur(10px); 
            display: flex; justify-content: center; align-items: center; 
            z-index: 2000; 
            animation: fadeIn 0.5s ease-in-out;
        }
        
        .roulette-modal { 
            text-align: center; color: white; padding: 2rem;
            background: rgba(0,0,0,0.8);
            border-radius: 1rem; border: 2px solid var(--color-accent-gold);
            box-shadow: 0 0 30px rgba(212, 175, 55, 0.3);
        }
        
        #roulette-title { 
            font-family: var(--font-display); font-size: var(--font-size-xl); 
            color: var(--color-accent-gold); text-shadow: 2px 2px 6px rgba(0,0,0,0.8); 
            margin-bottom: 1rem; animation: pulse 2s infinite;
        }
        
        /* Roulette Wheel Styles */
        .roulette-wheel {
            width: 200px; height: 200px;
            margin: 2rem auto;
            position: relative; /* This element is a positioning context for the cylinder and firing pin */
            display: flex; justify-content: center; align-items: center;
        }
        
        .revolver-cylinder {
            width: 180px; height: 180px;
            position: relative; border-radius: 50%;
            background: radial-gradient(circle, #4A4A4A 30%, #2A2A2A 70%);
            border: 4px solid #8B4513;
            box-shadow: inset 0 0 20px rgba(0,0,0,0.6), 0 0 30px rgba(139, 69, 19, 0.4);
        }
        
        .chamber {
            position: absolute; width: 35px; height: 35px;
            left: 50%; top: 50%; margin-left: -17.5px; margin-top: -17.5px;
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            font-size: 1.3rem; font-weight: bold;
            border: 2px solid #333; background: radial-gradient(circle, #555 0%, #333 100%);
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.3);
        }
        
        .skull-chamber { background: radial-gradient(circle, #7f1d1d 0%, #450a0a 100%); border-color: #dc2626; animation: ominousGlow 2s ease-in-out infinite alternate; }
        .heart-chamber { background: radial-gradient(circle, #166534 0%, #14532d 100%); border-color: #16a34a; }
        
        .firing-pin {
            position: absolute; /* Positioned relative to .roulette-wheel */
            top: -15px; left: 50%;
            transform: translateX(-50%);
            font-size: 1.8rem; color: #dc2626; text-shadow: 0 0 10px #dc2626;
            z-index: 10; /* Ensures it is on top of the cylinder */
            animation: firingPinPulse 1s ease-in-out infinite;
        }
        
        .roulette-result-text {
            font-size: var(--font-size-2xl); font-weight: bold; font-family: var(--font-display);
            animation: resultAppear 0.5s ease-in-out; margin-top: 1rem;
        }
        
        /* Animations */
        @keyframes spin { 
            from { transform: rotate(0deg); } 
            to { transform: rotate(var(--final-rotation)); } 
        }
        
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05); } }
        @keyframes ominousGlow { 0% { box-shadow: inset 0 2px 4px rgba(0,0,0,0.3), 0 0 10px rgba(220, 38, 38, 0.3); } 100% { box-shadow: inset 0 2px 4px rgba(0,0,0,0.3), 0 0 20px rgba(220, 38, 38, 0.6); } }
        @keyframes firingPinPulse { 0%, 100% { transform: translateX(-50%) scale(1); } 50% { transform: translateX(-50%) scale(1.1); } }
        @keyframes resultAppear { 0% { opacity: 0; transform: scale(0.5); } 100% { opacity: 1; transform: scale(1); } }
        @keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-5px); } 75% { transform: translateX(5px); } }

        /* Revealed Card Styling */
        #revealed-card-container { display: flex; justify-content: center; align-items: center; margin: 1rem 0; }
        #revealed-card-container .hand-card { transform: scale(1.2); box-shadow: 0 0 20px rgba(212, 175, 55, 0.6); border: 3px solid var(--color-accent-gold); }
        
        /* Chat and Modal Styles */
        .chat-sidebar { width: 350px; flex-shrink: 0; display: flex; flex-direction: column; background: #1e293b; border-left: 2px solid var(--color-wood-light); }
        .chat-panel { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; }
        .chat-header { padding: 1rem; background: var(--color-wood-dark); color: var(--color-accent-gold); }
        .chat-title { font-weight: bold; font-family: var(--font-display) }
        .chat-messages { flex-grow: 1; padding: 1rem; overflow-y: auto; background: var(--color-parchment); }
        .chat-messages .message { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.75rem; }
        .chat-messages .timestamp { font-size: 0.7rem; color: var(--color-text-medium); }
        .chat-messages .content { word-wrap: break-word; }
        .chat-input-area { display: flex; padding: 1rem; gap: 0.5rem; border-top: 2px solid var(--color-wood-dark); background: var(--color-wood-dark); }
        .chat-input { flex-grow: 1; border-radius: 20px; background: var(--color-bg-white); border: 1px solid var(--color-border); padding: 0.5rem 1rem; color: var(--color-text-light); }
        .send-btn { background: var(--color-accent-gold); border: none; color: var(--color-wood-dark); width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 1.2rem; flex-shrink: 0; }
        .game-controls { padding: 1rem; background: var(--color-wood-dark); }
        .button-quit-game { 
            margin: 0 auto;
            display: block;
        }
        .modal-overlay.show { display: flex; }
        .modal-content { background: var(--color-parchment); border: 2px solid var(--color-wood-light); color: var(--color-text-light); max-width: 500px; width: 90%; border-radius: 1rem; overflow: hidden; }
        .modal-header { background: var(--color-wood-dark); padding: 1rem; }
        .modal-title { margin: 0; font-size: var(--font-size-xl); text-align: center; color: var(--color-accent-gold) }
        .modal-body { padding: 1.5rem; }
        .modal-actions { display: flex; gap: 1rem; padding: 1rem; justify-content: flex-end; background: var(--color-wood-dark); }
        .button-secondary { background: var(--color-primary); }

        /*Cards revealed in roulette*/
        #revealed-card-container {display: flex; gap: 1rem; justify-content: center; align-items: center; flex-wrap: wrap; margin: 1rem 0;}
        .revealed-card { display: flex; flex-direction: column; align-items: center; }
        .revealed-card .hand-card { transform: none; cursor: default; transition: none; border-color: var(--color-accent-gold); box-shadow: 0 0 15px rgba(212, 175, 55, 0.5); }
    `;
  return style.outerHTML;
};