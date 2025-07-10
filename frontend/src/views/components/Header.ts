import * as websocket from "../../lobby/websocket.ts"
import { getUser, logout } from '../../auth/auth.ts';
import { navigate } from '../../router/router.ts';

/**
 * Renders the main application header for authenticated users.
 * The header includes the game logo, a button to open the game rules modal,
 * and user information with a link to their profile page.
 * @param {HTMLElement} element The container element where the header will be mounted.
 */
export const renderHeader = (element: HTMLElement) => {
  // Get the current authenticated user data
  const user = getUser();
  if (!user) return; // Early return if user is not authenticated - header should not be rendered

  // Dynamically generate avatar element based on user's avatar availability
  // Uses either the user's uploaded avatar image or a default SVG icon
  const avatarElement = user.avatar_url
    ? `<img src="${user.avatar_url}" alt="${user.username}'s avatar" class="avatar-icon" style="width: 28px; height: 28px; object-fit: cover; padding: 0;"/>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="avatar-icon">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>`;

  // Render the complete header structure with logo, navigation, and user interface
  element.innerHTML = `
    <header class="app-header">
      <div class="header-left">
        <div class="logo">
          <!-- 
            Final Logo Revision: A stark, graphic icon for maximum impact at small sizes.
            This design avoids complex details for a clean, memorable, and somber look.
            - Simplified Skull/Mask: Represents the high stakes and the "poker face" of a liar.
            - The Crack: Symbolizes the fragility of a lie and the tension of the game.
            - Red Spade Eye: A direct, unambiguous link to the card game, with the spade representing danger and the red color adding a sense of aggression.
          -->
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" class="logo-icon">
            <!-- Dark circular background for contrast -->
            <circle cx="12" cy="12" r="11" fill="#1a1a1a" stroke="#333" stroke-width="1.5"/>
            
            <!-- Main skull/mask shape, filled in white for a bold look -->
            <path d="M17.5 9C17.5 5 15 3 12 3S6.5 5 6.5 9c0 4 1 8 5.5 11 4.5-3 5.5-7 5.5-11z" fill="#f7fafc"/>
            
            <!-- Empty eye socket on the right -->
            <circle cx="14.5" cy="10.5" r="1.5" fill="#1a1a1a"/>
            
            <!-- Red spade eye on the left -->
            <g transform="translate(7, 8.5) scale(0.2)">
              <path d="M12 0C6.343 6.343 0 10.5 0 16c0 4.418 3.582 8 8 8s8-3.582 8-8c0-5.5-6.343-9.657-12-16zM12 21a1 1 0 110-2 1 1 0 010 2z" fill="#e53e3e"/>
              <path d="M11 26h2v-8h-2v8z" fill="#e53e3e"/>
            </g>

            <!-- The crack, representing the broken facade of a liar -->
            <path d="M11.5 3.5L10 9l2 2.5-2 3.5" fill="none" stroke="#1a1a1a" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          <span class="logo-text">Liar's Bar</span>
        </div>
      </div>
      
      <!-- Center section containing the game rules button -->
      <div class="header-center">
        <button id="rules-btn" class="button-rules">Game Rules</button>
      </div>
      
      <!-- Right section with user profile information and dropdown menu -->
      <div class="header-right">
        <!-- User profile trigger - displays avatar and username -->
        <div id="user-profile-link" class="user-info">
          ${avatarElement}
          <span class="username">${user.username}</span>
        </div>
        
        <!-- Dropdown menu for user actions (hidden by default) -->
        <div id="user-dropdown" class="user-dropdown-menu hidden">
          <ul>
            <li id="profile-menu-item">My Profile</li>
            <li id="logout-menu-item">Leave</li>
          </ul>
        </div>
      </div>
    </header>

    <!-- Modal overlay for game rules - initially hidden -->
    <div id="rules-modal-overlay" class="modal-overlay hidden">
      <div class="modal-content">
        <!-- Enhanced close button with better accessibility and click area -->
        <button id="close-modal-btn" class="modal-close-btn" aria-label="Close modal" title="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
        
        <!-- Game rules content -->
        <h2 class="modal-title">How to Play Liar's Deck</h2>
        <div class="modal-body">
          <h3>The Deadly Game</h3>
          <p>Welcome to Liar's Bar, where deception is survival and one wrong move could be your last. In this high-stakes card game, players must master the art of bluffing while detecting lies from their opponents.</p>
          
          <h3>Setup & Objective</h3>
          <ul>
            <li>Each player receives 5 cards and a revolver with mixed ammunition</li>
            <li>The goal is to be the last player standing by eliminating opponents through successful accusations</li>
            <li>Cards include regular playing cards (2-A) and special Joker cards</li>
          </ul>

          <h3>Playing the Game</h3>
          <ol>
            <li><strong>Card Declaration:</strong> Players take turns playing cards face down, declaring what they claim to have played. The declared value must match the current table requirement (e.g., "King" when Kings are being played).</li>
            <li><strong>Bluffing Opportunity:</strong> You can lie about the card you've played. This is the core of the game - psychological warfare through deception.</li>
            <li><strong>Challenging Lies:</strong> If you suspect another player is lying, you can call "Liar!" to challenge their claim.</li>
            <li><strong>Jokers are Wild:</strong> Joker cards can be played as any value, making them safe to play but limited in quantity.</li>
          </ol>

          <h3>The Stakes: Russian Roulette</h3>
          <p>When a player is caught lying or makes a false accusation, they must face the consequences:</p>
          <ul>
            <li>If the accused player was <strong>truthful</strong> (played the correct card or a Joker), the false accuser draws from their revolver</li>
            <li>If the accused player was <strong>lying</strong> (played an incorrect card), they must draw from their revolver</li>
            <li>Drawing a lethal round eliminates the player immediately</li>
            <li>Drawing a blank allows the player to continue</li>
          </ul>

          <div class="warning">
            <strong>⚠️ Warning:</strong> This is a game of elimination. Players who draw lethal rounds are permanently removed from the game. Only the most cunning and lucky will survive until the end.
          </div>

          <h3>Strategy Tips</h3>
          <ul>
            <li>Master the art of maintaining a poker face while lying</li>
            <li>Study your opponents' behavior patterns and tells</li>
            <li>Use Jokers strategically - they're your safety net</li>
            <li>Consider the risk vs. reward of each accusation</li>
            <li>Remember: in the bar, trust no one</li>
          </ul>
        </div>
      </div>
    </div>

    <!-- Additional CSS for improved modal close button -->
    <style>
      .modal-close-btn {
        position: absolute;
        top: 15px;
        right: 15px;
        width: 44px;
        height: 44px;
        border: none;
        background: rgba(0, 0, 0, 0.1);
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
        z-index: 1000;
      }
      
      .modal-close-btn:hover {
        background: rgba(0, 0, 0, 0.2);
        transform: scale(1.1);
      }
      
      .modal-close-btn:active {
        transform: scale(0.95);
      }
      
      .modal-close-btn svg {
        color: #666;
      }
      
      .modal-close-btn:hover svg {
        color: #000;
      }
      
      .logo-icon {
        filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
      }
      
      .logo-text {
        font-weight: bold;
        text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        margin-left: 8px;
      }
    </style>
  `;

  // Get DOM element references for event handling
  const rulesBtn = document.getElementById('rules-btn') as HTMLButtonElement;
  const modalOverlay = document.getElementById('rules-modal-overlay') as HTMLDivElement;
  const closeModalBtn = document.getElementById('close-modal-btn') as HTMLButtonElement;
  const userMenuTrigger = document.getElementById('user-profile-link') as HTMLDivElement;
  const userDropdown = document.getElementById('user-dropdown');
  const profileMenuItem = document.getElementById('profile-menu-item');
  const logoutMenuItem = document.getElementById('logout-menu-item');

  // Legacy event listeners (kept for backwards compatibility)
  rulesBtn?.addEventListener('click', () => modalOverlay?.classList.remove('hidden'));
  closeModalBtn?.addEventListener('click', () => modalOverlay?.classList.add('hidden'));

  // Modal control functions for consistent show/hide behavior
  const openModal = () => modalOverlay.style.display = 'flex';
  const closeModal = () => modalOverlay.style.display = 'none';

  // Event listeners for modal interactions
  rulesBtn.addEventListener('click', openModal);
  closeModalBtn.addEventListener('click', closeModal);

  // Close modal when clicking outside the modal content area
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  // Enhanced close button interaction - larger click area and better feedback
  closeModalBtn.addEventListener('mouseenter', () => {
    closeModalBtn.style.transform = 'scale(1.1)';
  });

  closeModalBtn.addEventListener('mouseleave', () => {
    closeModalBtn.style.transform = 'scale(1)';
  });

  // User dropdown menu event handlers
  userMenuTrigger?.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent event bubbling to avoid immediate closure
    userDropdown?.classList.toggle('hidden');
  });

  // Profile navigation handler
  profileMenuItem?.addEventListener('click', () => {
    navigate('/profile');
    userDropdown?.classList.add('hidden');
  });

  // Logout handler - disconnects websocket and clears user session
  logoutMenuItem?.addEventListener('click', () => {
    websocket.disconnect();
    logout();
    userDropdown?.classList.add('hidden');
  });

  // Global click handler to close dropdown when clicking outside
  window.addEventListener('click', () => {
    userDropdown?.classList.add('hidden');
  });
};