import React, { useState } from 'react';
import api from '../api/api';

/**
 * Renders a form for new user registration. It includes validation for password
 * matching and provides clear feedback to the user on success or failure.
 */
const RegisterForm: React.FC = () => {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Reset feedback states on new submission
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    // Client-side validation for password confirmation
    if (formData.password !== formData.confirmPassword) {
      setError('As senhas não coincidem.');
      setIsLoading(false);
      return;
    }

    try {
      await api.post('/auth/register', {
        username: formData.username,
        email: formData.email,
        password: formData.password,
      });
      setSuccess('Conta criada com sucesso! Você já pode fazer login na outra aba.');
      // Clear the form on successful registration
      setFormData({ username: '', email: '', password: '', confirmPassword: '' });
    } catch (err: any) {
      setError(err.response?.data?.message || 'Ocorreu um erro ao criar a conta.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-2xl font-bold text-center text-gray-800">Criar Nova Conta</h2>
      
      {error && <div className="text-center text-red-600 p-3 bg-red-100 rounded-md">{error}</div>}
      {success && <div className="text-center text-green-600 p-3 bg-green-100 rounded-md">{success}</div>}

      <div>
        <label htmlFor="reg-username" className="block text-sm font-medium text-gray-700 mb-1">Nome de Usuário</label>
        <input id="reg-username" name="username" type="text" value={formData.username} onChange={handleChange} required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      
      <div>
        <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input id="reg-email" name="email" type="email" value={formData.email} onChange={handleChange} required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <div>
        <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
        <input id="reg-password" name="password" type="password" value={formData.password} onChange={handleChange} required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>
      
      <div>
        <label htmlFor="reg-confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirmar Senha</label>
        <input id="reg-confirmPassword" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} required className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-bold transition-colors disabled:bg-indigo-400 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Registrando...' : 'Registrar'}
      </button>
    </form>
  );
};

export default RegisterForm;