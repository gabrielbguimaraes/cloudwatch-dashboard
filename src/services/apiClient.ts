/**
 * CloudWatch Mobile - Cliente HTTP Autenticado com Renovacao Automatica de JWT
 * Fase 1:
 *  - Armazena accessToken e refreshToken exclusivamente no react-native-keychain (AES Keystore)
 *  - Anexa Authorization: Bearer <accessToken> em todas as chamadas autenticadas
 *  - Ao receber HTTP 401, executa POST /api/auth/refresh UMA unica vez (single-flight)
 *    e repete a requisicao original; caso o refresh falhe, limpa o cofre e desloga o usuario.
 */

import * as Keychain from 'react-native-keychain';
import { API_BASE_URL, REQUEST_TIMEOUT_MS, assertSecureTransport } from '../config/env';
import { performPinnedOrStandardFetch } from '../config/sslPinning';

const JWT_KEYCHAIN_SERVICE = 'cloudwatch_jwt_tokens_v2';
const JWT_KEYCHAIN_USERNAME = 'jwt_session';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiClientResponse<T = any> {
  ok: boolean;
  status: number;
  data: T | null;
  error?: string;
  code?: string;
  isNetworkError?: boolean;
}

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: any;
  skipAuth?: boolean;
  timeoutMs?: number;
  _retried?: boolean;
}

let memoryTokens: StoredTokens | null = null;
let refreshInFlight: Promise<StoredTokens | null> | null = null;
let unauthorizedHandler: (() => void | Promise<void>) | null = null;

/**
 * Registra callback disparado quando o refresh token falha e a sessao precisa ser encerrada
 */
export function setUnauthorizedHandler(handler: (() => void | Promise<void>) | null): void {
  unauthorizedHandler = handler;
}

/**
 * Grava access e refresh token no react-native-keychain usando criptografia simetrica AES
 * (evita o limite de bloco RSA de 245 bytes do Android Keystore)
 */
export async function saveAuthTokens(accessToken: string, refreshToken: string): Promise<void> {
  memoryTokens = { accessToken, refreshToken };
  const serialized = JSON.stringify(memoryTokens);

  await Keychain.setGenericPassword(JWT_KEYCHAIN_USERNAME, serialized, {
    service: JWT_KEYCHAIN_SERVICE,
    storage: Keychain.STORAGE_TYPE.AES,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

/**
 * Recupera os tokens armazenados no react-native-keychain
 */
export async function getAuthTokens(): Promise<StoredTokens | null> {
  if (memoryTokens && (memoryTokens.accessToken || memoryTokens.refreshToken)) {
    return memoryTokens;
  }

  try {
    const result = await Keychain.getGenericPassword({
      service: JWT_KEYCHAIN_SERVICE,
      storage: Keychain.STORAGE_TYPE.AES,
    });

    if (result && result.password) {
      const parsed = JSON.parse(result.password);
      if (
        parsed &&
        typeof parsed.refreshToken === 'string' &&
        (parsed.refreshToken.length > 0 || (typeof parsed.accessToken === 'string' && parsed.accessToken.length > 0))
      ) {
        memoryTokens = {
          accessToken: typeof parsed.accessToken === 'string' ? parsed.accessToken : '',
          refreshToken: parsed.refreshToken,
        };
        return memoryTokens;
      }
    }
  } catch (err) {
    console.warn('[apiClient] Falha ao ler tokens do Keychain:', err);
  }

  return null;
}

/**
 * Limpa apenas o accessToken volatil da sessao ativa, preservando o refreshToken
 * no Keychain para permitir reautenticacao imediata via Biometria na tela de Login.
 */
export async function clearVolatileAccessToken(): Promise<void> {
  const existing = await getAuthTokens();
  const persistedRefresh = existing?.refreshToken || '';
  memoryTokens = persistedRefresh ? { accessToken: '', refreshToken: persistedRefresh } : null;

  if (persistedRefresh) {
    try {
      await Keychain.setGenericPassword(
        JWT_KEYCHAIN_USERNAME,
        JSON.stringify({ accessToken: '', refreshToken: persistedRefresh }),
        {
          service: JWT_KEYCHAIN_SERVICE,
          storage: Keychain.STORAGE_TYPE.AES,
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }
      );
    } catch (err) {
      console.warn('[apiClient] Falha ao limpar accessToken volatil no Keychain:', err);
    }
  }
}

/**
 * Remove os tokens persistidos no Keychain em disco mantendo apenas o accessToken
 * volatil em RAM caso o usuario revogue a biometria enquanto ainda esta logado.
 */
export async function purgeKeychainForActiveSessionOnly(currentAccessToken: string): Promise<void> {
  try {
    await Keychain.resetGenericPassword({
      service: JWT_KEYCHAIN_SERVICE,
    });
  } catch (err) {
    console.warn('[apiClient] Falha ao remover tokens persistidos do Keychain:', err);
  }
  memoryTokens = currentAccessToken
    ? { accessToken: currentAccessToken, refreshToken: '' }
    : null;
}

/**
 * Remove os tokens da memoria e do react-native-keychain
 */
export async function clearAuthTokens(): Promise<void> {
  memoryTokens = null;
  try {
    await Keychain.resetGenericPassword({
      service: JWT_KEYCHAIN_SERVICE,
    });
  } catch (err) {
    console.warn('[apiClient] Falha ao limpar tokens do Keychain:', err);
  }
}

async function rawFetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  assertSecureTransport(url);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await performPinnedOrStandardFetch(url, {
      ...init,
      signal: controller.signal,
    });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Executa a renovacao unica (single-flight) do par de tokens junto ao BFF
 */
async function performTokenRefresh(): Promise<StoredTokens | null> {
  if (refreshInFlight) {
    return refreshInFlight;
  }

  refreshInFlight = (async (): Promise<StoredTokens | null> => {
    try {
      const current = await getAuthTokens();
      if (!current || !current.refreshToken) {
        return null;
      }

      const response = await rawFetchWithTimeout(
        `${API_BASE_URL}/auth/refresh`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({ refreshToken: current.refreshToken }),
        },
        REQUEST_TIMEOUT_MS
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json().catch(() => null);
      if (data && data.accessToken && data.refreshToken) {
        await saveAuthTokens(data.accessToken, data.refreshToken);
        return {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        };
      }

      return null;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function triggerForcedLogout(): Promise<void> {
  await clearAuthTokens();
  if (unauthorizedHandler) {
    await unauthorizedHandler();
  }
}

function buildUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const normalizedBase = API_BASE_URL.replace(/\/+$/, '');
  const normalizedPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return `${normalizedBase}${normalizedPath}`;
}

export const apiClient = {
  async request<T = any>(
    endpoint: string,
    options: ApiRequestOptions = {}
  ): Promise<ApiClientResponse<T>> {
    const {
      body,
      skipAuth = false,
      timeoutMs = REQUEST_TIMEOUT_MS,
      _retried = false,
      headers: customHeaders,
      ...restOptions
    } = options;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...((customHeaders as Record<string, string>) || {}),
    };

    if (!skipAuth) {
      const tokens = await getAuthTokens();
      if (tokens?.accessToken) {
        headers.Authorization = `Bearer ${tokens.accessToken}`;
      }
    }

    const serializedBody =
      body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body);

    const url = buildUrl(endpoint);

    try {
      const response = await rawFetchWithTimeout(
        url,
        {
          ...restOptions,
          headers,
          body: serializedBody,
        },
        timeoutMs
      );

      // Se recebeu 401 numa rota autenticada, diferencia 401 do JWT do app vs 401 vindo da API da Oracle Cloud
      if (response.status === 401 && !skipAuth) {
        const errPayload = await response.json().catch(() => ({}));
        const errCode = String(errPayload?.code || '');
        const isUpstreamOci401 = errCode.startsWith('OCI_');

        if (isUpstreamOci401) {
          return {
            ok: false,
            status: 401,
            data: errPayload,
            code: errCode,
            error:
              errPayload?.error ||
              errPayload?.message ||
              'A Oracle Cloud recusou as credenciais informadas (401).',
          };
        }

        if (!_retried) {
          const refreshed = await performTokenRefresh();
          if (refreshed && refreshed.accessToken) {
            return apiClient.request<T>(endpoint, {
              ...options,
              _retried: true,
            });
          }
        }

        await triggerForcedLogout();
        return {
          ok: false,
          status: 401,
          data: null,
          code: errPayload?.code || 'SESSION_EXPIRED',
          error: errPayload?.error || 'Sua sessão expirou. Faça login novamente.',
        };
      }

      const json = await response.json().catch(() => null);

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          data: json,
          code: json?.code,
          error:
            json?.error ||
            json?.message ||
            `Falha na requisição (HTTP ${response.status}).`,
        };
      }

      return {
        ok: true,
        status: response.status,
        data: json as T,
      };
    } catch (err: any) {
      const errMsg = String(err?.message || '');
      if (
        errMsg.includes('cleartext') ||
        errMsg.includes('não configurada no build') ||
        errMsg.includes('SSL Pinning')
      ) {
        return {
          ok: false,
          status: 0,
          data: null,
          isNetworkError: false,
          code: 'INSECURE_OR_MISSING_TRANSPORT',
          error: errMsg,
        };
      }
      const isAbort = err?.name === 'AbortError';
      return {
        ok: false,
        status: 0,
        data: null,
        isNetworkError: true,
        code: isAbort ? 'REQUEST_TIMEOUT' : 'NETWORK_UNREACHABLE',
        error: isAbort
          ? 'Tempo limite excedido ao contatar o servidor.'
          : 'Servidor inacessível no momento. Verifique sua conexão.',
      };
    }
  },

  get<T = any>(endpoint: string, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) {
    return apiClient.request<T>(endpoint, { ...options, method: 'GET' });
  },

  post<T = any>(endpoint: string, body?: any, options: Omit<ApiRequestOptions, 'method' | 'body'> = {}) {
    return apiClient.request<T>(endpoint, { ...options, method: 'POST', body });
  },

  delete<T = any>(endpoint: string, options: Omit<ApiRequestOptions, 'method'> = {}) {
    return apiClient.request<T>(endpoint, { ...options, method: 'DELETE' });
  },
};

export default apiClient;

