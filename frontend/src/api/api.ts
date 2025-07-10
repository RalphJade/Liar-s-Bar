import axios from 'axios';

const api = axios.create({
  // Sets the base URL for all API requests to our backend server.
  baseURL: '/api',
  //This instructs Axios to include credentials (like cookies) in all cross-origin requests, allowing the backend to read the auth token
  withCredentials: true,
});

export default api;
