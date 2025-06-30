import axios from 'axios';

// Creates a pre-configured instance of the Axios client.
const api = axios.create({
  // The base URL for all API requests, pointing to our backend server.
  baseURL: 'http://localhost:3001/api',
  
  // This is CRITICAL for cookie-based authentication. It instructs Axios
  // to include credentials (like cookies) in cross-origin requests.
  withCredentials: true,
});

export default api;