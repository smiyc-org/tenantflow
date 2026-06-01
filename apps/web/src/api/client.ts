import axios from 'axios';
import { msalInstance, loginRequest } from '../auth/msalConfig.js';

export const apiClient = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use(async (config) => {
  const accounts = msalInstance.getAllAccounts();
  if (accounts[0]) {
    try {
      const result = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      });
      config.headers.Authorization = `Bearer ${result.accessToken}`;
    } catch {
      // Token expired — force re-login
      await msalInstance.loginRedirect(loginRequest);
    }
  }
  return config;
});

apiClient.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      msalInstance.loginRedirect(loginRequest).catch(console.error);
    }
    return Promise.reject(err);
  },
);
