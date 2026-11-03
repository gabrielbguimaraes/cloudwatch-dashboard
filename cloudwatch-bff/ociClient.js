/**
 * CloudWatch Dashboard BFF - Camada Oficial Oracle Cloud Infrastructure (OCI SDK)
 * Fase 2:
 *  - Criptografia autenticada AES-256-GCM por registro (iv:tag:cipher) via CREDENTIALS_ENC_KEY
 *  - Provedor OCI isolado por usuario/requisicao: USER_API_KEY e INSTANCE_PRINCIPAL (exclusivo OWNER_USERNAME)
 *  - Verificacao obrigatoria de credenciais (validateOciCredentials): formato -> PEM + MD5 DER fingerprint ->
 *    IdentityClient.getUser & getTenancy -> listRegionSubscriptions -> ResourceSearch teste de permissao
 *  - Descoberta de instancias reais (ResourceSearch + Compute + VirtualNetwork), metricas MQL (Monitoring) e eventos reais (Audit)
 */

const crypto = require('crypto');
const common = require('oci-common');
const core = require('oci-core');
const identity = require('oci-identity');
const monitoring = require('oci-monitoring');
const resourcesearch = require('oci-resourcesearch');
const audit = require('oci-audit');
const { pool } = require('./db');

const OCI_CALL_TIMEOUT_MS = 12000;
const INSTANCE_CACHE_TTL_MS = 45000; // 45s (entre 30 e 60s), isolado por usuario + conta + regiao

const OCI_READONLY_POLICIES_HINT = [
  'Sua conta OCI foi autenticada, mas o usuário ainda não possui permissão de leitura para listar recursos.',
  'Adicione o usuário a um grupo (ex.: CloudWatchReaders) e crie as seguintes policies no compartimento raiz (Tenancy):',
  'Allow group CloudWatchReaders to inspect instances in tenancy',
  'Allow group CloudWatchReaders to read instance-family in tenancy',
  'Allow group CloudWatchReaders to read virtual-network-family in tenancy',
  'Allow group CloudWatchReaders to read metrics in tenancy',
  'Allow group CloudWatchReaders to read audit-events in tenancy',
].join('\n');

// Cache em memoria estritamente separado por userId + accountId + region
const instancesMemoryCache = new Map();

function invalidateUserOciCache(userId) {
  const prefix = `${userId}:`;
  for (const key of instancesMemoryCache.keys()) {
    if (key.startsWith(prefix)) {
      instancesMemoryCache.delete(key);
    }
  }
}

// ============================================================================
// 1. CRIPTOGRAFIA AES-256-GCM DE CREDENCIAIS EM REPOUSO (iv:tag:cipher)
// ============================================================================
function getEncryptionKeyBuffer() {
  const rawHex = (process.env.CREDENTIALS_ENC_KEY || '').trim();
  if (!/^[0-9a-fA-F]{64}$/.test(rawHex)) {
    throw new Error(
      'Configuração ausente ou inválida: CREDENTIALS_ENC_KEY deve conter 64 caracteres hexadecimais (32 bytes) no .env.'
    );
  }
  return Buffer.from(rawHex, 'hex');
}

function encryptCredentials(plainObject) {
  const key = getEncryptionKeyBuffer();
  const iv = crypto.randomBytes(12); // Recomendado pelo NIST para AES-GCM (96 bits)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  const jsonBytes = Buffer.from(JSON.stringify(plainObject), 'utf8');
  const encrypted = Buffer.concat([cipher.update(jsonBytes), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
}

function decryptCredentials(formattedCiphertext) {
  if (!formattedCiphertext || typeof formattedCiphertext !== 'string') {
    throw new Error('Credenciais criptografadas ausentes.');
  }

  const parts = formattedCiphertext.split(':');
  if (parts.length !== 3) {
    throw new Error('Formato de credenciais criptografadas inválido (esperado iv:tag:cipher).');
  }

  const [ivHex, tagHex, cipherHex] = parts;
  const key = getEncryptionKeyBuffer();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(tagHex, 'hex');
  const encrypted = Buffer.from(cipherHex, 'hex');

  if (iv.length !== 12 || authTag.length !== 16 || encrypted.length === 0) {
    throw new Error(' Metadados de autenticação AES-GCM corrompidos.');
  }

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

// ============================================================================
// 2. UTILITARIOS DE VALIDACAO DE FORMATO, CHAVE PEM E TIMEOUT
// ============================================================================
function withTimeout(promise, ms = OCI_CALL_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const timeoutErr = new Error('Tempo limite excedido ao aguardar resposta da Oracle Cloud.');
      timeoutErr.code = 'ETIMEDOUT';
      reject(timeoutErr);
    }, ms);

    promise
      .then((val) => {
        clearTimeout(timer);
        resolve(val);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function normalizePem(rawPem) {
  if (!rawPem || typeof rawPem !== 'string') return '';
  return rawPem
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\r\n/g, '\n')
    .trim();
}

function isValidTenancyOcid(value) {
  if (!value || typeof value !== 'string') return false;
  return /^ocid1\.tenancy\.oc1\.\.[a-zA-Z0-9._-]{10,}$/.test(value.trim());
}

function isValidUserOcid(value) {
  if (!value || typeof value !== 'string') return false;
  return /^ocid1\.user\.oc1\.\.[a-zA-Z0-9._-]{10,}$/.test(value.trim());
}

function isValidFingerprint(value) {
  if (!value || typeof value !== 'string') return false;
  return /^([0-9a-fA-F]{2}:){15}[0-9a-fA-F]{2}$/.test(value.trim());
}

function resolveValidOciRegion(regionId) {
  if (!regionId || typeof regionId !== 'string') return null;
  const trimmed = regionId.trim().toLowerCase();
  if (!/^[a-z]{2}-[a-z0-9-]+-\d+$/.test(trimmed)) return null;
  const regionObj = common.Region.fromRegionId(trimmed);
  return regionObj || null;
}

/**
 * Valida chave privada PEM (e passphrase opcional) e calcula o fingerprint oficial da OCI:
 * MD5 da chave publica codificada em DER (SPKI), formatado como aa:bb:cc:...
 */
function parsePrivateKeyAndComputeFingerprint(privateKeyPem, passphrase) {
  const normalizedPem = normalizePem(privateKeyPem);
  if (!normalizedPem.includes('-----BEGIN') || !normalizedPem.includes('PRIVATE KEY-----')) {
    const err = new Error('Formato PEM ausente ou inválido.');
    err.code = 'OCI_INVALID_PRIVATE_KEY';
    throw err;
  }

  const keyOptions = {
    key: normalizedPem,
    format: 'pem',
  };
  if (passphrase && String(passphrase).length > 0) {
    keyOptions.passphrase = String(passphrase);
  }

  const privateKeyObj = crypto.createPrivateKey(keyOptions);
  if (privateKeyObj.asymmetricKeyType !== 'rsa') {
    const err = new Error('A chave privada deve ser do tipo RSA.');
    err.code = 'OCI_INVALID_PRIVATE_KEY';
    throw err;
  }

  const publicKeyDer = crypto
    .createPublicKey(privateKeyObj)
    .export({ type: 'spki', format: 'der' });

  const md5Hex = crypto.createHash('md5').update(publicKeyDer).digest('hex').toLowerCase();
  const calculatedFingerprint = md5Hex.match(/.{1,2}/g).join(':');

  return {
    normalizedPem,
    calculatedFingerprint,
  };
}

function isOwnerUsername(username) {
  const ownerEnv = (process.env.OWNER_USERNAME || '').trim();
  if (!ownerEnv || !username) return false;
  return String(username).trim().toLowerCase() === ownerEnv.toLowerCase();
}

// ============================================================================
// 3. VERIFICACAO OBRIGATORIA DE CREDENCIAIS OCI (validateOciCredentials)
// ============================================================================
/**
 * Executa a validacao completa exigida antes de persistir qualquer conta OCI:
 *  a) Formato estrito de tenancyOcid, userOcid, fingerprint e regiao OCI oficial
 *  b) Parse da chave privada PEM (+ passphrase) e comparacao do fingerprint MD5 DER
 *  c) Chamadas assinadas reais: IdentityClient.getUser e IdentityClient.getTenancy
 *  d) Em qualquer falha de a) a c): retorna erro claro em portugues sem salvar nada
 *  e) Se a) a c) passarem: consulta listRegionSubscriptions e testa ResourceSearch (limit 1)
 */
async function validateOciCredentials({
  tenancyOcid,
  userOcid,
  fingerprint,
  region,
  privateKeyPem,
  passphrase,
}) {
  const cleanTenancy = String(tenancyOcid || '').trim();
  const cleanUser = String(userOcid || '').trim();
  const cleanFingerprint = String(fingerprint || '').trim().toLowerCase();
  const cleanRegion = String(region || '').trim().toLowerCase();

  // a) Validacao de formato
  if (!isValidTenancyOcid(cleanTenancy)) {
    return {
      ok: false,
      httpStatus: 400,
      code: 'OCI_INVALID_FORMAT',
      message: 'OCID da Tenancy inválido. Deve iniciar com "ocid1.tenancy.oc1..".',
    };
  }

  if (!isValidUserOcid(cleanUser)) {
    return {
      ok: false,
      httpStatus: 400,
      code: 'OCI_INVALID_FORMAT',
      message:
        'OCID do Usuário inválido. Deve iniciar com "ocid1.user.oc1..". Contas federadas sem usuário IAM direto devem criar um usuário IAM de leitura.',
    };
  }

  if (!isValidFingerprint(cleanFingerprint)) {
    return {
      ok: false,
      httpStatus: 400,
      code: 'OCI_INVALID_FORMAT',
      message:
        'Formato de fingerprint inválido. Informe os 16 pares hexadecimais separados por dois-pontos (ex.: aa:bb:cc:...).',
    };
  }

  const regionObj = resolveValidOciRegion(cleanRegion);
  if (!regionObj) {
    return {
      ok: false,
      httpStatus: 400,
      code: 'OCI_INVALID_REGION',
      message: `Região OCI inválida ou desconhecida ("${cleanRegion || 'vazia'}"). Exemplo válido: sa-saopaulo-1.`,
    };
  }

  // b) Validacao criptografica da chave privada PEM e do fingerprint
  let normalizedPem = '';
  let calculatedFingerprint = '';
  try {
    const parsedKey = parsePrivateKeyAndComputeFingerprint(privateKeyPem, passphrase);
    normalizedPem = parsedKey.normalizedPem;
    calculatedFingerprint = parsedKey.calculatedFingerprint;
  } catch (_keyErr) {
    return {
      ok: false,
      httpStatus: 400,
      code: 'OCI_INVALID_PRIVATE_KEY',
      message:
        'A chave privada PEM é inválida, está incompleta ou a passphrase informada está incorreta.',
    };
  }

  if (calculatedFingerprint !== cleanFingerprint) {
    return {
      ok: false,
      httpStatus: 400,
      code: 'OCI_FINGERPRINT_MISMATCH',
      message:
        'O fingerprint informado não corresponde à chave privada enviada. Verifique se colou a chave .pem correta.',
    };
  }

  // c) Chamadas assinadas reais na Oracle Cloud (IdentityClient.getUser e getTenancy)
  const provider = new common.SimpleAuthenticationDetailsProvider(
    cleanTenancy,
    cleanUser,
    cleanFingerprint,
    normalizedPem,
    passphrase ? String(passphrase) : null,
    regionObj
  );

  const identityClient = new identity.IdentityClient({
    authenticationDetailsProvider: provider,
  });
  identityClient.region = regionObj;

  let ociUser = null;
  let ociTenancy = null;

  try {
    const [userRes, tenancyRes] = await withTimeout(
      Promise.all([
        identityClient.getUser({
          userId: cleanUser,
          retryConfiguration: common.NoRetryConfigurationDetails,
        }),
        identityClient.getTenancy({
          tenancyId: cleanTenancy,
          retryConfiguration: common.NoRetryConfigurationDetails,
        }),
      ]),
      OCI_CALL_TIMEOUT_MS
    );

    ociUser = userRes.user || null;
    ociTenancy = tenancyRes.tenancy || null;
  } catch (err) {
    const status = Number(err && err.statusCode ? err.statusCode : 0);
    console.warn(
      `[BFF OCI Validate] falha status=${status} serviceCode=${(err && err.serviceCode) || '-'} opcRequestId=${(err && err.opcRequestId) || '-'} msg=${String((err && err.message) || '').slice(0, 200)}`
    );

    if (status === 401) {
      return {
        ok: false,
        httpStatus: 401,
        code: 'OCI_INVALID_CREDENTIALS',
        message:
          'A Oracle Cloud rejeitou a autenticação (401). Verifique se a chave pública foi adicionada a este usuário OCI e se Tenancy/User OCID pertencem à mesma conta.',
      };
    }

    if (status === 404) {
      return {
        ok: false,
        httpStatus: 404,
        code: 'OCI_USER_NOT_FOUND',
        message:
          'Usuário ou tenancy não encontrado na Oracle Cloud (404) para a região informada.',
      };
    }

    if (status === 403) {
      return {
        ok: false,
        httpStatus: 403,
        code: 'OCI_INVALID_CREDENTIALS',
        message:
          'A Oracle Cloud negou o acesso ao validar o usuário/tenancy (403). Verifique o estado do usuário no IAM.',
      };
    }

    return {
      ok: false,
      httpStatus: 503,
      code: 'OCI_UNREACHABLE',
      message:
        'Não foi possível contatar a Oracle Cloud no momento (falha de rede ou timeout). Tente novamente.',
    };
  }

  // e) Regioes inscritas + Teste de permissao com Resource Search (limit 1)
  let subscribedRegions = [cleanRegion];
  try {
    const subsRes = await withTimeout(
      identityClient.listRegionSubscriptions({
        tenancyId: cleanTenancy,
        retryConfiguration: common.NoRetryConfigurationDetails,
      }),
      8000
    );
    if (subsRes && Array.isArray(subsRes.items) && subsRes.items.length > 0) {
      subscribedRegions = subsRes.items
        .map((r) => r.regionName)
        .filter(Boolean);
    }
  } catch (_subsErr) {
    // Mantem a regiao informada caso o usuario nao tenha permissao para listar subscricoes
  }

  let permissionStatus = 'OK';
  let hint = null;

  try {
    const searchClient = new resourcesearch.ResourceSearchClient({
      authenticationDetailsProvider: provider,
    });
    searchClient.region = regionObj;

    await withTimeout(
      searchClient.searchResources({
        limit: 1,
        retryConfiguration: common.NoRetryConfigurationDetails,
        searchDetails: {
          type: 'Structured',
          query: 'query instance resources',
        },
      }),
      8000
    );
  } catch (searchErr) {
    const searchStatus = Number(searchErr && searchErr.statusCode ? searchErr.statusCode : 0);
    if (searchStatus === 403 || searchStatus === 404) {
      permissionStatus = 'NO_PERMISSION';
      hint = OCI_READONLY_POLICIES_HINT;
    }
  }

  return {
    ok: true,
    tenancyOcid: cleanTenancy,
    userOcid: cleanUser,
    fingerprint: cleanFingerprint,
    region: cleanRegion,
    normalizedPem,
    tenancyName: (ociTenancy && ociTenancy.name) || cleanTenancy,
    ociUserName: (ociUser && ociUser.name) || '',
    subscribedRegions,
    permissionStatus,
    hint,
    provider,
  };
}

// ============================================================================
// 4. FABRICA DE PROVEDOR OCI POR REQUISICAO (getOciProvider)
// ============================================================================
/**
 * Retorna o AuthenticationDetailsProvider correspondente ao usuario autenticado:
 *  - USER_API_KEY: descriptografa credenciais da conta do usuario apenas em memoria
 *  - INSTANCE_PRINCIPAL: EXCLUSIVO para OWNER_USERNAME (como conta demo ou atalho explicito)
 *  - Sem conta conectada e nao sendo o dono em modo demo: lanca erro NO_OCI_ACCOUNT
 */
async function getOciProvider(userId, accountId = null) {
  if (!userId) {
    const err = new Error('Usuário não autenticado.');
    err.code = 'UNAUTHORIZED';
    err.httpStatus = 401;
    throw err;
  }

  const userRes = await pool.query(
    'SELECT id, username FROM master_users WHERE id = $1 LIMIT 1;',
    [userId]
  );

  if (userRes.rows.length === 0) {
    const err = new Error('Usuário não encontrado.');
    err.code = 'UNAUTHORIZED';
    err.httpStatus = 401;
    throw err;
  }

  const userRow = userRes.rows[0];
  const isOwner = isOwnerUsername(userRow.username);

  let accountQuery;
  let accountParams;

  if (accountId && accountId !== 'INSTANCE_PRINCIPAL') {
    accountQuery = `
      SELECT id, master_user_id, provider, auth_mode, account_identifier, tenancy_name,
             region, subscribed_regions, permission_status, encrypted_credentials
      FROM cloud_accounts
      WHERE id = $1 AND master_user_id = $2 AND provider = 'OCI'
      LIMIT 1;
    `;
    accountParams = [accountId, userId];
  } else {
    accountQuery = `
      SELECT id, master_user_id, provider, auth_mode, account_identifier, tenancy_name,
             region, subscribed_regions, permission_status, encrypted_credentials
      FROM cloud_accounts
      WHERE master_user_id = $1 AND provider = 'OCI'
      ORDER BY created_at DESC
      LIMIT 1;
    `;
    accountParams = [userId];
  }

  const accRes = await pool.query(accountQuery, accountParams);
  const accountRow = accRes.rows[0] || null;

  // Atalho explicito INSTANCE_PRINCIPAL ou conta registrada em modo INSTANCE_PRINCIPAL
  const wantsInstancePrincipal =
    accountId === 'INSTANCE_PRINCIPAL' ||
    (accountRow && accountRow.auth_mode === 'INSTANCE_PRINCIPAL');

  if (wantsInstancePrincipal) {
    if (!isOwner) {
      const err = new Error(
        'Operação negada: autenticação Instance Principal é restrita ao administrador do host.'
      );
      err.code = 'FORBIDDEN_INSTANCE_PRINCIPAL';
      err.httpStatus = 403;
      throw err;
    }

    try {
      const ipProvider = await withTimeout(
        new common.InstancePrincipalsAuthenticationDetailsProviderBuilder().build(),
        8000
      );
      const ipRegionObj =
        (typeof ipProvider.getRegion === 'function' && ipProvider.getRegion()) ||
        resolveValidOciRegion(accountRow?.region || process.env.OCI_DEFAULT_REGION || 'sa-saopaulo-1');
      const ipRegionId =
        (ipRegionObj && ipRegionObj.regionId) ||
        accountRow?.region ||
        'sa-saopaulo-1';
      const ipTenancyId =
        accountRow?.account_identifier ||
        (typeof ipProvider.getTenantId === 'function' ? ipProvider.getTenantId() : null);

      return {
        provider: ipProvider,
        authMode: 'INSTANCE_PRINCIPAL',
        accountId: accountRow ? accountRow.id : 'INSTANCE_PRINCIPAL',
        tenancyOcid: ipTenancyId,
        tenancyName: accountRow?.tenancy_name || 'Tenancy da VM (Instance Principal)',
        region: ipRegionId,
        regionObj: resolveValidOciRegion(ipRegionId) || ipRegionObj,
        permissionStatus: accountRow?.permission_status || 'OK',
        isOwner,
      };
    } catch (ipErr) {
      const err = new Error(
        'Instance Principal não está disponível neste ambiente ou o Dynamic Group da VM não foi configurado na OCI.'
      );
      err.code = 'INSTANCE_PRINCIPAL_UNAVAILABLE';
      err.httpStatus = 503;
      err.cause = ipErr;
      throw err;
    }
  }

  if (!accountRow) {
    const err = new Error('Nenhuma conta Oracle Cloud conectada para este usuário.');
    err.code = 'NO_OCI_ACCOUNT';
    err.httpStatus = 404;
    err.isOwner = isOwner;
    throw err;
  }

  const decrypted = decryptCredentials(accountRow.encrypted_credentials);
  const regionId = (accountRow.region || decrypted.region || 'sa-saopaulo-1').toLowerCase();
  const regionObj = resolveValidOciRegion(regionId);

  if (!regionObj) {
    const err = new Error(`Região configurada na conta OCI é inválida: ${regionId}`);
    err.code = 'OCI_INVALID_REGION';
    err.httpStatus = 400;
    throw err;
  }

  const simpleProvider = new common.SimpleAuthenticationDetailsProvider(
    decrypted.tenancyOcid,
    decrypted.userOcid,
    decrypted.fingerprint,
    decrypted.privateKeyPem,
    decrypted.passphrase || null,
    regionObj
  );

  // Limpa referencias locais sensiveis imediatamente apos instanciar o provider
  decrypted.privateKeyPem = '';
  if (decrypted.passphrase) decrypted.passphrase = '';

  return {
    provider: simpleProvider,
    authMode: 'USER_API_KEY',
    accountId: accountRow.id,
    tenancyOcid: accountRow.account_identifier || simpleProvider.getTenantId(),
    tenancyName: accountRow.tenancy_name || accountRow.account_identifier,
    region: regionId,
    regionObj,
    subscribedRegions: Array.isArray(accountRow.subscribed_regions)
      ? accountRow.subscribed_regions
      : [],
    permissionStatus: accountRow.permission_status || 'OK',
    isOwner,
  };
}

// ============================================================================
// 5. OPERACOES DE DADOS REAIS NA OCI (INSTANCIAS, METRICAS MQL E AUDIT LOGS)
// ============================================================================
function mapOciSdkError(err) {
  const status = Number(err && err.statusCode ? err.statusCode : 0);
  if (status === 401) {
    return {
      httpStatus: 422,
      ociStatus: 401,
      code: 'OCI_AUTH_FAILED',
      message:
        'A chave de API desta conta foi revogada ou não é mais aceita pela Oracle Cloud (401). Reconecte sua conta OCI.',
      hint: 'Verifique em Configurações do usuário > Chaves de API no Console OCI ou gere um novo comando de conexão no app.',
    };
  }
  if (status === 403) {
    return {
      httpStatus: 403,
      ociStatus: 403,
      code: 'OCI_NO_PERMISSION',
      message: 'Sua conta OCI não possui permissão de leitura para acessar estes recursos (403).',
      hint: OCI_READONLY_POLICIES_HINT,
    };
  }
  if (status === 404) {
    return {
      httpStatus: 404,
      ociStatus: 404,
      code: 'OCI_RESOURCE_NOT_FOUND',
      message: 'Recurso não encontrado ou sem permissão de visualização na Oracle Cloud (404).',
      hint: OCI_READONLY_POLICIES_HINT,
    };
  }
  return {
    httpStatus: 503,
    ociStatus: status || 503,
    code: 'OCI_UNREACHABLE',
    message: 'Não foi possível consultar a Oracle Cloud no momento. Tente novamente.',
    hint: null,
  };
}

/**
 * Conta rapidamente instancias visiveis via Resource Search estruturada
 */
async function countVisibleInstances(provider, regionObj) {
  const searchClient = new resourcesearch.ResourceSearchClient({
    authenticationDetailsProvider: provider,
  });
  searchClient.region = regionObj;

  const searchRes = await withTimeout(
    searchClient.searchResources({
      limit: 200,
      retryConfiguration: common.NoRetryConfigurationDetails,
      searchDetails: {
        type: 'Structured',
        query: "query instance resources where lifeCycleState != 'TERMINATED'",
      },
    }),
    OCI_CALL_TIMEOUT_MS
  );

  const items =
    (searchRes &&
      searchRes.resourceSummaryCollection &&
      Array.isArray(searchRes.resourceSummaryCollection.items) &&
      searchRes.resourceSummaryCollection.items) ||
    [];

  return items.length;
}

/**
 * Busca a leitura mais recente (ultimos 15m) de CPU ou Memoria no OCI Monitoring para uma instancia.
 * Se o plugin de monitoramento estiver desligado, retorna null (jamais inventa numeros).
 */
async function fetchLatestMetricPoint(monitoringClient, compartmentId, instanceOcid, metricName) {
  try {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 15 * 60 * 1000);
    const res = await withTimeout(
      monitoringClient.summarizeMetricsData({
        compartmentId,
        retryConfiguration: common.NoRetryConfigurationDetails,
        summarizeMetricsDataDetails: {
          namespace: 'oci_computeagent',
          query: `${metricName}[5m]{resourceId = "${instanceOcid}"}.mean()`,
          startTime,
          endTime,
          resolution: '5m',
        },
      }),
      6000
    );

    const series = (res && Array.isArray(res.items) && res.items[0]) || null;
    const points = (series && Array.isArray(series.aggregatedDatapoints) && series.aggregatedDatapoints) || [];
    if (points.length === 0) return null;

    const latest = points[points.length - 1];
    return typeof latest.value === 'number' && Number.isFinite(latest.value)
      ? Number(latest.value.toFixed(1))
      : null;
  } catch (_err) {
    return null;
  }
}

/**
 * Lista todas as instancias reais da conta OCI do usuario usando:
 *  - ResourceSearch ("query instance resources") em todos os compartimentos em 1 chamada
 *  - ComputeClient.getInstance (shape, shapeConfig, lifecycleState)
 *  - ComputeClient.listVnicAttachments + VirtualNetworkClient.getVnic (IPs publico e privado reais)
 *  - Snapshot opcional real de CPU/Memoria (null se indisponivel)
 *  - Cache em memoria de 45s estritamente isolado por userId + accountId + region
 */
async function listOciInstancesForUser(userId, accountId = null, forceRefresh = false) {
  const ctx = await getOciProvider(userId, accountId);
  const cacheKey = `${userId}:${ctx.accountId}:${ctx.region}`;

  if (!forceRefresh && instancesMemoryCache.has(cacheKey)) {
    const entry = instancesMemoryCache.get(cacheKey);
    if (Date.now() - entry.timestamp < INSTANCE_CACHE_TTL_MS) {
      return {
        ...entry.payload,
        fromMemoryCache: true,
      };
    }
    instancesMemoryCache.delete(cacheKey);
  }

  const searchClient = new resourcesearch.ResourceSearchClient({
    authenticationDetailsProvider: ctx.provider,
  });
  searchClient.region = ctx.regionObj;

  const computeClient = new core.ComputeClient({
    authenticationDetailsProvider: ctx.provider,
  });
  computeClient.region = ctx.regionObj;

  const vnetClient = new core.VirtualNetworkClient({
    authenticationDetailsProvider: ctx.provider,
  });
  vnetClient.region = ctx.regionObj;

  const monitoringClient = new monitoring.MonitoringClient({
    authenticationDetailsProvider: ctx.provider,
  });
  monitoringClient.region = ctx.regionObj;

  const searchRes = await withTimeout(
    searchClient.searchResources({
      limit: 100,
      retryConfiguration: common.NoRetryConfigurationDetails,
      searchDetails: {
        type: 'Structured',
        query: "query instance resources where lifeCycleState != 'TERMINATED'",
      },
    }),
    OCI_CALL_TIMEOUT_MS
  );

  const summaries =
    (searchRes &&
      searchRes.resourceSummaryCollection &&
      Array.isArray(searchRes.resourceSummaryCollection.items) &&
      searchRes.resourceSummaryCollection.items) ||
    [];

  // Processa em lotes de ate 5 instancias por vez para respeitar limites de taxa da OCI
  const detailedInstances = [];
  const batchSize = 5;

  for (let i = 0; i < summaries.length; i += batchSize) {
    const slice = summaries.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      slice.map(async (summary) => {
        const instanceOcid = summary.identifier;
        const compartmentId = summary.compartmentId;

        let instDetail = null;
        try {
          const getRes = await withTimeout(
            computeClient.getInstance({
              instanceId: instanceOcid,
              retryConfiguration: common.NoRetryConfigurationDetails,
            }),
            8000
          );
          instDetail = getRes.instance || null;
        } catch (_instErr) {
          instDetail = null;
        }

        const lifecycleState =
          (instDetail && instDetail.lifecycleState) || summary.lifecycleState || 'UNKNOWN';

        if (lifecycleState === 'TERMINATED') {
          return null;
        }

        // Busca IPs reais nas VNICs anexadas
        let publicIp = null;
        let privateIp = null;

        if (compartmentId) {
          try {
            const vnicAttRes = await withTimeout(
              computeClient.listVnicAttachments({
                compartmentId,
                instanceId: instanceOcid,
                retryConfiguration: common.NoRetryConfigurationDetails,
              }),
              8000
            );

            const attachedVnics = ((vnicAttRes && vnicAttRes.items) || []).filter(
              (att) => att.vnicId && (!att.lifecycleState || att.lifecycleState === 'ATTACHED')
            );

            for (const att of attachedVnics) {
              try {
                const vnicRes = await withTimeout(
                  vnetClient.getVnic({
                    vnicId: att.vnicId,
                    retryConfiguration: common.NoRetryConfigurationDetails,
                  }),
                  6000
                );
                const vnic = vnicRes && vnicRes.vnic;
                if (vnic) {
                  if (vnic.isPrimary || !privateIp) {
                    privateIp = vnic.privateIp || privateIp;
                    publicIp = vnic.publicIp || publicIp;
                  } else {
                    if (!publicIp && vnic.publicIp) publicIp = vnic.publicIp;
                    if (!privateIp && vnic.privateIp) privateIp = vnic.privateIp;
                  }
                }
              } catch (_vnicErr) {
                // Caso falte policy de virtual-network-family, mantem IPs como null (nunca falsos)
              }
            }
          } catch (_attErr) {
            // Mantem IPs como null se sem permissao
          }
        }

        // Coleta leitura atual real do OCI Monitoring apenas se a VM estiver RUNNING
        let cpuPercent = null;
        let memoryPercent = null;

        if (lifecycleState === 'RUNNING' && compartmentId) {
          const [latestCpu, latestMem] = await Promise.all([
            fetchLatestMetricPoint(monitoringClient, compartmentId, instanceOcid, 'CpuUtilization'),
            fetchLatestMetricPoint(
              monitoringClient,
              compartmentId,
              instanceOcid,
              'MemoryUtilization'
            ),
          ]);
          cpuPercent = latestCpu;
          memoryPercent = latestMem;
        }

        const shapeConfig = (instDetail && instDetail.shapeConfig) || {};
        const ocpus =
          typeof shapeConfig.ocpus === 'number' ? shapeConfig.ocpus : null;
        const memoryInGBs =
          typeof shapeConfig.memoryInGBs === 'number' ? shapeConfig.memoryInGBs : null;

        let healthStatus = 'HEALTHY';
        if (lifecycleState === 'STOPPED' || lifecycleState === 'STOPPING') {
          healthStatus = 'OFFLINE';
        } else if (
          lifecycleState === 'PROVISIONING' ||
          lifecycleState === 'STARTING' ||
          lifecycleState === 'MOVING'
        ) {
          healthStatus = 'REBOOTING';
        } else if (
          (typeof cpuPercent === 'number' && cpuPercent > 85) ||
          (typeof memoryPercent === 'number' && memoryPercent > 90)
        ) {
          healthStatus = 'CRITICAL';
        } else if (
          (typeof cpuPercent === 'number' && cpuPercent > 70) ||
          (typeof memoryPercent === 'number' && memoryPercent > 80)
        ) {
          healthStatus = 'WARNING';
        }

        return {
          id: instanceOcid,
          ocid: instanceOcid,
          name: (instDetail && instDetail.displayName) || summary.displayName || instanceOcid,
          provider: 'OCI',
          service: 'OCI_COMPUTE',
          region: (instDetail && instDetail.region) || ctx.region,
          compartmentId,
          availabilityDomain:
            (instDetail && instDetail.availabilityDomain) || summary.availabilityDomain || null,
          faultDomain: (instDetail && instDetail.faultDomain) || null,
          shape: (instDetail && instDetail.shape) || null,
          ocpus,
          memoryInGBs,
          lifecycleState,
          status: healthStatus,
          publicIp,
          privateIp,
          cpuPercent,
          memoryPercent,
          metricsAvailable: cpuPercent !== null || memoryPercent !== null,
          tags: (instDetail && instDetail.freeformTags) || summary.freeformTags || {},
          timeCreated:
            instDetail && instDetail.timeCreated
              ? new Date(instDetail.timeCreated).toISOString()
              : summary.timeCreated
              ? new Date(summary.timeCreated).toISOString()
              : null,
        };
      })
    );

    for (const item of batchResults) {
      if (item) detailedInstances.push(item);
    }
  }

  const payload = {
    source: 'LIVE_OCI',
    accountId: ctx.accountId,
    authMode: ctx.authMode,
    tenancyOcid: ctx.tenancyOcid,
    tenancyName: ctx.tenancyName,
    region: ctx.region,
    fetchedAt: new Date().toISOString(),
    instances: detailedInstances,
  };

  instancesMemoryCache.set(cacheKey, {
    timestamp: Date.now(),
    payload,
  });

  return payload;
}

/**
 * Busca series reais de CPU e Memoria no OCI Monitoring (namespace oci_computeagent)
 * Janelas: 1h (res 5m), 24h (res 1h), 7d (res 6h). Nunca retorna serie sintetica.
 */
async function getOciInstanceMetrics(userId, instanceOcid, windowKey = '24h', accountId = null) {
  const ctx = await getOciProvider(userId, accountId);

  const computeClient = new core.ComputeClient({
    authenticationDetailsProvider: ctx.provider,
  });
  computeClient.region = ctx.regionObj;

  // Confirma que a instancia pertence a conta do usuario e descobre seu compartmentId real
  const instRes = await withTimeout(
    computeClient.getInstance({
      instanceId: instanceOcid,
      retryConfiguration: common.NoRetryConfigurationDetails,
    }),
    8000
  );

  const instance = instRes.instance;
  if (!instance || !instance.compartmentId) {
    const err = new Error('Instância não encontrada nesta conta OCI.');
    err.statusCode = 404;
    throw err;
  }

  const windowConfigs = {
    '1h': { durationMs: 60 * 60 * 1000, interval: '5m', resolution: '5m' },
    '24h': { durationMs: 24 * 60 * 60 * 1000, interval: '1h', resolution: '1h' },
    '7d': { durationMs: 7 * 24 * 60 * 60 * 1000, interval: '6h', resolution: '6h' },
  };
  const cfg = windowConfigs[windowKey] || windowConfigs['24h'];

  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - cfg.durationMs);

  const monitoringClient = new monitoring.MonitoringClient({
    authenticationDetailsProvider: ctx.provider,
  });
  monitoringClient.region = ctx.regionObj;

  const [cpuRes, memRes] = await withTimeout(
    Promise.all([
      monitoringClient.summarizeMetricsData({
        compartmentId: instance.compartmentId,
        retryConfiguration: common.NoRetryConfigurationDetails,
        summarizeMetricsDataDetails: {
          namespace: 'oci_computeagent',
          query: `CpuUtilization[${cfg.interval}]{resourceId = "${instanceOcid}"}.mean()`,
          startTime,
          endTime,
          resolution: cfg.resolution,
        },
      }),
      monitoringClient.summarizeMetricsData({
        compartmentId: instance.compartmentId,
        retryConfiguration: common.NoRetryConfigurationDetails,
        summarizeMetricsDataDetails: {
          namespace: 'oci_computeagent',
          query: `MemoryUtilization[${cfg.interval}]{resourceId = "${instanceOcid}"}.mean()`,
          startTime,
          endTime,
          resolution: cfg.resolution,
        },
      }),
    ]),
    OCI_CALL_TIMEOUT_MS
  );

  const extractSeries = (sdkRes) => {
    const metricItem = (sdkRes && Array.isArray(sdkRes.items) && sdkRes.items[0]) || null;
    const rawPoints =
      (metricItem &&
        Array.isArray(metricItem.aggregatedDatapoints) &&
        metricItem.aggregatedDatapoints) ||
      [];

    return rawPoints
      .filter((pt) => pt && pt.timestamp && typeof pt.value === 'number' && Number.isFinite(pt.value))
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((pt) => {
        const dt = new Date(pt.timestamp);
        return {
          isoTimestamp: dt.toISOString(),
          timestamp: formatMetricLabel(dt, windowKey),
          value: Number(pt.value.toFixed(2)),
        };
      });
  };

  const cpuSeries = extractSeries(cpuRes);
  const memorySeries = extractSeries(memRes);

  const summarizeStats = (series) => {
    if (!series || series.length === 0) {
      return { current: null, avg: null, max: null };
    }
    const values = series.map((s) => s.value);
    const current = values[values.length - 1];
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = Number((sum / values.length).toFixed(1));
    const max = Number(Math.max(...values).toFixed(1));
    return { current: Number(current.toFixed(1)), avg, max };
  };

  const cpuStats = summarizeStats(cpuSeries);
  const memStats = summarizeStats(memorySeries);
  const metricsAvailable = cpuSeries.length > 0 || memorySeries.length > 0;

  return {
    source: 'LIVE_OCI',
    instanceId: instanceOcid,
    instanceName: instance.displayName || instanceOcid,
    lifecycleState: instance.lifecycleState,
    window: windowKey,
    resolution: cfg.resolution,
    metricsAvailable,
    hint: metricsAvailable
      ? null
      : 'O OCI Monitoring não retornou pontos no namespace oci_computeagent para este período. Verifique se a VM está em execução (RUNNING), se o plugin "Compute Instance Monitoring" do Oracle Cloud Agent está ativo na aba Oracle Cloud Agent do Console OCI e se há a policy "read metrics in tenancy".',
    metrics: {
      currentCpu: cpuStats.current,
      avgCpu: cpuStats.avg,
      maxCpu: cpuStats.max,
      currentMemory: memStats.current,
      avgMemory: memStats.avg,
      maxMemory: memStats.max,
    },
    cpuSeries,
    memorySeries,
  };
}

function formatMetricLabel(date, windowKey) {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  if (windowKey === '1h') {
    return `${hh}:${mm}`;
  }
  if (windowKey === '24h') {
    return `${hh}:${mm}`;
  }
  const dd = String(date.getDate()).padStart(2, '0');
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mo} ${hh}h`;
}

/**
 * Busca eventos reais de auditoria (AuditClient.listEvents) para a instancia/compartimento,
 * aplicando filtros de severidade e busca textual. Nunca retorna logs fixos/inventados.
 */
async function getOciInstanceAuditLogs(
  userId,
  instanceOcid,
  { severity = 'ALL', search = '', accountId = null } = {}
) {
  const ctx = await getOciProvider(userId, accountId);

  const computeClient = new core.ComputeClient({
    authenticationDetailsProvider: ctx.provider,
  });
  computeClient.region = ctx.regionObj;

  const instRes = await withTimeout(
    computeClient.getInstance({
      instanceId: instanceOcid,
      retryConfiguration: common.NoRetryConfigurationDetails,
    }),
    8000
  );

  const instance = instRes.instance;
  if (!instance || !instance.compartmentId) {
    const err = new Error('Instância não encontrada nesta conta OCI.');
    err.statusCode = 404;
    throw err;
  }

  const auditClient = new audit.AuditClient({
    authenticationDetailsProvider: ctx.provider,
  });
  auditClient.region = ctx.regionObj;

  const endTime = new Date();
  // Consulta os ultimos 7 dias de eventos reais de auditoria do compartimento da instancia
  const startTime = new Date(endTime.getTime() - 7 * 24 * 60 * 60 * 1000);

  const eventsRes = await withTimeout(
    auditClient.listEvents({
      compartmentId: instance.compartmentId,
      startTime,
      endTime,
      retryConfiguration: common.NoRetryConfigurationDetails,
    }),
    OCI_CALL_TIMEOUT_MS
  );

  const rawEvents = (eventsRes && Array.isArray(eventsRes.items) && eventsRes.items) || [];
  const instanceNameLower = String(instance.displayName || '').toLowerCase();

  // Prioriza eventos associados diretamente ao OCID/nome da instancia; caso nao haja eventos especificos da VM,
  // retorna apenas eventos de compute/rede do compartimento identificados claramente pela origem real
  const matchingInstanceEvents = rawEvents.filter((ev) => {
    const data = ev.data || {};
    const resId = String(data.resourceId || '');
    const resName = String(data.resourceName || '').toLowerCase();
    return (
      resId === instanceOcid ||
      (instanceNameLower && resName === instanceNameLower) ||
      JSON.stringify(data.additionalDetails || {}).includes(instanceOcid)
    );
  });

  const baseList =
    matchingInstanceEvents.length > 0
      ? matchingInstanceEvents
      : rawEvents.slice(0, 50);

  let mappedLogs = baseList.map((ev, idx) => {
    const data = ev.data || {};
    const resp = data.response || {};
    const identityInfo = data.identity || {};
    const statusStr = String(resp.status || '200');
    const statusNum = parseInt(statusStr, 10);

    let level = 'INFO';
    if (!Number.isNaN(statusNum) && statusNum >= 400) {
      level = statusNum >= 500 || statusNum === 401 || statusNum === 403 ? 'ERROR' : 'WARN';
    }

    const eventTimeIso = ev.eventTime
      ? new Date(ev.eventTime).toISOString()
      : new Date().toISOString();
    const timeShort = eventTimeIso.includes('T')
      ? eventTimeIso.split('T')[1].slice(0, 8)
      : eventTimeIso;

    const eventName = data.eventName || ev.eventType || 'AuditEvent';
    const principal = identityInfo.principalName || identityInfo.principalId || 'OCI IAM';
    const targetLabel = data.resourceName || data.resourceId || instance.displayName || 'compartment';

    return {
      id: ev.eventId || `audit-${idx}-${Date.now()}`,
      timestamp: eventTimeIso,
      timeShort,
      severity: level,
      source: ev.source || 'OCI Audit',
      message: `[${eventName}] Recurso: ${targetLabel} | Autor: ${principal} | HTTP ${statusStr}${
        resp.message ? ` (${resp.message})` : ''
      }`,
    };
  });

  mappedLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const upperSeverity = String(severity || 'ALL').toUpperCase();
  if (upperSeverity !== 'ALL') {
    mappedLogs = mappedLogs.filter((l) => l.severity === upperSeverity);
  }

  const trimmedSearch = String(search || '').trim().toLowerCase();
  if (trimmedSearch) {
    mappedLogs = mappedLogs.filter(
      (l) =>
        l.message.toLowerCase().includes(trimmedSearch) ||
        l.source.toLowerCase().includes(trimmedSearch) ||
        l.id.toLowerCase().includes(trimmedSearch)
    );
  }

  return {
    source: 'LIVE_OCI',
    instanceId: instanceOcid,
    matchedInstanceDirectly: matchingInstanceEvents.length > 0,
    logs: mappedLogs.slice(0, 100),
  };
}

module.exports = {
  OCI_READONLY_POLICIES_HINT,
  encryptCredentials,
  decryptCredentials,
  isOwnerUsername,
  parsePrivateKeyAndComputeFingerprint,
  validateOciCredentials,
  getOciProvider,
  mapOciSdkError,
  countVisibleInstances,
  listOciInstancesForUser,
  getOciInstanceMetrics,
  getOciInstanceAuditLogs,
  invalidateUserOciCache,
};

