import api from '../../api/api.ts';

/**
 * Renders the registration form and attaches its event listeners.
 * This component handles new user registration.
 * @param element The container element where the form will be rendered.
 */
export const renderRegisterForm = (element: HTMLElement) => {
  // Set the static HTML content for the registration form.
  element.innerHTML = `
    <form id="register-form" novalidate>
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
    const data = Object.fromEntries(formData);

    // Perform client-side validation for password matching.
    if (data.password !== data.confirmPassword) {
      feedbackDiv.innerHTML = '<div class="form-feedback error">Passwords do not match.</div>';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Register';
      return;
    }

    try {
      // Send registration data to the backend.
      await api.post('/auth/register', data);
      feedbackDiv.innerHTML = '<div class="form-feedback success">Account created! You can now log in.</div>';
      form.reset(); // Clear form fields on success.
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
        errorMessage += errorData?.message || 'Registration failed.';
      }
      
      errorMessage += '</div>';
      feedbackDiv.innerHTML = errorMessage;
    } finally {
      // Re-enable the submit button in both success and error cases.
      submitBtn.disabled = false;
      submitBtn.textContent = 'Register';
    }
  });
};