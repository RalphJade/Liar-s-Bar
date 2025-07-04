import { getUser, logout } from '../auth/auth.ts';

/**
 * Renders the protected home page for an authenticated user.
 * It displays a welcome message and provides a logout functionality.
 * @param element The root HTML element to render the page content into.
 */
export const renderHomePage = (element: HTMLElement) => {
  // Retrieve the current user's data from the global auth state.
  const user = getUser();

  // A guard clause to prevent rendering if the user data is somehow not available.
  if (!user) {
    element.innerHTML = `<p>Error: User not found.</p>`;
    return;
  }

  // Set the static HTML content for the home page.
  element.innerHTML = `
    <div class="page-container">
      <div class="card homepage-card">
        <h1 class="homepage-title">Login Successful!</h1>
        <p class="homepage-text">
          Your username is <span class="username">${user.username}</span>.
        </p>
        <button id="logout-btn" class="button button-danger homepage-logout-button">Logout</button>
      </div>
    </div>
  `;

  // Attach a click event listener to the logout button after the HTML has been rendered.
  document.getElementById('logout-btn')?.addEventListener('click', () => logout());
};