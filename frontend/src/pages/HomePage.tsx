import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const HomePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md w-full">
        <h1 className="text-4xl font-bold text-green-600">Login funcionou!</h1>
        {user && (
          <p className="mt-4 text-xl text-gray-800">
            Seu nome de usuário é <span className="font-semibold text-indigo-600">{user.username}</span>.
          </p>
        )}
        <button
          onClick={handleLogout}
          className="mt-8 w-full py-3 px-4 bg-red-600 text-white font-bold rounded-lg shadow-md hover:bg-red-700 transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
        >
          Logout
        </button>
      </div>
    </div>
  );
};

export default HomePage;