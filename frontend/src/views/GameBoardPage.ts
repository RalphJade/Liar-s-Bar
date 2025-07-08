import { getUser } from '../auth/auth.ts';
import { sendWebSocketMessage, initLobbyConnection, disconnect } from '../lobby/websocket.ts';
import { navigate } from '../router/router.ts';
import { renderHeader } from './components/Header.ts';
import { RoomStateForApi, Card, ChatMessage, CardType } from '../types/game.types.ts';
import { MAX_PLAYERS } from '../../../backend/src/config/game.config.ts';

const API_BASE_URL = 'http://localhost:3001';

// Module-level state for the game
let gameState: RoomStateForApi | null = null;
let myCards: Card[] = [];
let chatMessages: ChatMessage[] = [];
let selectedCardId: string | null = null;

export const renderGameBoardPage = (element: HTMLElement, roomCode?: string) => {
    const currentUser = getUser();
    if (!currentUser || !roomCode) {
        navigate('/');
        return;
    }

    element.innerHTML = `
        <div id="header-container"></div>
        <div class="game-layout">
            <div class="game-area">
                <div class="game-table">
                    <!-- Player pods and opponent hands will be injected here -->
                    <div id="player-pods-container"></div>
                    
                    <!-- CORRECTED: This container is now properly centered by CSS -->
                    <div class="center-pile">
                        <div id="reference-card-container"></div>
                        <p id="game-status-text" class="game-status-text">Waiting for game to start...</p>
                    </div>
                </div>
                
                <div class="player-hand-area">
                    <div id="my-hand-cards" class="hand-cards"></div>
                </div>
                
                <div id="action-buttons" class="action-buttons"></div>
            </div>
            
            <div class="chat-sidebar">
                <div class="chat-panel">
                    <div class="chat-header">
                        <span id="chat-title" class="chat-title">Live Chat (${roomCode})</span>
                    </div>
                    <div id="chat-messages" class="chat-messages scrollable-list"></div>
                    <form id="chat-form" class="chat-input-area">
                        <input type="text" id="chat-input" placeholder="Type your message..." class="chat-input" maxlength="100" autocomplete="off" />
                        <button type="submit" class="send-btn" aria-label="Send message">➤</button>
                    </form>
                </div>
                
                <div class="game-controls">
                    <button id="quit-game-btn" class="button-quit-game">
                        <span class="quit-icon">🚪</span>
                        <span class="quit-text">Leave Table</span>
                    </button>
                </div>
            </div>
        </div>
        ${renderQuitModal()}
        ${renderDynamicStyles()}
    `;

    renderHeader(document.getElementById('header-container')!);
    initLobbyConnection(handleGameMessage);
    setupEventListeners();
};

const handleGameMessage = (message: any) => {
    console.log('[Game WS] Received:', message);
    switch(message.type) {
        case 'ROOM_STATE_UPDATE':
            gameState = message.payload;
            myCards = message.payload.myCards || myCards;
            updateUI();
            break;
        case 'HAND_DEALT':
            myCards = message.payload.cards;
            updateUI();
            break;
        case 'CHAT_BROADCAST':
            chatMessages.push(message.payload);
            if (chatMessages.length > 100) chatMessages.shift();
            renderChat();
            break;
        case 'GAME_STARTED':
            alert(message.payload.message);
            break;
        case 'ERROR':
            alert(`Server error: ${message.payload.message}`);
            break;
        case 'ROOM_CLOSED':
            alert(`The room "${message.payload.name}" has been closed.`);
            disconnect();
            navigate('/home');
            break;
    }
};

const updateUI = () => {
    if (!gameState) return;
    const currentUser = getUser();
    if (!currentUser) return;

    const isMyTurn = gameState.game?.currentPlayerId === currentUser.id;
    const canChallenge = gameState.game?.lastPlayerId !== null && gameState.game.lastPlayerId !== currentUser.id;

    renderPlayerPods(currentUser.id);
    renderMyHand(isMyTurn);
    renderGameStatus();
    renderActionButtons(isMyTurn, canChallenge);
    renderReferenceCard();
};

const renderPlayerPods = (currentUserId: string) => {
    const container = document.getElementById('player-pods-container');
    if (!container || !gameState) return;
    
    const players = gameState.players || [];
    const playerPositions = assignPlayerPositions(players, currentUserId);
    
    container.innerHTML = playerPositions.map((player, index) => {
        // We only render pods for opponents, not the current user.
        if (player.id === currentUserId) return '';

        const isCurrentTurn = player.id === gameState?.game?.currentPlayerId;
        return createPlayerPod(player, index + 1, isCurrentTurn);
    }).join('');
};

const renderMyHand = (isMyTurn: boolean) => {
    const container = document.getElementById('my-hand-cards');
    if (!container) return;

    container.innerHTML = myCards.map(card => createHandCard(card)).join('');
    
    container.querySelectorAll('.hand-card').forEach(cardEl => {
        if (isMyTurn) {
            cardEl.addEventListener('click', () => handleCardSelection(cardEl));
        }
        if (cardEl.getAttribute('data-card-id') === selectedCardId) {
            cardEl.classList.add('selected');
        }
    });
};

const renderGameStatus = () => {
    const statusText = document.getElementById('game-status-text');
    if (!statusText || !gameState || !gameState.game) return;

    if (gameState.status === 'playing') {
        const currentPlayer = gameState.players.find(p => p.id === gameState!.game!.currentPlayerId);
        statusText.textContent = `Required: ${gameState.game.currentCardType?.toUpperCase()} | Turn: ${currentPlayer?.username}`;
    } else {
        statusText.textContent = `Waiting for players... (${gameState.players.length}/${MAX_PLAYERS})`;
    }
};

const renderActionButtons = (isMyTurn: boolean, canChallenge: boolean) => {
    const container = document.getElementById('action-buttons');
    if (!container) return;

    container.innerHTML = createActionButtons(isMyTurn, canChallenge);
    document.getElementById('play-card-btn')?.addEventListener('click', handlePlayCardAction);
    document.getElementById('call-bluff-btn')?.addEventListener('click', handleCallBluffAction);
};

const renderReferenceCard = () => {
    const container = document.getElementById('reference-card-container');
    if (!container || !gameState || !gameState.game) return;
    
    const referenceType = gameState.game.currentCardType;
    if (referenceType) {
        container.innerHTML = `<div class="card-face reference-card">${referenceType.charAt(0).toUpperCase()}</div>`;
    } else {
        container.innerHTML = '';
    }
};

const renderChat = () => {
    const container = document.getElementById('chat-messages');
    if (!container) return;

    container.innerHTML = chatMessages.map(msg => `
        <div class="message">
            <span class="timestamp">${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            <span class="content"><strong>${msg.authorName}:</strong> ${msg.message}</span>
        </div>
    `).join('');
    container.scrollTop = container.scrollHeight;
};

const handleCardSelection = (cardEl: Element) => {
    const cardId = cardEl.getAttribute('data-card-id');
    if (selectedCardId === cardId) {
        selectedCardId = null;
        cardEl.classList.remove('selected');
    } else {
        selectedCardId = cardId;
        document.querySelectorAll('.hand-card').forEach(c => c.classList.remove('selected'));
        cardEl.classList.add('selected');
    }
};

const handlePlayCardAction = () => {
    if (!selectedCardId) {
        alert("Please select a card to play.");
        return;
    }
    
    sendWebSocketMessage({ type: 'PLAY_CARD', payload: { cardId: selectedCardId } });
    selectedCardId = null; // Reset selection after playing
};

const handleCallBluffAction = () => {
    if (confirm("Are you sure you want to call a bluff?")) {
        sendWebSocketMessage({ type: 'CALL_BLUFF', payload: {} });
    }
};

const setupEventListeners = () => {
    const chatForm = document.getElementById('chat-form');
    chatForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        const chatInput = document.getElementById('chat-input') as HTMLInputElement;
        const message = chatInput.value.trim();
        if (message) {
            sendWebSocketMessage({ type: 'CHAT_MESSAGE', payload: { message } });
            chatInput.value = '';
        }
    });

    const quitModal = document.getElementById('quit-game-modal') as HTMLDivElement;
    const quitBtn = document.getElementById('quit-game-btn');
    const confirmQuitBtn = document.getElementById('confirm-quit-btn');
    const cancelQuitBtn = document.getElementById('cancel-quit-btn');

    const openModal = () => quitModal.classList.add('show');
    const closeModal = () => quitModal.classList.remove('show');

    quitBtn?.addEventListener('click', openModal);
    cancelQuitBtn?.addEventListener('click', closeModal);
    confirmQuitBtn?.addEventListener('click', () => {
        sendWebSocketMessage({ type: "LEAVE_ROOM", payload: {} });
        disconnect();
        navigate('/home');
    });
    quitModal.addEventListener('click', (e) => { if (e.target === quitModal) closeModal(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && quitModal.classList.contains('show')) closeModal(); });
};

function assignPlayerPositions(players: any[], currentUserId: string) {
    const currentUserIndex = players.findIndex(p => p.id === currentUserId);
    if (currentUserIndex === -1) return players;
    const reordered = [...players];
    // This rotates the array so the current user is always first (position 1, bottom of the screen)
    return reordered.slice(currentUserIndex).concat(reordered.slice(0, currentUserIndex));
}

const createPlayerPod = (player: any, position: number, isCurrentTurn: boolean) => {
    const avatarSrc = player.avatar_url ? `${API_BASE_URL}${player.avatar_url}` : 'https://via.placeholder.com/60';
    // CORRECTED: The handSize from the game state is now used to render the cards.
    return `
        <div class="player-pod player-${position} ${isCurrentTurn ? 'active-turn' : ''}" data-player-id="${player.id}">
            <div class="opponent-hand">
                ${Array(player.handSize || 0).fill('<div class="card-back small-card"></div>').join('')}
            </div>
            <div class="player-info">
                <img src="${avatarSrc}" alt="${player.username}'s avatar" class="player-avatar" />
                <div class="player-details">
                    <span class="player-name">${player.username}</span>
                    <span class="player-risk-level">Risk: ${player.riskLevel || 0}/6</span>
                </div>
            </div>
        </div>`;
};

const createHandCard = (card: Card) => {
    const cardContent = card.type === 'joker' ? '🃏' : card.type.charAt(0).toUpperCase();
    return `<div class="card-face hand-card" data-card-id="${card.id}">${cardContent}</div>`;
};

const createActionButtons = (isMyTurn: boolean, canChallenge: boolean) => `
    <button id="play-card-btn" class="button button-primary action-btn" ${!isMyTurn ? 'disabled' : ''}>Play Card</button>
    <button id="call-bluff-btn" class="button button-danger action-btn" ${!isMyTurn || !canChallenge ? 'disabled' : ''}>Call Bluff</button>
`;

const renderQuitModal = () => `
    <div id="quit-game-modal" class="modal-overlay hidden">
        <div class="modal-content">
            <div class="modal-header"><h2 class="modal-title">🍺 Show Weakness?</h2></div>
            <div class="modal-body">
                <p>Leaving the table now is an admission of defeat. Are you sure you want to forfeit?</p>
            </div>
            <div class="modal-actions">
                <button id="cancel-quit-btn" class="button button-secondary"><span>🎯 Stay & Fight</span></button>
                <button id="confirm-quit-btn" class="button button-danger"><span>🚪 Yes, I'm Out</span></button>
            </div>
        </div>
    </div>`;

const renderDynamicStyles = () => {
    const style = document.createElement('style');
    // CORRECTED CSS:
    style.textContent = `
        .game-layout { display: flex; height: calc(100vh - 80px); background: #0f172a; }
        .game-area { flex-grow: 1; display: flex; flex-direction: column; justify-content: space-between; padding: 1rem; position: relative; }
        .chat-sidebar { width: 350px; flex-shrink: 0; display: flex; flex-direction: column; background: #1e293b; border-left: 2px solid var(--color-wood-light); }
        .game-table { position: relative; width: 100%; flex-grow: 1; display: flex; align-items: center; justify-content: center; background: radial-gradient(ellipse at center, #166534 0%, #14532d 100%); border: 15px solid var(--color-wood-dark); border-radius: 50%; box-shadow: inset 0 0 50px rgba(0,0,0,0.6), 0 10px 30px rgba(0,0,0,0.5); }
        
        /* Player Pods & Opponent Hands */
        .player-pod { position: absolute; display: flex; flex-direction: column-reverse; align-items: center; gap: 0.5rem; transition: all 0.3s ease; }
        .player-pod.active-turn .player-avatar { box-shadow: 0 0 20px 5px #facc15; transform: scale(1.1); }
        .player-info { display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
        .player-avatar { width: 60px; height: 60px; border-radius: 50%; border: 3px solid var(--color-accent-gold); object-fit: cover; background: var(--color-wood-dark); }
        .player-details { display:flex; flex-direction:column; align-items: center; background: rgba(0,0,0,0.7); padding: 0.25rem 0.75rem; border-radius: 12px; }
        .player-name { font-weight: 700; color: #f1f5f9; font-size: 0.9rem; }
        .player-risk-level { font-size: 0.75rem; color: #ef4444; font-weight: bold;}
        
        .opponent-hand { display: flex; justify-content: center; gap: -20px; margin-bottom: 5px; }
        .card-back { background: linear-gradient(45deg, #b91c1c, #7f1d1d); border: 1px solid var(--color-accent-gold); border-radius: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.3); }
        .small-card { width: 30px; height: 42px; }

        /* Positioning for 2 players */
        .player-2 { top: 2rem; left: 50%; transform: translateX(-50%); } /* Opponent at the top */

        /* Center Pile */
        .center-pile { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; display: flex; flex-direction: column; gap: 1rem; align-items: center; }
        .reference-card { width: 70px; height: 98px; }
        .game-status-text { background: rgba(0,0,0,0.7); padding: 0.5rem 1rem; border-radius: 20px; color: #f1f5f9; }
        
        /* Current Player's Hand */
        .player-hand-area { min-height: 120px; display: flex; justify-content: center; align-items: flex-end; padding-bottom: 1rem; }
        .hand-cards { display: flex; gap: 0.5rem; }
        .card-face { width: 70px; height: 98px; background: white; border: 2px solid #333; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 2rem; font-weight: bold; color: #333; cursor: pointer; transition: all 0.2s ease; }
        .hand-card:hover { transform: translateY(-10px); }
        .hand-card.selected { transform: translateY(-20px); border-color: var(--color-accent-gold); box-shadow: 0 5px 15px rgba(212, 175, 55, 0.5); }
        
        /* Action Buttons & Modal */
        .action-buttons { display: flex; justify-content: center; gap: 1rem; min-height: 50px; }
        .action-btn { padding: 0.75rem 1.5rem; font-size: 1rem; }
        .action-btn:disabled { background: var(--color-primary-disabled); cursor: not-allowed; opacity: 0.6; }
        .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(5px); display: none; justify-content: center; align-items: center; z-index: 1000; }
        .modal-overlay.show { display: flex; }
        .modal-content { background: var(--color-parchment); border: 2px solid var(--color-wood-light); color: var(--color-text-light); max-width: 500px; width: 90%; border-radius: 1rem; overflow: hidden; }
        .modal-header { background: var(--color-wood-dark); padding: 1rem; }
        .modal-title { margin: 0; font-size: 1.5rem; text-align: center; color: var(--color-accent-gold) }
        .modal-body { padding: 1.5rem; }
        .modal-actions { display: flex; gap: 1rem; padding: 1rem; justify-content: flex-end; background: var(--color-wood-dark); }
        .button-secondary { background: var(--color-primary); }

        /* Chat Sidebar */
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
        .button-quit-game { width: 100%; }
    `;
    return style.outerHTML;
};