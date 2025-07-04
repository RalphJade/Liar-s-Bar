import api from '../../api/api.ts';
import { login } from '../../auth/auth.ts';

/**
 * Renders the login form and attaches its event listeners.
 * This component is responsible for handling user login.
 * @param element The container element where the form will be rendered.
 */
export const renderLoginForm = (element: HTMLElement) => {
  // Set the static HTML content for the login form.
  element.innerHTML = `
    <form id="login-form">
      <h2 class="form-title">Access Your Account</h2>
      <div id="login-feedback"></div>
      <div class="form-group">
        <label for="login-email" class="form-label">Email</label>
        <input id="login-email" name="email" type="email" required class="form-input" />
      </div>
      <div class="form-group">
        <label for="login-password" class="form-label">Password</label>
        <input id="login-password" name="password" type="password" required class="form-input" />
      </div>
      <button type="submit" id="login-submit-btn" class="button button-primary">Login</button>
    </form>
  `;

  // Get the form element to attach the submit event listener.
  const form = document.getElementById('login-form') as HTMLFormElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent default page reload on form submission.

    // Get references to interactive elements.
    const submitBtn = form.querySelector('button')!;
    const feedbackDiv = document.getElementById('login-feedback')!;
    
    // Reset UI state for a new submission.
    feedbackDiv.innerHTML = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Logging in...';

    const formData = new FormData(form);
    try {
      // Send login credentials to the backend API.
      const response = await api.post('/auth/login', {
        email: formData.get('email'),
        password: formData.get('password'),
      });
      // On success, update the global auth state and trigger navigation.
      login(response.data.data.user);
    } catch (err: any) {
      // On failure, display an error message and re-enable the form.
      feedbackDiv.innerHTML = `<div class="form-feedback error">${err.response?.data?.message || 'Login failed.'}</div>`;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Login';
    }
  });
};