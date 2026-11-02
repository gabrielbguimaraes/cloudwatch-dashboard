/**
 * Centralizacao de Configuracoes e Variaveis de Ambiente - CloudWatch Mobile
 * Sprint 2: Parametrizacao de conexao, timeouts e limites operacionais
 */

export const API_BASE_URL = 'http://167.234.241.171:3000/api';
export const REQUEST_TIMEOUT_MS = 4500;
export const DEFAULT_REGION = 'sa-saopaulo-1';
export const SLA_CRITICAL_THRESHOLD = 85; // Limite critico de SLA em porcentagem (85%)
export const BIOMETRIC_REAUTH_WINDOW_MS = 15 * 60 * 1000; // Janela de tolerancia biometrica: 15 minutos

export const ENV = {
  API_BASE_URL,
  REQUEST_TIMEOUT_MS,
  DEFAULT_REGION,
  SLA_CRITICAL_THRESHOLD,
  BIOMETRIC_REAUTH_WINDOW_MS,
};

export default ENV;

