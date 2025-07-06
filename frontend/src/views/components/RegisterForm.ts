import api from '../../api/api.ts';

/**
 * Renders the registration form and attaches its event listeners.
 * This component handles new user registration.
 * @param element The container element where the form will be rendered.
 */
export const renderRegisterForm = (element: HTMLElement) => {
  // Set the static HTML content for the registration form.
  element.innerHTML = `
    <form id="register-form">
      <h2 class="form-title">Create a New Account</h2>
      <div id="register-feedback"></div>
      <div class="form-group">
        <label for="reg-username" class="form-label">Username</label>
        <input id="reg-username" name="username" type="text" required class="form-input" />
      </div>
      <div class="form-group">
        <label for="reg-email" class="form-label">Email</label>
        <input id="reg-email" name="email" type="email" required class="form-input" />
      </div>
      <div class="form-group">
        <label for="reg-password" class="form-label">Password</label>
        <input id="reg-password" name="password" type="password" required class="form-input" />
      </div>
      <div class="form-group">
        <label for="reg-confirmPassword" class="form-label">Confirm Password</label>
        <input id="reg-confirmPassword" name="confirmPassword" type="password" required class="form-input" />
      </div>
      <button type="submit" id="reg-submit-btn" class="button button-primary">Register</button>
    </form>
  `;

  // Get the form element to attach the submit event listener.
  const form = document.getElementById('register-form') as HTMLFormElement;
  form.addEventListener('submit', async (e) => {
    e.preventDefault(); // Prevent default page reload.

    // Get references to interactive elements.
    const submitBtn = form.querySelector('button')!;
    const feedbackDiv = document.getElementById('register-feedback')!;

    // Reset UI state for a new submission.
    feedbackDiv.innerHTML = '';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Registering...';

    const formData = new FormData(form);
    const password = formData.get('password');
    const confirmPassword = formData.get('confirmPassword');

    // Perform client-side validation for password matching.
    if (password !== confirmPassword) {
      feedbackDiv.innerHTML = '<div class="form-feedback error">Passwords do not match.</div>';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Register';
      return;
    }

    try {
      // Send registration data to the backend. `Object.fromEntries` converts FormData to a plain object.
      await api.post('/auth/register', Object.fromEntries(formData));
      feedbackDiv.innerHTML = '<div class="form-feedback success">Account created! You can now log in.</div>';
      form.reset(); // Clear form fields on success.
    } catch (err: any) {
      // On failure, display an error message from the API or a generic one.
      feedbackDiv.innerHTML = `<div class="form-feedback error">${err.response?.data?.message || 'Registration failed.'}</div>`;
    } finally {
      // Re-enable the submit button in both success and error cases.
      submitBtn.disabled = false;
      submitBtn.textContent = 'Register';
    }
  });
};