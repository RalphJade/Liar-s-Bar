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
    navigate('/'); // Redirect to login if user data is not available
    return;
  }
  
  // Calculate win rate, avoiding division by zero
  const winRate = user.matches_played > 0 ? ((user.wins / user.matches_played) * 100).toFixed(1) : 0;

  // Dynamically render the avatar or a placeholder
  const avatarDisplay = user.avatar_url
    ? `<img src="http://localhost:3001${user.avatar_url}" alt="Your avatar" class="avatar-placeholder" style="border-style: solid; padding: 0; object-fit: cover; cursor: pointer;" />`
    : `<div class="avatar-placeholder" style="cursor: pointer;"></div>`;

  element.innerHTML = `
    <div id="header-container"></div>
    <main class="page-container">
      <div class="card profile-card" style="max-width: 800px;">
        <h1 class="profile-title">Player Dossier</h1>
        
        <div id="profile-feedback-container"></div>
        
        <div class="profile-content-grid">
            <!-- Left Column: Avatar and Info -->
            <div class="profile-left-column">
                <!-- Hidden input for file selection -->
                <input type="file" id="avatar-input" accept="image/png, image/jpeg" style="display: none;" />
                <div class="profile-avatar-section" id="avatar-container">
                  ${avatarDisplay}
                  <p style="font-size: 0.9rem; color: var(--color-text-medium); margin-top: 0.5rem;">
                    Click on the image to change your avatar (PNG or JPG).
                  </p>
                </div>
                <div class="profile-info">
                  <p><strong>Handle:</strong> ${user.username}</p>
                  <p><strong>Contact:</strong> ${user.email}</p>
                </div>
            </div>

            <!-- Right Column: Stats -->
            <div class="profile-right-column">
                <div class="stats-grid">
                    <h3>Combat Record</h3>
                    <p><strong>Matches Played:</strong> ${user.matches_played}</p>
                    <p><strong>Wins:</strong> ${user.wins}</p>
                    <p><strong>Win Rate:</strong> ${winRate}%</p>
                </div>
            </div>
        </div>

        <button id="back-home-btn" class="button button-primary" style="margin: 2rem auto 0; display: block;">Return to the Bar</button>
      </div>
    </main>
  `;

  // --- Add new CSS for the profile layout ---
  const style = document.createElement('style');
  style.textContent = `
    .profile-content-grid {
      display: flex;
      gap: 2rem;
      margin-top: 2rem;
      align-items: flex-start;
    }
    .profile-left-column {
      flex: 1;
      text-align: center;
    }
    .profile-right-column {
      flex: 2;
    }
    .stats-grid {
      text-align: left;
      border: 1px solid var(--color-border);
      padding: 1.5rem;
      border-radius: var(--border-radius);
      background-color: rgba(0,0,0,0.2);
    }
    .stats-grid h3 {
      font-family: var(--font-display);
      font-size: var(--font-size-lg);
      color: var(--color-accent-gold);
      margin-top: 0;
      margin-bottom: 1rem;
      border-bottom: 1px solid var(--color-wood-light);
      padding-bottom: 0.5rem;
    }
    .stats-grid p {
      margin-bottom: 0.5rem;
      font-size: var(--font-size-base);
    }
    @media (max-width: 768px) {
        .profile-content-grid {
            flex-direction: column;
        }
        .profile-right-column {
            width: 100%;
        }
    }
  `;
  element.appendChild(style);

  // Render the header component
  const headerContainer = document.getElementById('header-container') as HTMLElement;
  renderHeader(headerContainer);
  
  // --- Event Listeners for Avatar Upload ---
  const avatarContainer = document.getElementById('avatar-container')!;
  const avatarInput = document.getElementById('avatar-input') as HTMLInputElement;
  const feedbackContainer = document.getElementById('profile-feedback-container')!;

  // When the avatar display is clicked, trigger the hidden file input.
  avatarContainer.addEventListener('click', () => {
    avatarInput.click();
  });

  // When a file is selected in the input...
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
      
      // Update local state and re-render the entire page to show changes.
      updateUser(response.data.data.user);
      renderProfilePage(element); // Re-render to show new avatar and clear feedback
      
    } catch (err: any) {
      const message = err.response?.data?.message || 'Upload failed. Please try again.';
      feedbackContainer.innerHTML = `<div class="form-feedback error">${message}</div>`;
    }
  });

  // Add navigation back to the main game area
  document.getElementById('back-home-btn')?.addEventListener('click', () => {
    navigate('/home');
  });
};