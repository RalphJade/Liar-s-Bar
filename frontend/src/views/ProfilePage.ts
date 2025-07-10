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
    : `<img src="/default-avatar.jpg" alt="Default avatar" class="avatar-placeholder" style="border-style: solid; padding: 0; object-fit: cover; cursor: pointer;" />`;

  element.innerHTML = `
    <div id="header-container"></div>
    <main class="page-container">
      <div class="card profile-card" style="max-width: 800px;">
        <h1 class="profile-title">Player Dossier</h1>
        
        <div id="profile-feedback-container"></div>
        
        <div class="profile-content-grid">
            <!-- Left Column: Avatar Only -->
            <div class="profile-left-column">
                <!-- Hidden input for file selection -->
                <input type="file" id="avatar-input" accept="image/png, image/jpeg" style="display: none;" />
                <div class="profile-avatar-section" id="avatar-container">
                  ${avatarDisplay}
                  <p class="avatar-caption">
                    Click image to change (PNG/JPG).
                  </p>
                </div>
            </div>

            <!-- Right Column: All Player Data -->
            <div class="profile-right-column">
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
        </div>

        <button id="back-home-btn" class="button button-primary profile-back-btn">Return to the Bar</button>
      </div>
    </main>
  `;

  // --- CSS for the profile layout ---
  const style = document.createElement('style');
  style.textContent = `
    #profile-page-container.page-container {
        overflow-y: auto;
        padding-top: 1rem;
        padding-bottom: 1rem;
    }

    .profile-card {
      /* The button will now align to the card's flex properties */
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1.5rem;
      max-width: 800px;
    }
    .profile-content-grid {
      display: flex;
      gap: 2rem;
      margin-top: 1rem;
      margin-bottom: 1.5rem;
      align-items: center; /* Vertically align avatar and data boxes */
      width: 100%;
    }
    .profile-title {
        margin-bottom: 1rem;
    }
    .profile-left-column {
      flex: 0 0 160px; /* Give avatar column a fixed width, don't let it grow/shrink */
      text-align: center;
    }
    .avatar-placeholder {
      width: 150px;
      height: 150px;
    }
    .avatar-caption {
      font-size: 0.9rem; 
      color: var(--color-text-medium); 
      margin-top: 0.5rem;
    }
    .profile-right-column {
      flex: 1; /* Allow this column to take up the remaining space */
      display: flex;
      flex-direction: column;
      gap: 1rem; /* Space between the two data boxes */
    }
    .data-box {
      text-align: left;
      border: 1px solid var(--color-border);
      padding: 1rem;
      border-radius: var(--border-radius);
      background-color: rgba(0,0,0,0.2);
    }
    .data-box-title {
      font-family: var(--font-display);
      font-size: 1.25rem;
      color: var(--color-accent-gold);
      margin-top: 0;
      margin-bottom: 1rem;
      border-bottom: 1px solid var(--color-wood-light);
      padding-bottom: 0.5rem;
    }
    .data-box p {
      margin-bottom: 0.5rem;
      font-size: 1rem;
    }
    .profile-back-btn {
      width: 100%;
      max-width: 250px;
      margin-top: 0;
    }
    @media (max-width: 768px) {
        .profile-content-grid {
            flex-direction: column;
            align-items: center;
        }
        .profile-left-column, .profile-right-column {
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