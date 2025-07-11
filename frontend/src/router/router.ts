import { renderAuthPage } from '../views/AuthPage.ts';
import { renderLobbyPage } from '../views/LobbyPage.ts';
// import { renderHomePage } from '../views/HomePage.ts';
import { renderProfilePage } from '../views/ProfilePage.ts'; // Import the new page
// import { renderHomePage } from '../views/HomePage.ts';

import { renderGameBoardPage } from '../views/GameBoardPage.ts'; // Import the game board page

import { isLoggedIn, isLoading as isAuthLoading } from '../auth/auth.ts';

/**
 * Defines the application's routing table.
 * This object maps URL paths to their corresponding view, and specifies
 * whether a route requires authentication to be accessed.
 */
const routes = {
  '/': { view: renderAuthPage, protected: false },
  '/home': { view: renderLobbyPage, protected: true },
  '/profile': { view: renderProfilePage, protected: true }, // Add the new profile route
  '/gameboard': { view: renderGameBoardPage, protected: true }, // Add the new game route

};

// A utility type to ensure that only valid route paths are used throughout the router.
type RoutePath = keyof typeof routes;

// The main DOM element where all page content will be mounted.
const appDiv = document.getElementById('app') as HTMLDivElement;

/**
 * Programmatically navigates to a new path using the History API.
 * This updates the browser's URL without a full page reload, enabling SPA behavior.
 * @param path The internal path to navigate to (e.g., '/home').
 */
export const navigate = (path: string) => {
  // Update the URL in the browser's address bar.
  window.history.pushState({}, '', path);
  // Manually call the location handler to render the new view.
  handleLocation();
};

/**
 * The core routing logic. It reads the current URL and renders the appropriate view.
 * This function is called on initial load and every time the URL changes.
 */
const handleLocation = () => {
  const path = window.location.pathname;

  const gameboardMatch = path.match(/^\/gameboard\/([A-Z0-9]+)$/);
  if (gameboardMatch) {
    const roomCode = gameboardMatch[1];
    
    if (isAuthLoading()) {
      appDiv.innerHTML = '<div class="page-container"><h1>Loading...</h1></div>';
      return;
    }
    
    if (!isLoggedIn()) {
      navigate('/');
      return;
    }
    
    // Chama renderGameBoardPage com roomCode
    appDiv.style.overflowY = 'hidden'; 
    renderGameBoardPage(appDiv, roomCode);
    return;
  }

  // Fallback to the root route if the current path is not found in the routing table.
  const route = routes[path as RoutePath] || routes['/'];

  // Display a loading indicator while the initial authentication check is running.
  if (isAuthLoading()) {
    appDiv.innerHTML = '<div class="page-container"><h1>Loading...</h1></div>';
    return;
  }

  // Controls the scroll behavior of the main application container
  if (path === '/') {
    // For the AuthPage (landing page), we want scrolling on the entire page
    appDiv.style.overflowY = 'auto';
  } else {
    // For all other pages (Lobby, Profile, etc.), scrolling is internal
    appDiv.style.overflowY = 'hidden';
  }

  // --- Authentication Guards ---

  // If the route is protected and the user is not logged in, redirect to the auth page.
  if (route.protected && !isLoggedIn()) {
    navigate('/');
    return;
  }

  // If a logged-in user tries to access the public auth page, redirect them to the home page.
  if (path === '/' && isLoggedIn()) {
    navigate('/home');
    return;
  }

  // If all checks pass, render the view associated with the current route.
  route.view(appDiv);
};

/**
 * Initializes the router by setting up global event listeners.
 * This should be called once when the application starts.
 */
export const initializeRouter = () => {
  /**
   * Use event delegation to capture clicks on any element with a `data-link` attribute.
   * This is an efficient way to handle all in-app navigation without attaching
   * listeners to every single link.
   */
  window.addEventListener('click', e => {
    const target = e.target as HTMLElement;
    if (target.matches('[data-link]')) {
      e.preventDefault(); // Prevent the browser's default page reload behavior.
      const href = target.getAttribute('href') as RoutePath;
      if (href) {
        navigate(href);
      }
    }
  });

  // Listen for the 'popstate' event to handle browser back/forward button clicks.
  window.addEventListener('popstate', handleLocation);
  
  // Handle the initial page load by resolving the URL that the user landed on.
  handleLocation();
};