import axios from 'axios';
import { getToken, clearToken } from '../utils/auth';

// Determine base URL: if VITE_API_URL is set (production domain), append /api/v1; otherwise use current origin
const baseURL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL + '/api/v1'
  : `${window.location.origin}/api/v1`;

const axiosInstance = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Bearer Token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = getToken();
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle 401 Unauthorized
// Only clear the token — let ProtectedRoute handle the redirect via React Router.
// Avoid window.location hard-reloads which blank the page before React can react.
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      clearToken();
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
