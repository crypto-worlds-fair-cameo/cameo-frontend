import axios from 'axios';

/**
 * 사용법:
 * import { axiosInstance as axios } from '@/shared/api/http-client';
 * - axios.get('/endpoint');
 * - axios.post('/endpoint', data);
 * - axios.put('/endpoint', data);
 * - axios.delete('/endpoint');
 */

export const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});
