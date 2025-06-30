import React from 'react';
import AppRouter from './router/AppRouter';
import { AuthProvider } from './context/AuthContext';

/**
 * The root component of the application.
 * It wraps the entire application with the AuthProvider so that all components
 * can access the authentication state.
 */
const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}

export default App;