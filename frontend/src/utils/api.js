import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '',
  timeout: 30000,
});

// Attach JWT token from localStorage to every request
api.interceptors.request.use(async (config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => Promise.reject(error));

// Global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // If the server tells us our token is invalid/expired, we might want to clear it
    if (error.response?.status === 401 || error.response?.status === 403) {
      // Optional: Handle token expiration globally here
      // localStorage.removeItem('token');
      // window.location.href = '/login';
    }

    const message = error.response?.data?.error || error.message || 'An error occurred';
    console.error('API Error:', message);
    return Promise.reject(new Error(message));
  }
);

export default api;
