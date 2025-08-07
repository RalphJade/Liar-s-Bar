import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.DEV
    ? 'http://localhost:3001/api'
    : 'https://liar-s-bar-zylt.onrender.com/api', // Updated production URL
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Handle session expiration
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
      localStorage.removeItem('user');
    }
    return Promise.reject(error);
  }
);

export default api;
