import React from 'react';
import AuthTabs from '../components/AuthTabs';

const AuthPage: React.FC = () => {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Nome da Aplicação</h1>
        <p className="text-gray-600 mt-2">Bem-vindo! Faça login ou crie sua conta.</p>
      </div>
      <AuthTabs />
    </main>
  );
};

export default AuthPage;