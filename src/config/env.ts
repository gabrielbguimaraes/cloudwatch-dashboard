/**
 * Centralizacao de Configuracoes e Variaveis de Build - CloudWatch Mobile
 * Fase 4:
 *  - Zero IP hardcoded no codigo-fonte
 *  - PUBLIC_BASE_URL e API_BASE_URL injetados por build via babel.config.js (.env / variaveis de ambiente)
 *  - Bloqueio estrito de trafego cleartext (http://) em builds de release (!__DEV__)
 */

declare const process: {
  env: {
    CLOUDWATCH_PUBLIC_BASE_URL?: string;
    CLOUDWATCH_API_BASE_URL?: string;
  };
};

const DEV_EMULATOR_PUBLIC_URL = 'http://10.0.2.2:3000';
const UNCONFIGURED_RELEASE_HTTPS_URL = 'https://unconfigured-bff.cloudwatch.invalid';

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

  return __DEV__ ? DEV_EMULATOR_PUBLIC_URL : UNCONFIGURED_RELEASE_HTTPS_URL;
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
  if (trimmed.includes('unconfigured-bff.cloudwatch.invalid')) {
    throw new Error(
      'URL do servidor BFF não configurada no build de release. Defina CLOUDWATCH_API_BASE_URL (https://...) antes de gerar o APK.'
    );
  }
  if (!__DEV__ && !trimmed.startsWith('https://')) {
    throw new Error(
      'Conexão HTTP sem criptografia (cleartext) bloqueada em modo release. Configure um endpoint HTTPS válido.'
    );
  }
}

export const PUBLIC_BASE_URL = resolvePublicBaseUrl();
export const API_BASE_URL = resolveApiBaseUrl(PUBLIC_BASE_URL);
export const REQUEST_TIMEOUT_MS = 10000;
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
