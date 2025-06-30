import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';

/**
 * Renders a form for user login. It handles form state, submission,
 * API calls, and provides feedback to the user (errors, loading states).
 */
const LoginForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      
      // On success, update the global auth state with user data from the response.
      login(response.data.data.user);
      
      // Navigate to the protected home page.
      navigate('/home');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Falha no login. Verifique suas credenciais.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <h2 className="text-2xl font-bold text-center text-gray-800">Acessar sua Conta</h2>
      
      {error && <div className="text-center text-red-600 p-3 bg-red-100 rounded-md">{error}</div>}

      <div>
        <label htmlFor="login-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          id="login-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <div>
        <label htmlFor="login-password" className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
        <input
          id="login-password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-bold transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Entrando...' : 'Login'}
      </button>
    </form>
  );
};

export default LoginForm;