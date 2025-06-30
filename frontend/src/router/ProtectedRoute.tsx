import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute: React.FC = () => {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Carregando...</div>;
  }
  return user ? <Outlet /> : <Navigate to="/" replace />;
};
export default ProtectedRoute;