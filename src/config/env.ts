/**
 * Centralizacao de Configuracoes e Variaveis de Build - CloudWatch Mobile
 * Aponta por padrao para o dominio HTTPS de producao (Caddy TLS na VM OCI):
 *   https://cloudwatch-fatec.duckdns.org
 * Permite override opcional via variaveis de ambiente CLOUDWATCH_PUBLIC_BASE_URL / CLOUDWATCH_API_BASE_URL.
 */

declare const process: {
  env: {
    CLOUDWATCH_PUBLIC_BASE_URL?: string;
    CLOUDWATCH_API_BASE_URL?: string;
  };
};

const DEFAULT_PRODUCTION_PUBLIC_URL = 'https://cloudwatch-fatec.duckdns.org';

function stripTrailingSlashes(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

function resolvePublicBaseUrl(): string {
  const fromPublicEnv = stripTrailingSlashes(process.env.CLOUDWATCH_PUBLIC_BASE_URL || '');
  if (fromPublicEnv) {
    return fromPublicEnv;
  }

  const fromApiEnv = stripTrailingSlashes(process.env.CLOUDWATCH_API_BASE_URL || '');
  if (fromApiEnv) {
    return fromApiEnv.endsWith('/api') ? fromApiEnv.slice(0, -4) : fromApiEnv;
  }

  return DEFAULT_PRODUCTION_PUBLIC_URL;
}

function resolveApiBaseUrl(publicBaseUrl: string): string {
  const fromApiEnv = stripTrailingSlashes(process.env.CLOUDWATCH_API_BASE_URL || '');
  if (fromApiEnv) {
    return fromApiEnv;
  }
  return `${publicBaseUrl}/api`;
}

/**
 * Valida que builds de release (!__DEV__) utilizem exclusivamente HTTPS (TLS),
 * eliminando qualquer dependencia de cleartext traffic no APK de producao.
 */
export function assertSecureTransport(targetUrl: string): void {
  const trimmed = (targetUrl || '').trim();
  if (!__DEV__ && !trimmed.startsWith('https://')) {
    throw new Error(
      'Conexão HTTP sem criptografia (cleartext) bloqueada em modo release. Configure um endpoint HTTPS válido.'
    );
  }
}

export const PUBLIC_BASE_URL = resolvePublicBaseUrl();
export const API_BASE_URL = resolveApiBaseUrl(PUBLIC_BASE_URL);
export const REQUEST_TIMEOUT_MS = 8000;
export const DEFAULT_REGION = 'sa-saopaulo-1';
export const SLA_CRITICAL_THRESHOLD = 85;
export const BIOMETRIC_REAUTH_WINDOW_MS = 15 * 60 * 1000;

export const ENV = {
  PUBLIC_BASE_URL,
  API_BASE_URL,
  REQUEST_TIMEOUT_MS,
  DEFAULT_REGION,
  SLA_CRITICAL_THRESHOLD,
  BIOMETRIC_REAUTH_WINDOW_MS,
};

export default ENV;
