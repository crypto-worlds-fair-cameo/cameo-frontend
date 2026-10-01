import { isAxiosError } from 'axios';
import { axiosInstance } from '@/shared/api/http-client';

export interface AuthenticatedSession {
  user: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    wallets: { chainNamespace: string; address: string }[];
  };
  session: {
    expiresAt: string;
    absoluteExpiresAt: string;
  };
}

export async function getSession(signal?: AbortSignal): Promise<AuthenticatedSession | null> {
  try {
    const response = await axiosInstance.get<{
      statusCode: number;
      success: true;
      data: AuthenticatedSession;
    }>('/auth/me', { withCredentials: true, signal });
    return response.data.data;
  } catch (error) {
    if (
      isAxiosError(error) &&
      (error.response?.status === 401 ||
        (error.response?.status === 403 && error.response.data?.code === 'AUTH_USER_UNAVAILABLE'))
    ) {
      return null;
    }
    throw error;
  }
}
