import api from '../api/api.ts';
import { getUser, updateUser } from '../auth/auth.ts';
import { navigate } from '../router/router.ts';
import { renderHeader } from './components/Header.ts';

/**
 * Renders the user's profile page, now with stats and avatar upload functionality.
 * @param {HTMLElement} element The root HTML element to render the page content into.
 */
export const renderProfilePage = (element: HTMLElement) => {
  const user = getUser();

  if (!user) {
    navigate('/');
    return;
  }

  // Calculate win rate, avoiding division by zero

  const winRate = user.matches_played > 0 ? ((user.wins / user.matches_played) * 100).toFixed(1) : 0;

  const avatarDisplay = user.avatar_url
    ? `<img src="${user.avatar_url}" alt="Your avatar" class="avatar-placeholder" style="border-style: solid; padding: 0; object-fit: cover; cursor: pointer;" />`
    : `<div class="avatar-placeholder" style="cursor: pointer;"></div>`;

  // HTML simplificado, classes são controladas pelo main.css
  element.innerHTML = `
    <div id="header-container"></div>
    <main class="page-container">
      <div class="card profile-card">
        <h1 class="profile-title">Player Dossier</h1>
        
        <div id="profile-feedback-container"></div>
        
        <div class="profile-content">
            <div class="profile-avatar-section" id="avatar-container">
                <input type="file" id="avatar-input" accept="image/png, image/jpeg" style="display: none;" />
                ${avatarDisplay}
                <p class="avatar-caption">Click image to change (PNG/JPG).</p>
            </div>

            <div class="data-box">
                <h3 class="data-box-title">Player Info</h3>
                <p><strong>Handle:</strong> ${user.username}</p>
                <p><strong>Contact:</strong> ${user.email}</p>
            </div>

            <div class="data-box">
                <h3 class="data-box-title">Combat Record</h3>
                <p><strong>Matches Played:</strong> ${user.matches_played}</p>
                <p><strong>Wins:</strong> ${user.wins}</p>
                <p><strong>Win Rate:</strong> ${winRate}%</p>
            </div>
        </div>

        <button id="back-home-btn" class="button button-primary profile-back-btn">Return to the Bar</button>
      </div>
    </main>
  `;

  // Render the header component
  const headerContainer = document.getElementById('header-container') as HTMLElement;
  renderHeader(headerContainer);
<<<<<<< HEAD
  
  // Event Listeners
=======

  // --- Event Listeners for Avatar Upload ---
>>>>>>> main
  const avatarContainer = document.getElementById('avatar-container')!;
  const avatarInput = document.getElementById('avatar-input') as HTMLInputElement;
  const feedbackContainer = document.getElementById('profile-feedback-container')!;

  avatarContainer.addEventListener('click', () => {
    avatarInput.click();
  });

  avatarInput.addEventListener('change', async () => {
    const file = avatarInput.files?.[0];
    if (!file) return;

    feedbackContainer.innerHTML = `<div class="form-feedback" style="background-color: #1b2d2a; color: #a6d1c9; border-color: #3ca994;">Uploading...</div>`;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const response = await api.patch('/users/me/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
<<<<<<< HEAD
      
      updateUser(response.data.data.user);
      renderProfilePage(element);
      
=======

      // Update local state and re-render the entire page to show changes.
      updateUser(response.data.data.user);
      renderProfilePage(element); // Re-render to show new avatar and clear feedback

>>>>>>> main
    } catch (err: any) {
      const message = err.response?.data?.message || 'Upload failed. Please try again.';
      feedbackContainer.innerHTML = `<div class="form-feedback error">${message}</div>`;
    }
  });

  document.getElementById('back-home-btn')?.addEventListener('click', () => {
    navigate('/home');
  });
};