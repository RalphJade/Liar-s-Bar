import { getUser } from '../auth/auth.ts';
import { navigate } from '../router/router.ts';
import { renderHeader } from './components/Header.ts';

/**
 * Renders the user's profile page within the dark, atmospheric theme
 * of Liar's Bar. This page displays user information and provides
 * navigation back to the main game area.
 * @param {HTMLElement} element The root HTML element to render the page content into.
 */
export const renderProfilePage = (element: HTMLElement) => {
  const user = getUser();
  
  if (!user) {
    navigate('/'); // Redirect to login if user data is not available
    return;
  }

  element.innerHTML = `
    <div id="header-container"></div>
    <main class="page-container">
      <div class="card profile-card">
        <h1 class="profile-title">Player Profile</h1>
        <div class="profile-info">
          <p><strong>Handle:</strong> ${user.username}</p>
          <p><strong>Contact:</strong> ${user.email}</p>
          <p><strong>Status:</strong> <span style="color: var(--color-success);">Active Player</span></p>
        </div>
        <div class="profile-avatar-section">
          <p style="color: var(--color-text-medium); font-style: italic;">Choose your character avatar:</p>
          <div class="avatar-placeholder"></div>
          <p style="font-size: 0.9rem; color: var(--color-text-medium); margin-top: 0.5rem;">
            Character selection coming soon - Each avatar brings unique presence to the table
          </p>
        </div>
        <button id="back-home-btn" class="button button-primary">Return to the Bar</button>
      </div>
    </main>
  `;

  // Render the header component
  const headerContainer = document.getElementById('header-container') as HTMLElement;
  renderHeader(headerContainer);

  // Add navigation back to the main game area
  document.getElementById('back-home-btn')?.addEventListener('click', () => {
    navigate('/home');
  });
};
