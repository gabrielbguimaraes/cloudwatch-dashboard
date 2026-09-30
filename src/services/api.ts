/**
 * CloudWatch Mobile - Servico de Integracao com Micro-BFF OCI
 * Suporta arquitetura Offline-First: se o servidor estiver inacessivel,
 * a aplicacao recorre ao armazenamento local seguro (EncryptedStorage/AsyncStorage)
 */

export const API_URL = 'http://167.234.241.171:3000/api';

const REQUEST_TIMEOUT_MS = 2500;

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  isOfflineFallback?: boolean;
}

const fetchWithTimeout = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });
    clearTimeout(timeoutId);
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

export const apiService = {
  /**
   * Registro de Conta Mestre no PostgreSQL remoto via Micro-BFF
   */
  async registerMaster(
    username: string,
    email: string,
    password: string
  ): Promise<ApiResponse<{ token: string; user: any }>> {
    try {
      const response = await fetchWithTimeout(`${API_URL}/auth/register`, {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || errorData.error || `Erro HTTP ${response.status}`,
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (err: any) {
      // Fallback offline-first
      return {
        success: false,
        isOfflineFallback: true,
        error: err?.message || 'Servidor remoto inacessivel. Operando em modo offline seguro.',
      };
    }
  },

  /**
   * Autenticacao de Conta Mestre no PostgreSQL remoto
   */
  async loginMaster(
    username: string,
    password: string
  ): Promise<ApiResponse<{ token: string; user: any }>> {
    try {
      const response = await fetchWithTimeout(`${API_URL}/auth/login`, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || errorData.error || 'Credenciais invalidas.',
        };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        isOfflineFallback: true,
        error: err?.message || 'Servidor remoto inacessivel. Validando localmente.',
      };
    }
  },

  /**
   * Vinculacao de Provedor de Nuvem na base relacional
   */
  async linkCloudProvider(
    masterUserId: string,
    provider: 'OCI' | 'AWS' | 'GCP',
    accountIdentifier: string,
    region: string,
    credentials: Record<string, string>,
    biometricsEnabled: boolean
  ): Promise<ApiResponse> {
    try {
      const response = await fetchWithTimeout(`${API_URL}/cloud/link`, {
        method: 'POST',
        body: JSON.stringify({
          masterUserId,
          provider,
          accountIdentifier,
          region,
          credentialsEncrypted: JSON.stringify(credentials),
          biometricsEnabled,
        }),
      });

      if (!response.ok) {
        return { success: false, error: `Falha HTTP ${response.status}` };
      }

      const data = await response.json();
      return { success: true, data };
    } catch (err: any) {
      return {
        success: false,
        isOfflineFallback: true,
        error: 'Persistencia remota offline. Salvo no cofre local.',
      };
    }
  },

  /**
   * Obtem instancias persistidas na base remota
   */
  async getInstances(masterUserId?: string): Promise<ApiResponse<any[]>> {
    try {
      const url = masterUserId
        ? `${API_URL}/instances?masterUserId=${encodeURIComponent(masterUserId)}`
        : `${API_URL}/instances`;

      const response = await fetchWithTimeout(url, {
        method: 'GET',
      });

      if (!response.ok) {
        return { success: false, error: `Falha HTTP ${response.status}` };
      }

      const data = await response.json();
      return { success: true, data: data.instances || data };
    } catch (err: any) {
      return {
        success: false,
        isOfflineFallback: true,
        error: 'Falha de conexao com API remota. Carregando dados locais.',
      };
    }
  },
};
