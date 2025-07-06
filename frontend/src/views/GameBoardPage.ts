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
    // In a real application, this data would come from a game state server (e.g., via WebSockets).
    // We are mocking 3 other players for layout purposes.
    const mockPlayers = [
        currentUser, // Player 1 (bottom) is the current user.
        { username: 'Hari', avatar_url: '/uploads/avatar-hari-mock.jpg' }, // Player 2 (left)
        { username: 'Mohan', avatar_url: '/uploads/avatar-mohan-mock.jpg' }, // Player 3 (top)
        { username: 'Rakesh', avatar_url: '/uploads/avatar-rakesh-mock.jpg' }  // Player 4 (right)
    ];

    // Function to generate the HTML for each player pod
    const createPlayerPod = (player: any, index: number) => {
        const avatarSrc = player.avatar_url 
            ? `${API_BASE_URL}${player.avatar_url}`
            : 'https://via.placeholder.com/50'; // Fallback placeholder

        return `
            <div class="player-pod player-${index + 1}">
                <div class="player-cards">
                    <div class="card-back"></div>
                    <div class="card-back"></div>
                    <div class="card-back"></div>
                </div>
                <img src="${avatarSrc}" alt="${player.username}'s avatar" class="player-avatar" />
                <span class="player-name">${player.username}</span>
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
                        <p class="game-status-text">Waiting for game to start...</p>
                    </div>
                </div>
                <div class="player-hand-area">
                    <!-- Current player's cards would go here -->
                </div>
                <div class="action-buttons">
                    <button class="button button-primary">Bet</button>
                    <button class="button button-danger">Doubt</button>
                </div>
            </div>
            <div class="chat-panel">
                <div class="chat-header">Live Chat</div>
                <div class="chat-messages">
                    <div class="message"><strong>System:</strong> Welcome to Liar's Bar.</div>
                    <div class="message"><strong>Mohan:</strong> Good luck, everyone. Or should I say, bad luck?</div>
                </div>
                <div class="chat-input-area">
                    <input type="text" placeholder="Write your message..." class="chat-input" />
                    <button class="send-btn">➤</button>
                </div>
            </div>
        </div>
    `;

    // --- DYNAMIC STYLES ---
    const style = document.createElement('style');
    style.textContent = `
        .game-layout {
            display: flex;
            height: calc(100vh - 80px); /* Full height minus header */
            background-color: var(--color-bg-light);
        }
        .game-area {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            padding: 1rem;
            position: relative;
            background-image: url('https://www.transparenttextures.com/patterns/brick-wall.png');
        }
        .chat-panel {
            width: 350px;
            flex-shrink: 0;
            background-color: var(--color-bg-white);
            border-left: 2px solid var(--color-wood-light);
            display: flex;
            flex-direction: column;
        }
        .game-table {
            position: relative;
            width: 90%;
            max-width: 800px;
            height: 60%;
            max-height: 500px;
            background-color: #0a4a1a;
            border: 15px solid var(--color-wood-dark);
            border-radius: 150px;
            box-shadow: inset 0 0 20px rgba(0,0,0,0.7), 0 10px 30px rgba(0,0,0,0.5);
        }
        .player-pod {
            position: absolute;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 0.5rem;
        }
        .player-avatar {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            border: 3px solid var(--color-accent-gold);
            object-fit: cover;
            background-color: var(--color-wood-dark);
        }
        .player-name {
            background: rgba(0,0,0,0.7);
            padding: 0.2rem 0.5rem;
            border-radius: 4px;
            font-weight: 700;
            color: var(--color-text-light);
        }
        /* Player Positioning */
        .player-1 { bottom: -50px; left: 50%; transform: translateX(-50%); } /* Current Player */
        .player-2 { top: 50%; left: -50px; transform: translateY(-50%); } /* Left Player */
        .player-3 { top: -50px; left: 50%; transform: translateX(-50%); } /* Top Player */
        .player-4 { top: 50%; right: -50px; transform: translateY(-50%); } /* Right Player */

        .action-buttons {
            position: absolute;
            bottom: 2rem;
            display: flex;
            gap: 1rem;
        }
        .chat-header {
            padding: 1rem;
            font-family: var(--font-display);
            font-size: 1.5rem;
            text-align: center;
            background: var(--color-wood-dark);
            color: var(--color-accent-gold);
        }
        .chat-messages {
            flex-grow: 1;
            padding: 1rem;
            overflow-y: auto;
        }
        .message { margin-bottom: 0.75rem; line-height: 1.4; }
        .chat-input-area {
            display: flex;
            padding: 1rem;
            border-top: 2px solid var(--color-wood-light);
        }
        .chat-input { flex-grow: 1; margin-right: 0.5rem; }
        .send-btn {
            background: var(--color-primary);
            border: none;
            color: white;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            cursor: pointer;
            font-size: 1.5rem;
            line-height: 1;
        }
    `;
    element.appendChild(style);


    // Render the header
    const headerContainer = document.getElementById('header-container') as HTMLElement;
    renderHeader(headerContainer);
};