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
    // Reset chat messages when entering a new game board
    chatMessages = []; 

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
                    <button id="quit-game-btn" class="button-quit-game">
                        <span class="quit-icon">🚪</span><span class="quit-text">Leave Table</span>
                    </button>
                </div>
            </div>
        </div>
        ${renderQuitModal()}
        ${renderDynamicStyles()}
        <div id="roulette-overlay" class="roulette-overlay hidden">
            <div id="roulette-modal" class="roulette-modal">
                <h2 id="roulette-title"></h2>
                <div id="revealed-card-container"></div>
                <div id="roulette-wheel"></div>
                <p id="roulette-result"></p>
            </div>
        </div>
    `;

    renderHeader(document.getElementById('header-container')!);
    initLobbyConnection(handleGameMessage);
    setupEventListeners();
};

const handleGameMessage = (message: any) => {
    console.log('[Game WS] Received:', message);
    const currentUser = getUser();

    switch(message.type) {
        case 'ROOM_STATE_UPDATE':
            gameState = message.payload;
            myCards = message.payload.myCards || myCards;
            updateUI();
            break;
        case 'CHAT_BROADCAST':
            chatMessages.push(message.payload);
            if (chatMessages.length > 100) chatMessages.shift(); // Keep chat history tidy
            renderChat();
            break;
        case 'GAME_STARTED':
            alert(message.payload.message);
            break;
        case 'GAME_FINISHED':
            setTimeout(() => {
                showEndGameScreen(message.payload.winnerId === currentUser?.id, message.payload.message);
            }, 7000); // Increased delay to ensure it shows after roulette animation
            break;
        case 'CHALLENGE_RESULT':
            handleChallengeResult(message.payload);
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

const handleChallengeResult = (payload: any) => {
    const overlay = document.getElementById('roulette-overlay')!;
    const title = document.getElementById('roulette-title')!;
    const wheel = document.getElementById('roulette-wheel')!;
    const result = document.getElementById('roulette-result')!;
    const revealedCardContainer = document.getElementById('revealed-card-container')!;

    let accusationMessage = "";
    if (payload.wasLie) {
        accusationMessage = `${payload.punishedPlayerName} was caught bluffing!`;
    } else {
        accusationMessage = `False accusation!`;
    }

    title.textContent = accusationMessage;
    revealedCardContainer.innerHTML = createHandCard(payload.revealedCard, 'reference-card');
    wheel.style.display = 'none';
    result.textContent = `The card was a ${payload.revealedCard.type.toUpperCase()}`;
    overlay.classList.remove('hidden');

    const accusationDuration = 4000;
    const spinDuration = 4000;
    const resultDisplayDuration = 2500;

    setTimeout(() => {
        revealedCardContainer.innerHTML = '';
        wheel.style.display = 'block';
        title.textContent = `${payload.punishedPlayerName} spins the roulette...`;
        result.textContent = '';

        wheel.style.animation = 'none';
        void wheel.offsetWidth; 
        wheel.style.animation = `spin ${spinDuration / 1000}s cubic-bezier(0.25, 1, 0.5, 1)`;

        setTimeout(() => {
            result.textContent = payload.isEliminated ? '💥 BANG! Eliminated! 💥' : '😮‍💨 *click*... Survived!';
            result.style.color = payload.isEliminated ? 'var(--color-danger)' : 'var(--color-success)';
            
            setTimeout(() => {
                overlay.classList.add('hidden');
            }, resultDisplayDuration);
        }, spinDuration);
    }, accusationDuration);
};

const showEndGameScreen = (didIWin: boolean, message: string) => {
    const gameArea = document.getElementById('game-area')!;
    gameArea.innerHTML = `
        <div class="end-game-screen ${didIWin ? 'win' : 'lose'}">
            <h1>${didIWin ? 'Victory!' : 'Defeat!'}</h1>
            <p>${message}</p>
            <button id="back-to-lobby" class="button button-primary">Back to Lobby</button>
        </div>
    `;
    document.getElementById('back-to-lobby')?.addEventListener('click', () => {
        disconnect();
        navigate('/home');
    });
};

const updateUI = () => {
    if (!gameState) return;
    const currentUser = getUser();
    if (!currentUser) return;

    const me = gameState.players.find(p => p.id === currentUser.id);
    if (me?.isEliminated) {
        showEndGameScreen(false, "You have been eliminated.");
        return;
    }

    const isMyTurn = gameState.game?.currentPlayerId === currentUser.id;
    const canChallenge = gameState.game?.lastPlayerId !== null && gameState.game.lastPlayerId !== currentUser.id;

    renderPlayerPods(currentUser.id);
    renderMyInfo(currentUser.id);
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
        if (player.id === currentUserId) return '';
        if (player.isEliminated) {
            return createEliminatedPod(player, index + 1);
        }
        const isCurrentTurn = player.id === gameState?.game?.currentPlayerId;
        return createPlayerPod(player, index + 1, isCurrentTurn);
    }).join('');
};

const renderMyInfo = (currentUserId: string) => {
    const container = document.getElementById('my-info-area');
    if (!container || !gameState) return;

    const me = gameState.players.find(p => p.id === currentUserId);
    if (me) {
        container.innerHTML = createMyInfoPod(me);
    }
};

const renderMyHand = (isMyTurn: boolean) => {
    const container = document.getElementById('my-hand-cards');
    if (!container) return;
    container.innerHTML = myCards.map(card => createHandCard(card, 'hand-card')).join('');
    
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
        statusText.textContent = `Required: ${gameState.game.currentCardType?.toUpperCase() || 'ANY'} | Turn: ${currentPlayer?.username}`;
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
        container.innerHTML = createHandCard({ id: 'ref', type: referenceType }, 'reference-card');
    } else {
        container.innerHTML = '';
    }
};

const renderChat = () => {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const currentUser = getUser();
    container.innerHTML = chatMessages.map(msg => `
        <div class="message ${msg.authorId === currentUser?.id ? 'my-message' : ''}">
            <span class="author-name">${msg.authorId === currentUser?.id ? 'You' : msg.authorName}</span>
            <span class="content">${msg.message}</span>
            <span class="timestamp">${new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
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
    selectedCardId = null;
};

const handleCallBluffAction = () => {
    sendWebSocketMessage({ type: 'CALL_BLUFF', payload: {} });
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
    return reordered.slice(currentUserIndex).concat(reordered.slice(0, currentUserIndex));
}

const createPlayerPod = (player: any, position: number, isCurrentTurn: boolean) => {
    const avatarSrc = player.avatar_url ? `${API_BASE_URL}${player.avatar_url}` : 'https://via.placeholder.com/60';
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

const createMyInfoPod = (player: any) => {
    const avatarSrc = player.avatar_url ? `${API_BASE_URL}${player.avatar_url}` : 'https://via.placeholder.com/60';
    const isMyTurn = gameState?.game?.currentPlayerId === player.id;
    return `
        <img src="${avatarSrc}" alt="${player.username}'s avatar" class="my-avatar ${isMyTurn ? 'active-turn' : ''}" />
        <div class="my-details">
            <span class="my-name">${player.username}</span>
            <span class="my-risk-level">Risk: ${player.riskLevel || 0}/6</span>
        </div>
    `;
};

const createEliminatedPod = (player: any, position: number) => {
    const avatarSrc = player.avatar_url ? `${API_BASE_URL}${player.avatar_url}` : 'https://via.placeholder.com/60';
    return `
        <div class="player-pod player-${position} eliminated" data-player-id="${player.id}">
            <div class="player-info">
                <img src="${avatarSrc}" alt="${player.username}'s avatar" class="player-avatar eliminated-avatar" />
                <div class="player-details">
                    <span class="player-name">${player.username}</span>
                    <span class="player-risk-level">ELIMINATED</span>
                </div>
            </div>
        </div>`;
};

const createHandCard = (card: Card, extraClass: string = '') => {
    const cardContent = card.type === 'joker' ? '🃏' : card.type.charAt(0).toUpperCase();
    return `<div class="card-face ${extraClass}" data-card-id="${card.id}">${cardContent}</div>`;
};

const createActionButtons = (isMyTurn: boolean, canChallenge: boolean) => `
    <button id="play-card-btn" class="button button-primary action-btn" ${!isMyTurn ? 'disabled' : ''}>Play Card</button>
    <button id="call-bluff-btn" class="button button-danger action-btn" ${!isMyTurn || !canChallenge ? 'disabled' : ''}>Call Bluff</button>
`;

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

const renderDynamicStyles = () => {
    const style = document.createElement('style');
    style.textContent = `
        /* ... (CSS anterior, omitido por brevidade) ... */
        .player-pod.eliminated .player-avatar { filter: grayscale(100%) brightness(0.5); }
        .player-risk-level { color: #fca5a5; }
        .eliminated-screen, .end-game-screen { display: flex; flex-direction: column; justify-content: center; align-items: center; position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(15, 23, 42, 0.95); z-index: 100;}
        .end-game-screen.win h1 { color: var(--color-success); }
        .end-game-screen.lose h1 { color: var(--color-danger); }
        .end-game-screen h1, .eliminated-screen h1 { font-family: var(--font-display); font-size: 3rem; }
        .end-game-screen p { font-size: 1.2rem; }
        .end-game-screen button, .eliminated-screen button { margin-top: 2rem; width: auto; padding: 1rem 2rem; }
        
        /* Roulette Modal Styles */
        .roulette-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0,0,0,0.85); backdrop-filter: blur(8px); display: flex; justify-content: center; align-items: center; z-index: 2000; }
        .roulette-modal { display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; color: white; gap: 1rem;}
        #roulette-title { font-family: var(--font-display); font-size: 2.5rem; color: var(--color-accent-gold); text-shadow: 2px 2px 4px #000; }
        #revealed-card-container .card-face { margin: 1rem 0; }
        #roulette-wheel { width: 150px; height: 150px; background-image: url('https://i.imgur.com/8z6oA0V.png'); background-size: contain; margin: 2rem auto; display: none; }
        #roulette-result { font-size: 2rem; font-weight: bold; text-shadow: 2px 2px 4px #000; min-height: 2.5rem; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(1440deg); } }
        
        /* Chat Styles */
        .chat-sidebar { width: 350px; flex-shrink: 0; display: flex; flex-direction: column; background: #1e293b; border-left: 2px solid var(--color-wood-light); }
        .chat-panel { flex-grow: 1; display: flex; flex-direction: column; overflow: hidden; }
        .chat-header { padding: 1rem; background: var(--color-wood-dark); color: var(--color-accent-gold); }
        .chat-title { font-weight: bold; font-family: var(--font-display) }
        .chat-messages { flex-grow: 1; padding: 1rem; overflow-y: auto; background: var(--color-parchment); }
        .chat-messages .message { display: flex; flex-direction: column; gap: 0.2rem; margin-bottom: 0.75rem; max-width: 90%; }
        .chat-messages .message.my-message { align-self: flex-end; background-color: rgba(212, 175, 55, 0.1); border-radius: 8px; padding: 0.5rem; }
        .chat-messages .message .author-name { font-size: 0.8rem; font-weight: bold; color: var(--color-accent-gold); }
        .chat-messages .message.my-message .author-name { color: var(--color-success); }
        .chat-messages .timestamp { font-size: 0.7rem; color: var(--color-text-medium); text-align: right; }
        .chat-messages .content { word-wrap: break-word; }
        .chat-input-area { display: flex; padding: 1rem; gap: 0.5rem; border-top: 2px solid var(--color-wood-dark); background: var(--color-wood-dark); }
        .chat-input { flex-grow: 1; border-radius: 20px; background: var(--color-bg-white); border: 1px solid var(--color-border); padding: 0.5rem 1rem; color: var(--color-text-light); }
        .send-btn { background: var(--color-accent-gold); border: none; color: var(--color-wood-dark); width: 40px; height: 40px; border-radius: 50%; cursor: pointer; font-size: 1.2rem; flex-shrink: 0; }
        .game-controls { padding: 1rem; background: var(--color-wood-dark); }
        .button-quit-game { width: 100%; }
    `;
    return style.outerHTML;
};