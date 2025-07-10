import { renderLoginForm } from './components/LoginForm.ts';
import { renderRegisterForm } from './components/RegisterForm.ts';

/**
 * Renders the main authentication page, which serves as a container
 * for the login and registration forms.
 * @param element The root HTML element to render the page content into.
 */
export const renderAuthPage = (element: HTMLElement) => {
  // Define the static HTML structure for the page, including the tab navigation.
  element.innerHTML = `
    <div class="page-container">
      <div class="text-center" style="margin-bottom: 2rem;">
        <h1 class="homepage-title">Liar's Bar</h1>
        <p style="color: var(--color-text-medium); margin-top: 0.5rem; font-family: var(--font-body);">
            Welcome! Please log in or create an account to enter the bar.
        </p>
      </div>
      <div class="card">
        <div class="tab-container">
          <button id="login-tab-btn" class="tab-button active" data-tab="login">Login</button>
          <button id="register-tab-btn" class="tab-button" data-tab="register">Register</button>
        </div>
        <div id="auth-form-container" class="card-content">
          <!-- The active form component will be rendered here -->
        </div>
      </div>
    </div>
  `;

  // Get references to the DOM elements to manage tab interactivity.
  const loginTabBtn = document.getElementById('login-tab-btn')!;
  const registerTabBtn = document.getElementById('register-tab-btn')!;
  const formContainer = document.getElementById('auth-form-container')!;

  /**
   * Handles the logic for switching between the login and register forms.
   * @param tab The tab to activate ('login' or 'register').
   */
  const switchTab = (tab: 'login' | 'register') => {
    if (tab === 'login') {
      // Update button styles and render the login form.
      loginTabBtn.classList.add('active');
      registerTabBtn.classList.remove('active');
      renderLoginForm(formContainer);
    } else {
      // Update button styles and render the register form.
      registerTabBtn.classList.add('active');
      loginTabBtn.classList.remove('active');
      renderRegisterForm(formContainer);
    }
  };

  // Attach event listeners to the tab buttons to trigger the switch.
  loginTabBtn.addEventListener('click', () => switchTab('login'));
  registerTabBtn.addEventListener('click', () => switchTab('register'));

  // Render the login form by default when the page first loads.
  renderLoginForm(formContainer);
};