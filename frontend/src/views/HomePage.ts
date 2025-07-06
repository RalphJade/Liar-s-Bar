import { getUser, logout } from '../auth/auth.ts';
import { renderHeader } from './components/Header.ts';
import { navigate } from '../router/router.ts';

/**
 * Renders the protected home page for an authenticated user.
 * This page acts as a lobby or entry point to the game.
 * @param element The root HTML element to render the page content into.
 */
export const renderHomePage = (element: HTMLElement) => {
  const user = getUser();

  if (!user) {
    element.innerHTML = `<p>Error: User not found.</p>`;
    return;
  }
  
  // Structure the page with header and main content area
  element.innerHTML = `
    <div id="header-container"></div>
    <main class="page-container">
      <div class="card homepage-card">
        <h1 class="homepage-title">Welcome to the Bar</h1>
        <p class="homepage-text">
          The cards are dealt, the revolvers are loaded... Are you ready to test your luck and cunning, <span class="username">${user.username}</span>?
        </p>
        
        <!-- Add Join Game button -->
        <button id="join-game-btn" class="button button-primary" style="margin-top: 2rem; background: var(--color-success); border-color: #1b2d1b;">Join a Table</button>

        <p class="homepage-text" style="margin-top: 1.5rem; font-size: 1rem; color: var(--color-text-medium); font-style: italic;">
          In this establishment, every hand could be your last. Choose your lies carefully, trust no one, and may fortune favor the bold.
        </p>
        <button id="logout-btn" class="button button-danger homepage-logout-button">Leave the Table</button>
      </div>
    </main>
  `;

  // Render the header component into its dedicated container
  const headerContainer = document.getElementById('header-container') as HTMLElement;
  renderHeader(headerContainer);

  // Attach click listener to the new join game button
  document.getElementById('join-game-btn')?.addEventListener('click', () => {
    navigate('/gameboard');
  });

  // Attach click event listener to the logout button
  document.getElementById('logout-btn')?.addEventListener('click', () => logout());
};