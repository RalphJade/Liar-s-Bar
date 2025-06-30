import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import api from '../api/api';

// Defines the data structure for a user.
interface User {
  id: string;
  username: string;
  email: string;
}

// Defines the structure of the data and functions the context will provide.
interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (userData: User) => void;
  logout: () => Promise<void>;
}

// Creates the React Context with an initial undefined value.
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * The AuthProvider is a component that wraps parts of the app that need access to
 * authentication state. It manages user data, loading states, and provides
* functions to log in and log out.
 */
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // This effect runs once when the app loads to check if there's an active session.
  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        // The browser automatically sends the httpOnly cookie. If the session is
        // valid, this endpoint will return the user's data.
        const response = await api.get('/users/me');
        setUser(response.data.data.user);
      } catch (error) {
        // A 401 or other error means no valid session, so the user is null.
        setUser(null);
      } finally {
        // The check is complete, so we stop the loading state.
        setIsLoading(false);
      }
    };
    checkUserStatus();
  }, []);
  
  // A function to set the user state after a successful login.
  const login = (userData: User) => {
    setUser(userData);
  };
  
  // A function to handle user logout.
  const logout = async () => {
    try {
      // Tell the backend to clear the session cookie.
      await api.post('/auth/logout');
      // Clear the user state on the client.
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * A custom hook for easy access to the AuthContext.
 * This is a best practice to avoid importing useContext and AuthContext everywhere.
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};