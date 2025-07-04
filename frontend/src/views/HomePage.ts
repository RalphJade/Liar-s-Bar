import { getUser, logout } from '../auth/auth.ts';
import { renderHeader } from './components/Header.ts';

/**
 * Renders the protected home page for an authenticated user.
 * This page displays a dark, atmospheric welcome message that reflects
 * the dangerous and mysterious nature of Liar's Bar, where players
 * engage in high-stakes card games with deadly consequences.
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

  // Attach click event listener to the logout button
  document.getElementById('logout-btn')?.addEventListener('click', () => logout());
};
