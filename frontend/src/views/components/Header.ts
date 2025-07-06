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
  const user = getUser();
  if (!user) return; // Do not render the header if the user is not logged in.

  // Dynamically create the avatar element based on whether an avatar_url exists
  const avatarElement = user.avatar_url
    ? `<img src="http://localhost:3001${user.avatar_url}" alt="${user.username}'s avatar" class="avatar-icon" style="width: 28px; height: 28px; object-fit: cover; padding: 0;"/>`
    : `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="avatar-icon">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
        <circle cx="12" cy="7" r="4"></circle>
      </svg>`;

  element.innerHTML = `
    <header class="app-header">
      <div class="header-left">
        <div class="logo">
          <!-- SVG Icon representing playing cards and danger, fitting the dark atmosphere -->
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="currentColor" class="logo-icon">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            <path d="M15.5 4L14.5 9.5H9.5L8.5 4H15.5M17 2H7L8.5 9.5H2.5L4 14.5H20L21.5 9.5H15.5L17 2Z" opacity="0.7"/>
          </svg>
          <span class="logo-text">Liar's Bar</span>
        </div>
      </div>
      <div class="header-center">
        <button id="rules-btn" class="button-rules">Game Rules</button>
      </div>
      <div class="header-right">
        <div id="user-profile-link" class="user-info">
          ${avatarElement}
          <span class="username">${user.username}</span>
        </div>
        <div id="user-dropdown" class="user-dropdown-menu hidden">
          <ul>
            <li id="profile-menu-item">My Profile</li>
            <li id="logout-menu-item">Leave</li>
          </ul>
        </div>
      </div>
    </header>

    <div id="rules-modal-overlay" class="modal-overlay hidden">
      <div class="modal-content">
        <button id="close-modal-btn" class="modal-close-btn">×</button>
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
  `;

  const rulesBtn = document.getElementById('rules-btn') as HTMLButtonElement;
  const modalOverlay = document.getElementById('rules-modal-overlay') as HTMLDivElement;
  const closeModalBtn = document.getElementById('close-modal-btn') as HTMLButtonElement;
  const userMenuTrigger = document.getElementById('user-menu-trigger');
  const userDropdown = document.getElementById('user-dropdown');
  const profileMenuItem = document.getElementById('profile-menu-item');
  const logoutMenuItem = document.getElementById('logout-menu-item');

  rulesBtn?.addEventListener('click', () => modalOverlay?.classList.remove('hidden'));
  closeModalBtn?.addEventListener('click', () => modalOverlay?.classList.add('hidden'));
  
  const openModal = () => modalOverlay.style.display = 'flex';
  const closeModal = () => modalOverlay.style.display = 'none';

  rulesBtn.addEventListener('click', openModal);
  closeModalBtn.addEventListener('click', closeModal);
  
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  userMenuTrigger?.addEventListener('click', (e) => {
    e.stopPropagation();
    userDropdown?.classList.toggle('hidden');
  });

  profileMenuItem?.addEventListener('click', () => {
    navigate('/profile');
    userDropdown?.classList.add('hidden');
  });

  logoutMenuItem?.addEventListener('click', () => {
    websocket.disconnect();
    logout();
    userDropdown?.classList.add('hidden');
  });

  window.addEventListener('click', () => {
    userDropdown?.classList.add('hidden');
  });
};