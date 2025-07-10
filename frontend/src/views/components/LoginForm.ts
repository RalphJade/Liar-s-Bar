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
      <div class="form-actions">
        <button type="submit" id="login-submit-btn" class="button button-primary">Login</button>
      </div>
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
    const data = Object.fromEntries(formData);
    try {
      // Send login credentials to the backend API.
      const response = await api.post('/auth/login', data);
      // On success, update the global auth state and trigger navigation.
      login(response.data.data.user);
    } catch (err: any) {
      // On failure, display an error message from the API or a generic one.
      const errorData = err.response?.data;
      let errorMessage = '<div class="form-feedback error">';

      // Handle Zod validation errors, which come as an array
      if (errorData && Array.isArray(errorData.message)) {
        errorMessage += '<ul>';
        errorData.message.forEach((zodError: { message: string }) => {
          errorMessage += `<li>${zodError.message}</li>`;
        });
        errorMessage += '</ul>';
      } else {
        // Handle other string-based errors
        errorMessage += errorData?.message || 'Login failed.';
      }

      errorMessage += '</div>';
      feedbackDiv.innerHTML = errorMessage;
      
      submitBtn.disabled = false;
      submitBtn.textContent = 'Login';
    }
  });
};