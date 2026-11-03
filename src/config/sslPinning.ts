/**
 * Stub Documentado de SSL/TLS Public Key Pinning (SPKI SHA-256)
 * Fase 4 - Preparacao HTTPS
 *
 * IMPORTANTE:
 * Este modulo encontra-se INTENCIONALMENTE INATIVO (`enabled: false`) ate que o dominio
 * definitivo de producao e os certificados Let's Encrypt estejam provisionados no proxy
 * reverso (Caddy ou Nginx) do BFF.
 *
 * Como obter os hashes SPKI SHA-256 quando o dominio HTTPS estiver no ar:
 *   1. Pin da chave publica do certificado folha do dominio:
 *      openssl s_client -servername api.seu-dominio.com -connect api.seu-dominio.com:443 < /dev/null 2>/dev/null \
 *        | openssl x509 -pubkey -noout \
 *        | openssl pkey -pubin -outform der \
 *        | openssl dgst -sha256 -binary | openssl enc -base64
 *
 *   2. Pin de backup (OBRIGATORIO em producao - ex.: intermediaria Let's Encrypt E5/E6 ou R10/R11
 *      ou segundo par de chaves offline) para evitar bloqueio do app durante renovacoes automaticas ACME.
 *
 * Como ativar futuramente (Sprint 3 / Hardening de Release):
 *   Opcao A (Camada JS/Bridge): instalar `react-native-ssl-public-key-pinning`, inicializar
 *   `initializeSslPinning({ [hostname]: { includeSubdomains: true, publicKeyHashes: spkiPinsSha256 } })`
 *   quando `SSL_PINNING_CONFIG.enabled === true`.
 *   Opcao B (Nativo Android): declarar `<pin-set>` em `res/xml/network_security_config.xml`.
 */

export interface SslPinningConfig {
  /** Mantido como `false` ate a emissao do certificado TLS definitivo do dominio */
  enabled: boolean;
  /** Hostname publico do BFF (ex.: 'api.cloudwatch.seudominio.com') */
  hostname: string;
  /** Lista de hashes Base64 SHA-256 do SubjectPublicKeyInfo (folha + backup) */
  spkiPinsSha256: string[];
  /** Incluir subdominios na politica de pinning */
  includeSubdomains: boolean;
}

export const SSL_PINNING_CONFIG: SslPinningConfig = {
  enabled: false,
  hostname: '',
  spkiPinsSha256: [
    // Exemplo (substituir pelos hashes reais antes de mudar enabled para true):
    // 'sha256/AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=', // Pin primario (SPKI do servidor)
    // 'sha256/BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB=', // Pin de backup (CA intermediaria / chave reserva)
  ],
  includeSubdomains: true,
};

/**
 * Ponto unico de transporte HTTP/HTTPS utilizado pelo `apiClient`.
 * Enquanto `SSL_PINNING_CONFIG.enabled` for `false`, delega diretamente ao `fetch` padrao
 * validado pela cadeia de autoridades certificadoras (CA) do sistema Android.
 */
export async function performPinnedOrStandardFetch(
  url: string,
  init: RequestInit
): Promise<Response> {
  if (!SSL_PINNING_CONFIG.enabled) {
    return fetch(url, init);
  }

  // Guarda de seguranca caso alguem ative `enabled: true` sem configurar pelo menos 2 pins SPKI (primario + backup)
  if (!SSL_PINNING_CONFIG.hostname || SSL_PINNING_CONFIG.spkiPinsSha256.length < 2) {
    throw new Error(
      'SSL Pinning ativo sem configuracao completa (informe hostname e no minimo 2 hashes SPKI SHA-256: primario + backup).'
    );
  }

  // Ponto de integracao futuro com o cliente nativo de pinning (ex.: react-native-ssl-public-key-pinning)
  return fetch(url, init);
}

