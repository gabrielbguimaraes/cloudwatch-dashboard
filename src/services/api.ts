/**
 * CloudWatch Mobile - Servico de Autenticacao e Conta com o BFF
 * Fase 1: Usa apiClient com JWT Bearer, sem passar userId em query/body.
 */

import { API_BASE_URL } from '../config/env';
import apiClient from './apiClient';
import type { MasterProfile } from '../types/auth';

export const API_URL = API_BASE_URL;

export interface AuthSuccessPayload {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: MasterProfile;
}

export interface ApiResponse<T = any> {
  success: boolean;
  status?: number;
  code?: string;
  data?: T;
  error?: string;
  isNetworkError?: boolean;
}

export const apiService = {
  /**
   * Cadastro de usuario no PostgreSQL via BFF (retorna 409 se ja existir)
   */
  async registerMaster(
    username: string,
    email: string,
    password: string
  ): Promise<ApiResponse<AuthSuccessPayload>> {
    const res = await apiClient.post<AuthSuccessPayload>(
      '/auth/register',
      { username, email, password },
      { skipAuth: true }
    );

    if (!res.ok || !res.data?.accessToken || !res.data?.refreshToken || !res.data?.user) {
      return {
        success: false,
        status: res.status,
        code: res.code,
        isNetworkError: res.isNetworkError,
        error: res.error || 'Não foi possível criar a conta no servidor.',
      };
    }

    return {
      success: true,
      status: res.status,
      data: res.data,
    };
  },

  /**
   * Login com usuario/e-mail e senha junto ao BFF (emite access 15m + refresh 7d)
   */
  async loginMaster(
    username: string,
    password: string
  ): Promise<ApiResponse<AuthSuccessPayload>> {
    const res = await apiClient.post<AuthSuccessPayload>(
      '/auth/login',
      { username, password },
      { skipAuth: true }
    );

    if (!res.ok || !res.data?.accessToken || !res.data?.refreshToken || !res.data?.user) {
      return {
        success: false,
        status: res.status,
        code: res.code,
        isNetworkError: res.isNetworkError,
        error: res.error || 'Credenciais inválidas ou servidor indisponível.',
      };
    }

    return {
      success: true,
      status: res.status,
      data: res.data,
    };
  },

  /**
   * Renova explicitamente a sessao com o refresh token atual (ex: desbloqueio por biometria)
   */
  async refreshSession(refreshToken: string): Promise<ApiResponse<AuthSuccessPayload>> {
    const res = await apiClient.post<AuthSuccessPayload>(
      '/auth/refresh',
      { refreshToken },
      { skipAuth: true }
    );

    if (!res.ok || !res.data?.accessToken || !res.data?.refreshToken) {
      return {
        success: false,
        status: res.status,
        code: res.code,
        isNetworkError: res.isNetworkError,
        error: res.error || 'Sessão expirada. Faça login com sua senha.',
      };
    }

    return {
      success: true,
      status: res.status,
      data: res.data,
    };
  },

  /**
   * Revoga o refresh token no servidor durante o logout
   */
  async logoutSession(refreshToken?: string): Promise<void> {
    await apiClient.post('/auth/logout', refreshToken ? { refreshToken } : {}).catch(() => {});
  },
};

export default apiService;
