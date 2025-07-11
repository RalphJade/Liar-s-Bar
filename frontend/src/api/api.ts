import axios from 'axios';

let baseURL: string;

if (import.meta.env.DEV) {
  baseURL = 'http://localhost:3001/api';
} else {
  baseURL = '/api';
}

const api = axios.create({
  // Sets the base URL for all API requests to our backend server.

  baseURL: baseURL,

  //This instructs Axios to include credentials (like cookies) in all cross-origin requests, allowing the backend to read the auth token
  withCredentials: true,
});

export default api;
