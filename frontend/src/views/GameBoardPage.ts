import { getUser } from '../auth/auth.ts';
import { navigate } from '../router/router.ts';
import { renderHeader } from './components/Header.ts';

// Helper to get the base URL for the API
const API_BASE_URL = 'http://localhost:3001';

/**
 * Renders the main Game Board page.
 * @param {HTMLElement} element The root element to render the page content into.
 */
export const renderGameBoardPage = (element: HTMLElement) => {
    const currentUser = getUser();
    if (!currentUser) {
        navigate('/');
        return;
    }

    // --- MOCK DATA ---
    const mockPlayers = [
        currentUser, // Player 1 (bottom) is the current user.
        { username: 'Vinicius', avatar_url: '/uploads/avatar-vinicius-mock.jpg' },
        { username: 'Maikon', avatar_url: '/uploads/avatar-maikon-mock.jpg' },
        { username: 'Bruno', avatar_url: '/uploads/avatar-bruno-mock.jpg' }
    ];

    const createPlayerPod = (player: any, index: number) => {
        const avatarSrc = player.avatar_url 
            ? `${API_BASE_URL}${player.avatar_url}`
            : 'https://via.placeholder.com/50';

        return `
            <div class="player-pod player-${index + 1}" data-player="${index + 1}">
                <div class="player-cards">
                    <div class="card-back"></div>
                    <div class="card-back"></div>
                    <div class="card-back"></div>
                </div>
                <div class="player-info">
                    <img src="${avatarSrc}" alt="${player.username}'s avatar" class="player-avatar" />
                    <span class="player-name">${player.username}</span>
                </div>
            </div>
        `;
    };

    element.innerHTML = `
        <div id="header-container"></div>
        <div class="game-layout">
            <div class="game-area">
                <div class="game-table">
                    <!-- Player pods will be injected here -->
                    ${mockPlayers.map(createPlayerPod).join('')}

                    <div class="center-pile">
                        <div class="deck-area">
                            <div class="card-stack">
                                <div class="card-back deck-card"></div>
                            </div>
                            <div class="played-cards">
                                <div class="card-face played-card">K</div>
                            </div>
                        </div>
                        <p class="game-status-text">Current: Kings - ${mockPlayers[1].username}'s turn</p>
                    </div>
                </div>
                
                <div class="player-hand-area">
                    <div class="hand-cards">
                        <div class="card-face hand-card">K</div>
                        <div class="card-face hand-card">Q</div>
                        <div class="card-face hand-card">J</div>
                        <div class="card-face hand-card">🃏</div>
                        <div class="card-face hand-card">A</div>
                    </div>
                </div>
                
                <div class="action-buttons">
                    <button class="button button-primary action-btn">
                        <span class="btn-icon">🎯</span>
                        <span class="btn-text">Play Card</span>
                    </button>
                    <button class="button button-danger action-btn">
                        <span class="btn-icon">⚠️</span>
                        <span class="btn-text">Call Bluff</span>
                    </button>
                </div>
            </div>
            
            <div class="chat-sidebar">
                <div class="chat-panel">
                    <div class="chat-header">
                        <span class="chat-title">Live Chat</span>
                        <div class="online-indicator">
                            <span class="dot"></span>
                            <span class="count">4 online</span>
                        </div>
                    </div>
                    <div class="chat-messages">
                        <div class="message system-message">
                            <span class="timestamp">20:15</span>
                            <span class="content"><strong>System:</strong> Welcome to Liar's Bar</span>
                        </div>
                        <div class="message player-message">
                            <span class="timestamp">20:16</span>
                            <span class="content"><strong>Maikon:</strong> Good luck everyone!</span>
                        </div>
                        <div class="message player-message">
                            <span class="timestamp">20:17</span>
                            <span class="content"><strong>Vinicius:</strong> Let's see who's the best liar here</span>
                        </div>
                    </div>
                    <div class="chat-input-area">
                        <input type="text" placeholder="Type your message..." class="chat-input" maxlength="100" />
                        <button class="send-btn" aria-label="Send message">
                            <span>➤</span>
                        </button>
                    </div>
                </div>
                
                <div class="game-controls">
                    <button id="quit-game-btn" class="button-quit-game">
                        <span class="quit-icon">🚪</span>
                        <span class="quit-text">Leave Table</span>
                    </button>
                </div>
            </div>
        </div>

        <!-- Confirmation Modal for Quitting -->
        <div id="quit-game-modal" class="modal-overlay">
            <div class="modal-content">
                <div class="modal-header">
                    <h2 class="modal-title">🍺 Show Weakness?</h2>
                </div>
                <div class="modal-body">
                    <p>Cowards don't last long in this bar. Leaving the table now is an admission of defeat.</p>
                    <p><strong>Are you sure you want to forfeit the game?</strong></p>
                </div>
                <div class="modal-actions">
                    <button id="cancel-quit-btn" class="button button-secondary">
                        <span>🎯 Stay & Fight</span>
                    </button>
                    <button id="confirm-quit-btn" class="button button-danger">
                        <span>🚪 Yes, I'm Out</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    // --- DYNAMIC STYLES ---
    const style = document.createElement('style');
    style.textContent = `
        /* Reset and Base Styles */
        * {
            box-sizing: border-box;
        }

        /* Game Layout */
        .game-layout {
            display: flex;
            height: calc(100vh - 80px);
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 600px;
        }

        .game-area {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 1rem;
            position: relative;
            background-image: 
                radial-gradient(circle at 20% 50%, rgba(255, 215, 0, 0.05) 0%, transparent 50%),
                radial-gradient(circle at 80% 20%, rgba(255, 215, 0, 0.05) 0%, transparent 50%),
                url('https://www.transparenttextures.com/patterns/brick-wall.png');
            background-size: cover, cover, 100px 100px;
            min-height: 500px;
        }

        .chat-sidebar {
            width: 350px;
            flex-shrink: 0;
            display: flex;
            flex-direction: column;
            background: rgba(255, 255, 255, 0.95);
            backdrop-filter: blur(10px);
            border-left: 3px solid var(--color-accent-gold, #ffd700);
            box-shadow: -5px 0 15px rgba(0, 0, 0, 0.2);
        }

        /* Game Table */
        .game-table {
            position: relative;
            width: min(90vw, 800px);
            height: min(60vh, 500px);
            background: radial-gradient(ellipse at center, #0a4a1a 0%, #064016 70%, #041a0a 100%);
            border: 15px solid var(--color-wood-dark, #8B4513);
            border-radius: 50%;
            box-shadow: 
                inset 0 0 30px rgba(0, 0, 0, 0.8),
                0 15px 40px rgba(0, 0, 0, 0.6),
                inset 0 0 0 5px rgba(255, 215, 0, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
        }

        /* Player Pods */
        .player-pod {
            position: absolute;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
            transition: all 0.3s ease;
        }

        .player-pod:hover {
            transform: scale(1.05);
        }

        .player-info {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.25rem;
        }

        .player-avatar {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            border: 3px solid var(--color-accent-gold, #ffd700);
            object-fit: cover;
            background-color: var(--color-wood-dark, #8B4513);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
            transition: all 0.3s ease;
        }

        .player-avatar:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
        }

        .player-name {
            background: rgba(0, 0, 0, 0.8);
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-weight: 700;
            color: var(--color-text-light, #ffffff);
            font-size: 0.875rem;
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
            border: 1px solid rgba(255, 215, 0, 0.3);
        }

        .player-cards {
            display: flex;
            gap: -10px;
            margin-bottom: 0.5rem;
        }

        .card-back {
            width: 25px;
            height: 35px;
            background: linear-gradient(45deg, #8B0000, #DC143C);
            border: 1px solid #FFD700;
            border-radius: 4px;
            position: relative;
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .card-back::before {
            content: '🂠';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            font-size: 12px;
            color: #FFD700;
        }

        /* Player Positioning */
        .player-1 { bottom: -60px; left: 50%; transform: translateX(-50%); }
        .player-2 { top: 50%; left: -60px; transform: translateY(-50%); }
        .player-3 { top: -60px; left: 50%; transform: translateX(-50%); }
        .player-4 { top: 50%; right: -60px; transform: translateY(-50%); }

        /* Center Pile */
        .center-pile {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 1rem;
        }

        .deck-area {
            display: flex;
            gap: 2rem;
            align-items: center;
        }

        .card-stack {
            position: relative;
        }

        .deck-card {
            width: 50px;
            height: 70px;
            background: linear-gradient(45deg, #8B0000, #DC143C);
            border: 2px solid #FFD700;
            border-radius: 8px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.4);
        }

        .played-cards {
            position: relative;
        }

        .played-card, .hand-card {
            width: 50px;
            height: 70px;
            background: white;
            border: 2px solid #333;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            font-weight: bold;
            color: #333;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .played-card:hover, .hand-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 6px 12px rgba(0, 0, 0, 0.4);
        }

        .game-status-text {
            background: rgba(0, 0, 0, 0.7);
            padding: 0.5rem 1rem;
            border-radius: 20px;
            font-weight: 600;
            color: var(--color-text-light, #ffffff);
            font-size: 0.9rem;
            text-align: center;
            border: 1px solid rgba(255, 215, 0, 0.3);
            text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.8);
        }

        /* Player Hand */
        .player-hand-area {
            margin-top: 2rem;
            display: flex;
            justify-content: center;
        }

        .hand-cards {
            display: flex;
            gap: 0.5rem;
        }

        .hand-card {
            cursor: pointer;
            transition: all 0.3s ease;
        }

        .hand-card:hover {
            transform: translateY(-10px);
            z-index: 10;
        }

        .hand-card.selected {
            transform: translateY(-15px);
            box-shadow: 0 8px 16px rgba(255, 215, 0, 0.4);
            border-color: #FFD700;
        }

        /* Action Buttons */
        .action-buttons {
            display: flex;
            gap: 1rem;
            margin-top: 1rem;
        }

        .action-btn {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            font-size: 1rem;
            font-weight: 600;
            border-radius: 25px;
            border: none;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        .action-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
        }

        .action-btn:active {
            transform: translateY(0);
        }

        .btn-icon {
            font-size: 1.2rem;
        }

        /* Chat Panel */
        .chat-panel {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            height: 100%;
        }

        .chat-header {
            padding: 1rem;
            background: linear-gradient(135deg, var(--color-wood-dark, #8B4513), #A0522D);
            color: var(--color-accent-gold, #ffd700);
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid rgba(255, 215, 0, 0.3);
        }

        .chat-title {
            font-family: var(--font-display, 'serif');
            font-size: 1.25rem;
            font-weight: 700;
        }

        .online-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;
        }

        .dot {
            width: 8px;
            height: 8px;
            background: #00ff00;
            border-radius: 50%;
            animation: pulse 2s infinite;
        }

        @keyframes pulse {
            0% { opacity: 1; }
            50% { opacity: 0.5; }
            100% { opacity: 1; }
        }

        .chat-messages {
            flex-grow: 1;
            padding: 1rem;
            overflow-y: auto;
            background: rgba(255, 255, 255, 0.95);
            max-height: 400px;
        }

        .message {
            margin-bottom: 0.75rem;
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
        }

        .timestamp {
            font-size: 0.75rem;
            color: #666;
            align-self: flex-start;
        }

        .content {
            background: rgba(240, 240, 240, 0.8);
            padding: 0.5rem;
            border-radius: 12px;
            line-height: 1.4;
            word-wrap: break-word;
            color: #000000;
        }

        .system-message .content {
            background: rgba(255, 215, 0, 0.2);
            border-left: 3px solid #FFD700;
        }

        .player-message .content {
            background: rgba(240, 240, 240, 0.9);
        }

        .chat-input-area {
            display: flex;
            padding: 1rem;
            border-top: 2px solid rgba(139, 69, 19, 0.2);
            background: rgba(255, 255, 255, 0.95);
            gap: 0.5rem;
        }

        .chat-input {
            flex-grow: 1;
            padding: 0.75rem;
            border: 2px solid rgba(139, 69, 19, 0.3);
            border-radius: 20px;
            background: white;
            font-size: 0.9rem;
            outline: none;
            transition: all 0.3s ease;
        }

        .chat-input:focus {
            border-color: var(--color-accent-gold, #ffd700);
            box-shadow: 0 0 0 3px rgba(255, 215, 0, 0.2);
        }

        .send-btn {
            background: linear-gradient(135deg, var(--color-primary, #4CAF50), #45a049);
            border: none;
            color: white;
            width: 45px;
            height: 45px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 1.2rem;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.3s ease;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        }

        .send-btn:hover {
            transform: scale(1.1);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
        }

        /* Game Controls */
        .game-controls {
            padding: 1rem;
            background: rgba(255, 255, 255, 0.95);
            border-top: 2px solid rgba(139, 69, 19, 0.2);
        }

        .button-quit-game {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            background: linear-gradient(135deg, var(--color-blood-red, #8B0000), #DC143C);
            border: 2px solid rgba(220, 20, 60, 0.8);
            color: var(--color-text-light, #ffffff);
            padding: 0.75rem 1rem;
            border-radius: 20px;
            font-family: var(--font-body, 'sans-serif');
            font-weight: 600;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.3s ease;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            width: 100%;
            justify-content: center;
            box-shadow: 0 4px 12px rgba(139, 0, 0, 0.3);
        }

        .button-quit-game:hover {
            background: linear-gradient(135deg, #DC143C, #B22222);
            transform: translateY(-2px);
            box-shadow: 0 6px 16px rgba(139, 0, 0, 0.4);
        }

        .button-quit-game:active {
            transform: translateY(0);
        }

        .quit-icon {
            font-size: 1.1rem;
        }

        /* Modal Styles */
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            backdrop-filter: blur(5px);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            animation: fadeIn 0.3s ease;
        }

        .modal-overlay.show {
            display: flex;
        }

        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }

        .modal-content {
            background: white;
            max-width: 500px;
            width: 90%;
            border-radius: 20px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease;
        }

        @keyframes slideIn {
            from { transform: translateY(-30px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
        }

        .modal-header {
            background: linear-gradient(135deg, var(--color-wood-dark, #8B4513), #A0522D);
            color: var(--color-accent-gold, #ffd700);
            padding: 1.5rem;
            text-align: center;
        }

        .modal-title {
            margin: 0;
            font-size: 1.5rem;
            font-weight: 700;
        }

        .modal-body {
            padding: 2rem;
            text-align: center;
            line-height: 1.6;
        }

        .modal-body p {
            margin-bottom: 1rem;
            color: #333;
        }

        .modal-actions {
            display: flex;
            gap: 1rem;
            padding: 1.5rem;
            justify-content: center;
            background: rgba(240, 240, 240, 0.5);
        }

        .modal-actions .button {
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 25px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .button-secondary {
            background: linear-gradient(135deg, #6c757d, #5a6268);
            color: white;
        }

        .button-secondary:hover {
            background: linear-gradient(135deg, #5a6268, #495057);
            transform: translateY(-2px);
        }

        .button-danger {
            background: linear-gradient(135deg, #dc3545, #c82333);
            color: white;
        }

        .button-danger:hover {
            background: linear-gradient(135deg, #c82333, #bd2130);
            transform: translateY(-2px);
        }

        /* Responsive Design */
        @media (max-width: 1200px) {
            .game-layout {
                flex-direction: column;
            }
            
            .chat-sidebar {
                width: 100%;
                height: 300px;
                border-left: none;
                border-top: 3px solid var(--color-accent-gold, #ffd700);
            }
            
            .game-area {
                flex-grow: 1;
                min-height: calc(100vh - 380px);
            }
        }

        @media (max-width: 768px) {
            .game-layout {
                height: calc(100vh - 60px);
            }
            
            .chat-sidebar {
                height: 250px;
            }
            
            .game-area {
                padding: 0.5rem;
                min-height: calc(100vh - 310px);
            }
            
            .game-table {
                width: 95vw;
                height: 45vh;
                border-width: 10px;
            }
            
            .player-avatar {
                width: 45px;
                height: 45px;
            }
            
            .player-name {
                font-size: 0.75rem;
                padding: 0.2rem 0.5rem;
            }
            
            .action-buttons {
                flex-direction: column;
                gap: 0.5rem;
                width: 100%;
                max-width: 300px;
            }
            
            .action-btn {
                width: 100%;
                justify-content: center;
            }
            
            .hand-cards {
                flex-wrap: wrap;
                gap: 0.3rem;
                justify-content: center;
            }
            
            .hand-card {
                width: 40px;
                height: 55px;
                font-size: 1.2rem;
            }
            
            .chat-messages {
                max-height: 150px;
            }
            
            .modal-content {
                width: 95%;
                margin: 1rem;
            }
            
            .modal-actions {
                flex-direction: column;
                gap: 0.5rem;
            }
        }

        @media (max-width: 480px) {
            .game-area {
                padding: 0.25rem;
            }
            
            .game-table {
                height: 40vh;
                border-width: 8px;
            }
            
            .player-avatar {
                width: 35px;
                height: 35px;
                border-width: 2px;
            }
            
            .player-name {
                font-size: 0.7rem;
            }
            
            .center-pile {
                gap: 0.5rem;
            }
            
            .deck-area {
                gap: 1rem;
            }
            
            .played-card, .deck-card {
                width: 35px;
                height: 50px;
            }
            
            .hand-card {
                width: 35px;
                height: 50px;
                font-size: 1rem;
            }
            
            .game-status-text {
                font-size: 0.8rem;
                padding: 0.4rem 0.8rem;
            }
            
            .action-btn {
                padding: 0.6rem 1rem;
                font-size: 0.9rem;
            }
            
            .chat-input-area {
                padding: 0.75rem;
            }
            
            .send-btn {
                width: 40px;
                height: 40px;
            }
        }

        /* Landscape orientation for mobile */
        @media (max-height: 500px) and (orientation: landscape) {
            .game-layout {
                flex-direction: row;
            }
            
            .chat-sidebar {
                width: 300px;
                height: 100%;
                border-left: 3px solid var(--color-accent-gold, #ffd700);
                border-top: none;
            }
            
            .game-area {
                min-height: auto;
            }
            
            .game-table {
                height: 70vh;
            }
            
            .player-hand-area {
                margin-top: 1rem;
            }
        }
    `;
    element.appendChild(style);

    // Render the header
    const headerContainer = document.getElementById('header-container') as HTMLElement;
    renderHeader(headerContainer);

    // --- EVENT LISTENERS ---
    
    // Hand card selection
    const handCards = document.querySelectorAll('.hand-card');
    handCards.forEach(card => {
        card.addEventListener('click', () => {
            handCards.forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
        });
    });

    // Chat functionality
    const chatInput = document.querySelector('.chat-input') as HTMLInputElement;
    const sendBtn = document.querySelector('.send-btn') as HTMLButtonElement;
    const chatMessages = document.querySelector('.chat-messages') as HTMLElement;

    const sendMessage = () => {
        const message = chatInput.value.trim();
        if (message) {
            const now = new Date();
            const timestamp = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            const messageElement = document.createElement('div');
            messageElement.className = 'message player-message';
            messageElement.innerHTML = `
                <span class="timestamp">${timestamp}</span>
                <span class="content"><strong>${currentUser.username}:</strong> ${message}</span>
            `;
            
            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            chatInput.value = '';
        }
    };

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // --- EVENT LISTENERS FOR QUIT MODAL ---
    const quitModal = document.getElementById('quit-game-modal') as HTMLDivElement;
    const quitBtn = document.getElementById('quit-game-btn') as HTMLButtonElement;
    const confirmQuitBtn = document.getElementById('confirm-quit-btn') as HTMLButtonElement;
    const cancelQuitBtn = document.getElementById('cancel-quit-btn') as HTMLButtonElement;

    const openModal = () => {
        quitModal.classList.add('show');
        document.body.style.overflow = 'hidden';
    };
    
    const closeModal = () => {
        quitModal.classList.remove('show');
        document.body.style.overflow = 'auto';
    };

    quitBtn?.addEventListener('click', openModal);
    cancelQuitBtn?.addEventListener('click', closeModal);
    
    // Close modal if clicking on the overlay
    quitModal.addEventListener('click', (e) => {
        if (e.target === quitModal) {
            closeModal();
        }
    });

    // Handle ESC key to close modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && quitModal.classList.contains('show')) {
            closeModal();
        }
    });

    // Handle the actual forfeiture
    confirmQuitBtn?.addEventListener('click', () => {
        // In a real app, you would send a message to the server here (e.g., via WebSocket)
        // to notify that the player has forfeited.
        console.log(`Player ${currentUser.username} has forfeited the game.`);

        closeModal();
        navigate('/home'); // Redirect to the home page
    });

    // Action buttons functionality
    const actionButtons = document.querySelectorAll('.action-btn') as NodeListOf<HTMLElement>;
    actionButtons.forEach(button => {
        button.addEventListener('click', () => {
            const action = button.textContent?.toLowerCase().includes('play') ? 'play' : 'bluff';
            console.log(`Player ${currentUser.username} chose to ${action}`);
            
            // Add visual feedback
            button.style.transform = 'scale(0.95)';
            setTimeout(() => {
                button.style.transform = '';
            }, 150);
        });
    });

    // Player pod hover effects
    const playerPods = document.querySelectorAll('.player-pod') as NodeListOf<HTMLElement>;
    playerPods.forEach(pod => {
        pod.addEventListener('mouseenter', () => {
            pod.style.zIndex = '10';
        });
        
        pod.addEventListener('mouseleave', () => {
            pod.style.zIndex = '1';
        });
    });

    // Auto-scroll chat to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
};