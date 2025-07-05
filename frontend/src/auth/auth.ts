import api from '../api/api.ts';
import { navigate } from '../router/router.ts';

//Defines the shape of the user object
interface User {
  id: string;
  username: string;
  email: string;
}

//A simple, module-scoped object to act as our global state store
let state: {
  user: User | null;
  isLoading: boolean;
} = {
  user: null,
  isLoading: true,
};

//Checks if the user is logged in by making an API request to the backend
export const checkUserStatus = async () => {
  state.isLoading = true;
  try {
    const response = await api.get('/users/me');
    state.user = response.data.data.user;
  } catch (error) {
    state.user = null;
  } finally {
    state.isLoading = false;
  }
};

/**
 * Updates the global state upon successful login and navigates to the home page
 * @param userData - The user data received from the backend
 */
export const login = (userData: User) => {
  state.user = userData;
  navigate('/home');
};

// Logs the user out by notifying the backend to clear the auth cookie and resetting the local state
export const logout = async () => {
  try {
    await api.post('/auth/logout');
  } catch (error) {
    console.error("Logout request failed:", error);
  } finally {
    state.user = null;
    navigate('/');
  }
};

/**
 * @returns The current user object or null if not authenticated.
 */
export const getUser = (): User | null => state.user;

/**
 * @returns True if a user is currently authenticated, otherwise false.
 */
export const isLoggedIn = (): boolean => !!state.user;

/**
 * @returns True if the initial authentication check is still in progress.
 */
export const isLoading = (): boolean => state.isLoading;
