import axios from 'axios';

// Configure global Axios instance using environment variables
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 30000 // 30s timeout to allow for Render free tier cold-starts
});

// Interceptor for outgoing requests
api.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor for responses with graceful error logging
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log API warning without throwing uncaught global exceptions
    if (error.code === 'ECONNABORTED') {
      console.warn('API request timed out (Backend might be starting up on Render)');
    } else {
      console.warn('API request issue:', error.message);
    }
    return Promise.reject(error);
  }
);

export default api;
