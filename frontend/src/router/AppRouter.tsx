import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import AuthPage from '../pages/AuthPage';
import HomePage from '../pages/HomePage';
import ProtectedRoute from './ProtectedRoute';

const AppRouter: React.FC = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<AuthPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/home" element={<HomePage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);

export default AppRouter;