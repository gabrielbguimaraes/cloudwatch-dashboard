/**
 * CloudWatch Dashboard BFF - Suite de Testes de Seguranca, Isolamento Multi-Usuario e Validacao OCI
 * Fase 2 (Item 7):
 *  - Registra dois usuarios de teste (User A e User B) e valida conflito 409 e bloqueio 401 sem token
 *  - Verifica rotacao de refresh token e bloqueio de reuso
 *  - Verifica isolamento estrito entre User A e User B (sessoes, contas, demo owner, anti-SSRF)
 *  - Verifica inspecao do script de Cloud Shell, exigencia de HTTPS em producao e uso unico do codigo de pareamento
 *  - Verifica que credenciais invalidas (fingerprint errado e usuario inexistente na OCI) sao rejeitadas
 *    sem salvar nada em cloud_accounts e sem marcar a OCI como conectada.
 *
 * Uso:
 *   node cloudwatch-bff/test-oci.js
 */

const assert = require('assert');
const crypto = require('crypto');

// Configura variaveis efemeras de teste caso .env local nao exista (zero segredos reais hardcoded)
process.env.NODE_ENV = 'development';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || crypto.randomBytes(32).toString('hex');
process.env.CREDENTIALS_ENC_KEY =
  process.env.CREDENTIALS_ENC_KEY || crypto.randomBytes(32).toString('hex');
process.env.OWNER_USERNAME = process.env.OWNER_USERNAME || 'owner_vm_admin_only';
process.env.PAIRING_PROPAGATION_RETRIES = '0';

const dbModule = require('./db');

/**
 * Caso o PostgreSQL nao esteja rodando na maquina local de desenvolvimento/CI,
 * injeta um adaptador SQL em memoria fiel as tabelas do BFF para permitir validacao HTTP ponta a ponta.
 * Quando PostgreSQL esta acessivel (ex.: VM OCI), executa diretamente no banco real e limpa os registros de teste ao final.
 */
function createInMemoryPgPool() {
  const tables = {
    master_users: [],
    refresh_tokens: [],
    cloud_accounts: [],
    oci_pairing_sessions: [],
  };

  async function executeQuery(sqlRaw, params = []) {
    const sql = sqlRaw.replace(/\s+/g, ' ').trim();

    if (
      sql.startsWith('BEGIN') ||
      sql.startsWith('COMMIT') ||
      sql.startsWith('ROLLBACK') ||
      sql.includes('CREATE TABLE') ||
      sql.includes('CREATE INDEX') ||
      sql.includes('ALTER TABLE')
    ) {
      return { rows: [], rowCount: 0 };
    }

    // master_users: busca conflito no register
    if (
      sql.includes('FROM master_users') &&
      sql.includes('LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)')
    ) {
      const u = String(params[0] || '').toLowerCase();
      const e = String(params[1] || '').toLowerCase();
      const found = tables.master_users.filter(
        (r) => r.username.toLowerCase() === u || r.email.toLowerCase() === e
      );
      return { rows: found.slice(0, 1), rowCount: found.length ? 1 : 0 };
    }

    // master_users: login por username ou email
    if (
      sql.includes('FROM master_users') &&
      sql.includes('LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)')
    ) {
      const u = String(params[0] || '').toLowerCase();
      const found = tables.master_users.filter(
        (r) => r.username.toLowerCase() === u || r.email.toLowerCase() === u
      );
      return { rows: found.slice(0, 1), rowCount: found.length ? 1 : 0 };
    }

    // master_users: busca por id
    if (sql.includes('FROM master_users WHERE id = $1')) {
      const found = tables.master_users.filter((r) => r.id === params[0]);
      return { rows: found.slice(0, 1), rowCount: found.length ? 1 : 0 };
    }

    // master_users: insert
    if (sql.startsWith('INSERT INTO master_users')) {
      const [id, username, email, password_hash] = params;
      const conflict = tables.master_users.some(
        (r) =>
          r.username.toLowerCase() === username.toLowerCase() ||
          r.email.toLowerCase() === email.toLowerCase()
      );
      if (conflict) {
        const err = new Error('duplicate key value violates unique constraint');
        err.code = '23505';
        throw err;
      }
      const row = {
        id,
        username,
        email,
        password_hash,
        role: 'USER',
        created_at: new Date(),
        last_login: new Date(),
      };
      tables.master_users.push(row);
      return { rows: [row], rowCount: 1 };
    }

    if (sql.startsWith('UPDATE master_users SET last_login')) {
      return { rows: [], rowCount: 1 };
    }

    // refresh_tokens: insert
    if (sql.startsWith('INSERT INTO refresh_tokens')) {
      const [id, user_id, token_hash, expires_at] = params;
      const row = {
        id,
        user_id,
        token_hash,
        expires_at: new Date(expires_at),
        revoked_at: null,
        replaced_by_hash: null,
        created_at: new Date(),
      };
      tables.refresh_tokens.push(row);
      return { rows: [row], rowCount: 1 };
    }

    // refresh_tokens: join com master_users
    if (sql.includes('FROM refresh_tokens rt JOIN master_users u')) {
      const hash = params[0];
      const rt = tables.refresh_tokens.find((r) => r.token_hash === hash);
      if (!rt) return { rows: [], rowCount: 0 };
      const u = tables.master_users.find((x) => x.id === rt.user_id);
      if (!u) return { rows: [], rowCount: 0 };
      return {
        rows: [
          {
            id: rt.id,
            user_id: rt.user_id,
            expires_at: rt.expires_at,
            revoked_at: rt.revoked_at,
            username: u.username,
            email: u.email,
            role: u.role,
            created_at: u.created_at,
          },
        ],
        rowCount: 1,
      };
    }

    if (sql.startsWith('UPDATE refresh_tokens SET revoked_at = NOW(), replaced_by_hash = $1 WHERE id = $2')) {
      const rt = tables.refresh_tokens.find((r) => r.id === params[1]);
      if (rt) {
        rt.revoked_at = new Date();
        rt.replaced_by_hash = params[0];
      }
      return { rows: [], rowCount: rt ? 1 : 0 };
    }

    if (sql.startsWith('UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1')) {
      let count = 0;
      for (const rt of tables.refresh_tokens) {
        if (rt.user_id === params[0] && rt.revoked_at === null) {
          rt.revoked_at = new Date();
          count++;
        }
      }
      return { rows: [], rowCount: count };
    }

    if (sql.startsWith('UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1')) {
      const rt = tables.refresh_tokens.find((r) => r.token_hash === params[0] && r.revoked_at === null);
      if (rt) rt.revoked_at = new Date();
      return { rows: [], rowCount: rt ? 1 : 0 };
    }

    // oci_pairing_sessions: insert
    if (sql.startsWith('INSERT INTO oci_pairing_sessions')) {
      const [id, user_id, code_hash, expires_at] = params;
      const row = {
        id,
        user_id,
        code_hash,
        status: 'PENDING',
        account_id: null,
        tenancy_name: null,
        region: null,
        instance_count: null,
        permission_status: null,
        error_code: null,
        error_message: null,
        expires_at: new Date(expires_at),
        used_at: null,
        created_at: new Date(),
      };
      tables.oci_pairing_sessions.push(row);
      return { rows: [row], rowCount: 1 };
    }

    // oci_pairing_sessions: select by code_hash
    if (sql.includes('FROM oci_pairing_sessions WHERE code_hash = $1')) {
      const found = tables.oci_pairing_sessions.find((s) => s.code_hash === params[0]);
      return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
    }

    // oci_pairing_sessions: select by id and user_id
    if (sql.includes('FROM oci_pairing_sessions WHERE id = $1 AND user_id = $2')) {
      const found = tables.oci_pairing_sessions.find(
        (s) => s.id === params[0] && s.user_id === params[1]
      );
      return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
    }

    if (sql.startsWith('UPDATE oci_pairing_sessions SET used_at = NOW() WHERE id = $1')) {
      const s = tables.oci_pairing_sessions.find((x) => x.id === params[0]);
      if (s) s.used_at = new Date();
      return { rows: [], rowCount: s ? 1 : 0 };
    }

    if (sql.includes("UPDATE oci_pairing_sessions SET status = 'COMPLETED'") || sql.includes("UPDATE oci_pairing_sessions SET status = 'CONNECTED'")) {
      const id = params[params.length - 1];
      const s = tables.oci_pairing_sessions.find((x) => x.id === id);
      if (s) {
        s.status = sql.includes("'COMPLETED'") ? 'COMPLETED' : 'CONNECTED';
        s.account_id = params[0];
        s.tenancy_name = params[1];
        s.region = params[2];
        s.instance_count = params[3];
        s.permission_status = sql.includes("'OK'") ? 'OK' : params[4];
      }
      return { rows: [], rowCount: s ? 1 : 0 };
    }

    if (sql.includes("UPDATE oci_pairing_sessions SET status = 'FAILED'")) {
      const [errCode, errMsg, id] = params;
      const s = tables.oci_pairing_sessions.find((x) => x.id === id);
      if (s) {
        s.status = 'FAILED';
        s.error_code = errCode;
        s.error_message = errMsg;
      }
      return { rows: [], rowCount: s ? 1 : 0 };
    }

    if (sql.includes("UPDATE oci_pairing_sessions SET status = 'EXPIRED'")) {
      const s = tables.oci_pairing_sessions.find((x) => x.id === params[0]);
      if (s) s.status = 'EXPIRED';
      return { rows: [], rowCount: s ? 1 : 0 };
    }

    // cloud_accounts: select & insert & delete
    if (sql.includes('FROM cloud_accounts') && sql.includes('WHERE master_user_id = $1')) {
      let list = tables.cloud_accounts.filter((a) => a.master_user_id === params[0]);
      if (sql.includes("provider = 'OCI'")) {
        list = list.filter((a) => a.provider === 'OCI');
      }
      if (sql.includes('AND account_identifier = $2')) {
        list = list.filter((a) => a.account_identifier === params[1]);
      }
      return { rows: list, rowCount: list.length };
    }

    if (sql.includes('FROM cloud_accounts') && sql.includes('WHERE id = $1 AND master_user_id = $2')) {
      const found = tables.cloud_accounts.find(
        (a) => a.id === params[0] && a.master_user_id === params[1]
      );
      return { rows: found ? [found] : [], rowCount: found ? 1 : 0 };
    }

    if (sql.startsWith('INSERT INTO cloud_accounts')) {
      const isIpMode = sql.includes("'INSTANCE_PRINCIPAL'");
      const [
        id,
        master_user_id,
        account_identifier,
        tenancy_name,
        region,
        subscribed_regions,
        permission_status,
        encrypted_credentials,
      ] = params;
      const row = {
        id,
        master_user_id,
        provider: 'OCI',
        auth_mode: isIpMode ? 'INSTANCE_PRINCIPAL' : 'USER_API_KEY',
        account_identifier,
        tenancy_name,
        region,
        subscribed_regions: JSON.parse(subscribed_regions || '[]'),
        permission_status: isIpMode ? 'OK' : permission_status,
        encrypted_credentials: isIpMode ? params[6] : encrypted_credentials,
        biometrics_enabled: false,
        created_at: new Date(),
      };
      tables.cloud_accounts.push(row);
      return { rows: [row], rowCount: 1 };
    }

    if (sql.startsWith('DELETE FROM cloud_accounts WHERE id = $1 AND master_user_id = $2')) {
      const idx = tables.cloud_accounts.findIndex(
        (a) => a.id === params[0] && a.master_user_id === params[1]
      );
      if (idx === -1) return { rows: [], rowCount: 0 };
      const [removed] = tables.cloud_accounts.splice(idx, 1);
      return { rows: [{ id: removed.id }], rowCount: 1 };
    }

    return { rows: [], rowCount: 0 };
  }

  return {
    tables,
    query: executeQuery,
    connect: async () => ({
      query: executeQuery,
      release: () => {},
    }),
    end: async () => {},
  };
}

function generateTestRsaKeyAndFingerprint() {
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  const md5Hex = crypto.createHash('md5').update(publicKey).digest('hex').toLowerCase();
  const fingerprint = md5Hex.match(/.{1,2}/g).join(':');
  return { privateKeyPem: privateKey, fingerprint };
}

async function runTests() {
  console.log('\n==============================================================');
  console.log('🛡️  CLOUDWATCH BFF — TESTES DE SEGURANÇA, ISOLAMENTO E OCI SDK');
  console.log('==============================================================\n');

  let usingRealPostgres = false;
  let memoryAdapter = null;

  try {
    await dbModule.pool.query('SELECT 1;');
    usingRealPostgres = true;
    console.log('✓ Banco de dados: Conectado ao PostgreSQL real.');
  } catch (_pgErr) {
    memoryAdapter = createInMemoryPgPool();
    dbModule.pool.query = memoryAdapter.query;
    dbModule.pool.connect = memoryAdapter.connect;
    console.log('✓ Banco de dados: PostgreSQL local offline — executando com adaptador transacional em memória.');
  }

  const {
    encryptCredentials,
    decryptCredentials,
    parsePrivateKeyAndComputeFingerprint,
  } = require('./ociClient');

  // 1. Teste de criptografia AES-256-GCM (iv:tag:cipher + deteccao de adulteracao)
  console.log('\n1. Verificando criptografia AES-256-GCM (iv:tag:cipher):');
  const secretSample = {
    tenancyOcid: 'ocid1.tenancy.oc1..aaaaaaaasampletenancy1234567890',
    privateKeyPem: '-----BEGIN PRIVATE KEY-----\nTEST\n-----END PRIVATE KEY-----',
  };
  const c1 = encryptCredentials(secretSample);
  const c2 = encryptCredentials(secretSample);
  assert.notStrictEqual(c1, c2, 'IV aleatório deve produzir ciphertexts distintos para o mesmo payload');
  assert.strictEqual(c1.split(':').length, 3, 'Formato deve ser iv:tag:cipher');
  assert.ok(!c1.includes('BEGIN PRIVATE KEY'), 'Chave privada jamais pode estar legível no ciphertext');
  const roundTrip = decryptCredentials(c1);
  assert.strictEqual(roundTrip.tenancyOcid, secretSample.tenancyOcid);

  let tamperCaught = false;
  try {
    const parts = c1.split(':');
    const flippedTag = (parts[1][0] === 'a' ? 'b' : 'a') + parts[1].slice(1);
    decryptCredentials(`${parts[0]}:${flippedTag}:${parts[2]}`);
  } catch (_e) {
    tamperCaught = true;
  }
  assert.ok(tamperCaught, 'Adulteração da auth tag GCM deve falhar na descriptografia');
  console.log('  ✓ AES-256-GCM com IV único de 12 bytes e verificação de integridade aprovado.');

  // Sobe o servidor Express real numa porta efemera
  const { app, dbReadyPromise } = require('./index');
  await dbReadyPromise;

  const server = await new Promise((resolve) => {
    const srv = app.listen(0, '127.0.0.1', () => resolve(srv));
  });
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  process.env.PUBLIC_BASE_URL = baseUrl;

  const suffix = `${Date.now().toString(36)}_${crypto.randomBytes(2).toString('hex')}`;
  const userACreds = {
    username: `test_user_a_${suffix}`,
    email: `user_a_${suffix}@cloudwatch.test`,
    password: 'StrongPassword#A2026',
  };
  const userBCreds = {
    username: `test_user_b_${suffix}`,
    email: `user_b_${suffix}@cloudwatch.test`,
    password: 'StrongPassword#B2026',
  };

  let createdUserIds = [];

  try {
    // 2. Bloqueio 401 sem token
    console.log('\n2. Verificando exigência de token Bearer (401) e conflito de cadastro (409):');
    const unauthRes = await fetch(`${baseUrl}/api/oci/accounts`);
    assert.strictEqual(unauthRes.status, 401, 'Requisição sem token deve retornar 401');
    console.log('  ✓ Requisição sem token Bearer bloqueada com HTTP 401.');

    // Cadastro User A e User B
    const regARes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userACreds),
    });
    assert.strictEqual(regARes.status, 201, 'Cadastro do Usuário A deve retornar 201');
    const regA = await regARes.json();
    assert.ok(regA.accessToken && regA.refreshToken && regA.user?.id);
    createdUserIds.push(regA.user.id);

    const regBRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userBCreds),
    });
    assert.strictEqual(regBRes.status, 201, 'Cadastro do Usuário B deve retornar 201');
    const regB = await regBRes.json();
    assert.ok(regB.accessToken && regB.refreshToken && regB.user?.id);
    createdUserIds.push(regB.user.id);

    // Tentativa de recadastrar Usuario A (nao pode sobrescrever senha!)
    const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: userACreds.username,
        email: 'outro@cloudwatch.test',
        password: 'HackerOverwrite123!',
      }),
    });
    assert.strictEqual(dupRes.status, 409, 'Usuário duplicado deve retornar HTTP 409');
    console.log('  ✓ Usuários A e B registrados; tentativa de sobrescrita bloqueada com HTTP 409.');

    // Rotacao e anti-reuso de Refresh Token
    const refresh1Res = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: regA.refreshToken }),
    });
    assert.strictEqual(refresh1Res.status, 200, 'Refresh válido deve retornar 200');
    const refresh1 = await refresh1Res.json();
    assert.notStrictEqual(refresh1.refreshToken, regA.refreshToken, 'Refresh token deve rotacionar');

    const replayRefreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: regA.refreshToken }),
    });
    assert.strictEqual(replayRefreshRes.status, 401, 'Reuso de refresh token antigo deve retornar 401');
    console.log('  ✓ Rotação de refresh token e revogação automática contra replay aprovadas.');

    // Novo login para User A apos o teste de revogacao por replay
    const loginARes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: userACreds.username, password: userACreds.password }),
    });
    assert.strictEqual(loginARes.status, 200);
    const sessionA = await loginARes.json();
    const tokenA = sessionA.accessToken;
    const tokenB = regB.accessToken;

    // 3. Isolamento entre Usuario A e Usuario B + Anti-SSRF + Bloqueio Instance Principal
    console.log('\n3. Verificando isolamento estrito entre Usuário A e Usuário B:');
    const pairSessionARes = await fetch(`${baseUrl}/api/oci/pairing`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(pairSessionARes.status, 201);
    const pairSessionA = await pairSessionARes.json();
    assert.strictEqual(pairSessionA.code.length, 12);

    // Usuario B tenta consultar status da sessao de pareamento do Usuario A
    const crossPollRes = await fetch(
      `${baseUrl}/api/oci/pairing/${pairSessionA.id}/status`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
      }
    );
    assert.strictEqual(
      crossPollRes.status,
      404,
      'Usuário B jamais pode visualizar sessão de pareamento do Usuário A'
    );

    // Usuario comum tenta ativar Instance Principal (restrito ao OWNER_USERNAME)
    const demoHackRes = await fetch(`${baseUrl}/api/oci/accounts/demo`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    assert.strictEqual(demoHackRes.status, 403, 'Usuário comum não pode usar Instance Principal');

    // Tentativa de SSRF no network-probe (IMDS 169.254.169.254)
    const ssrfRes = await fetch(
      `${baseUrl}/api/telemetry/network-probe?host=169.254.169.254`,
      {
        headers: { Authorization: `Bearer ${tokenA}` },
      }
    );
    assert.strictEqual(ssrfRes.status, 403, 'Tentativa de SSRF deve ser bloqueada com 403');
    console.log('  ✓ Isolamento A/B, bloqueio de Instance Principal e proteção anti-SSRF aprovados.');

    // 4. Exigencia de HTTPS fora de development + Inspecao multipla do script + Uso Unico do Codigo
    console.log('\n4. Verificando script de Cloud Shell, exigência HTTPS e uso único do código:');
    process.env.NODE_ENV = 'production';
    const httpBlockedRes = await fetch(`${baseUrl}/api/oci/pairing`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    assert.strictEqual(
      httpBlockedRes.status,
      400,
      'Em produção, PUBLIC_BASE_URL sem https:// deve ser recusado'
    );
    process.env.NODE_ENV = 'development';
    console.log('  ✓ Bloqueio de PUBLIC_BASE_URL sem HTTPS em produção aprovado.');

    // GET /p/:codigo pode ser lido mais de uma vez dentro do TTL para inspecao
    const scriptRead1 = await fetch(`${baseUrl}/p/${pairSessionA.code}`);
    const scriptRead2 = await fetch(`${baseUrl}/p/${pairSessionA.code}`);
    assert.strictEqual(scriptRead1.status, 200);
    assert.strictEqual(scriptRead2.status, 200);
    const scriptText = await scriptRead2.text();
    assert.ok(scriptText.includes('trap cleanup EXIT'), 'Script deve ter trap de limpeza das chaves');
    assert.ok(scriptText.includes('OCI_CS_USER_OCID'), 'Script deve checar contas federadas');
    assert.ok(scriptText.includes('Conectado! Pode voltar ao app.'), 'Script deve imprimir mensagem final');
    console.log('  ✓ Script bash inspecionável dentro do TTL com trap de limpeza validado.');

    // 5. Credenciais Invalidas Rejeitadas Sem Salvar Nada + Uso Unico do Codigo
    console.log('\n5. Verificando rejeição de credenciais inválidas (fingerprint errado e user inexistente) sem salvar nada:');
    const { privateKeyPem, fingerprint } = generateTestRsaKeyAndFingerprint();
    const parsedCheck = parsePrivateKeyAndComputeFingerprint(privateKeyPem);
    assert.strictEqual(parsedCheck.calculatedFingerprint, fingerprint);

    const wrongFingerprint =
      (fingerprint.startsWith('aa:') ? 'bb:' : 'aa:') + fingerprint.slice(3);

    // 5a) Conexao manual com fingerprint divergente -> 400 OCI_FINGERPRINT_MISMATCH
    const badFpRes = await fetch(`${baseUrl}/api/oci/accounts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenA}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenancyOcid: 'ocid1.tenancy.oc1..aaaaaaaafaketenancy000000000000000000000000',
        userOcid: 'ocid1.user.oc1..aaaaaaaafakeuser000000000000000000000000000',
        fingerprint: wrongFingerprint,
        region: 'sa-saopaulo-1',
        privateKeyPem,
      }),
    });
    assert.strictEqual(badFpRes.status, 400);
    const badFpJson = await badFpRes.json();
    assert.strictEqual(badFpJson.code, 'OCI_FINGERPRINT_MISMATCH');
    assert.ok(!JSON.stringify(badFpJson).includes('PRIVATE KEY'), 'Resposta nunca deve conter chave privada');
    console.log('  ✓ Fingerprint divergente rejeitado com 400 (OCI_FINGERPRINT_MISMATCH).');

    // 5b) Pareamento com usuario/tenancy inexistente na OCI (fingerprint confere com a chave RSA, mas conta nao existe na OCI)
    const fakePairSubmitRes = await fetch(`${baseUrl}/api/oci/pair/${pairSessionA.code}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenancyOcid: 'ocid1.tenancy.oc1..aaaaaaaainexistenttenancy000000000000000000',
        userOcid: 'ocid1.user.oc1..aaaaaaaainexistentuser000000000000000000000',
        fingerprint,
        region: 'sa-saopaulo-1',
        privateKeyPem,
      }),
    });
    assert.ok(
      [401, 404, 503].includes(fakePairSubmitRes.status),
      `Credencial OCI inexistente deve ser rejeitada pela validação assinada (recebido HTTP ${fakePairSubmitRes.status})`
    );
    const fakePairJson = await fakePairSubmitRes.json();
    assert.strictEqual(fakePairJson.success, false);
    console.log(
      `  ✓ Usuário/credencial inexistente na OCI rejeitado com HTTP ${fakePairSubmitRes.status} (${fakePairJson.code}).`
    );

    // 5c) Uso unico do codigo: tentar reutilizar o mesmo codigo deve falhar com 409 e GET /p/:codigo com 410
    const reuseRes = await fetch(`${baseUrl}/api/oci/pair/${pairSessionA.code}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenancyOcid: 'ocid1.tenancy.oc1..aaaaaaaainexistenttenancy000000000000000000',
        userOcid: 'ocid1.user.oc1..aaaaaaaainexistentuser000000000000000000000',
        fingerprint,
        region: 'sa-saopaulo-1',
        privateKeyPem,
      }),
    });
    assert.strictEqual(reuseRes.status, 409, 'Código de pareamento já usado deve retornar 409');
    const reuseJson = await reuseRes.json();
    assert.strictEqual(reuseJson.code, 'PAIRING_CODE_ALREADY_USED');

    const getUsedScriptRes = await fetch(`${baseUrl}/p/${pairSessionA.code}`);
    assert.strictEqual(getUsedScriptRes.status, 410, 'GET /p/:codigo consumido deve retornar 410');
    console.log('  ✓ Uso único do código de pareamento garantido (reuso bloqueado com 409/410).');

    // 5d) Confirmar que NADA foi salvo em cloud_accounts e OCI NAO aparece como conectada
    const accountsARes = await fetch(`${baseUrl}/api/oci/accounts`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const accountsA = await accountsARes.json();
    assert.strictEqual(
      accountsA.accounts.length,
      0,
      'Nenhuma conta deve ser salva após falhas de validação'
    );

    const statusARes = await fetch(`${baseUrl}/api/oci/status`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const statusA = await statusARes.json();
    assert.strictEqual(statusA.connected, false);
    assert.strictEqual(statusA.authMode, 'NONE');
    console.log('  ✓ Confirmado: zero contas salvas e authMode = NONE após credenciais inválidas.');

    // 6. Verificando fallback automático para Instance Principal quando a chave OCI recebe 401 na Tenancy da VM
    console.log('\n6. Verificando fallback automático para Instance Principal (Tenancy da VM):');
    const ociModule = require('./ociClient');
    assert.strictEqual(typeof ociModule.checkInstancePrincipalForTenancy, 'function', 'checkInstancePrincipalForTenancy deve ser exportada');
    assert.strictEqual(typeof ociModule.enableInstancePrincipalForAccount, 'function', 'enableInstancePrincipalForAccount deve ser exportada');

    // Cria nova sessão de pareamento para User A
    const pairRes2 = await fetch(`${baseUrl}/api/oci/pairing`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenA}` },
    });
    const pairSession2 = await pairRes2.json();
    assert.strictEqual(pairRes2.status, 201);

    // Simula a correspondência do Instance Principal para a tenancy da VM de teste
    const vmTenancy = 'ocid1.tenancy.oc1..aaaaaaaavmtenancytest000000000000000000';
    const originalCheck = ociModule.checkInstancePrincipalForTenancy;
    ociModule.checkInstancePrincipalForTenancy = async (targetTenancy, region) => {
      if (targetTenancy === vmTenancy) {
        return {
          available: true,
          matches: true,
          tenancyOcid: vmTenancy,
          tenancyName: 'Tenancy Real da VM (Demo & Fallback)',
          region: region || 'sa-saopaulo-1',
          provider: {},
        };
      }
      return { available: false, matches: false };
    };

    try {
      // Submete credenciais apontando para a Tenancy da VM (rejeitadas pela OCI real com 401, mas aprovadas pelo fallback!)
      const fallbackPairRes = await fetch(`${baseUrl}/api/oci/pair/${pairSession2.code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenancyOcid: vmTenancy,
          userOcid: 'ocid1.user.oc1..aaaaaaaafakeuser000000000000000000000000000',
          fingerprint,
          region: 'sa-saopaulo-1',
          privateKeyPem,
        }),
      });

      assert.strictEqual(fallbackPairRes.status, 200, 'Pareamento deve retornar 200 aprovado via fallback');
      const fallbackJson = await fallbackPairRes.json();
      assert.strictEqual(fallbackJson.success, true);
      assert.strictEqual(fallbackJson.mode, 'instance_principal_fallback');
      console.log('  ✓ Pareamento aprovado com HTTP 200 { success: true, mode: "instance_principal_fallback" }.');

      // Verifica que a sessão foi marcada como COMPLETED
      const statusCheckRes = await fetch(`${baseUrl}/api/oci/pairing/${pairSession2.id}/status`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const statusCheckJson = await statusCheckRes.json();
      assert.strictEqual(statusCheckJson.status, 'COMPLETED');
      assert.strictEqual(statusCheckJson.completed, true);
      console.log('  ✓ Sessão marcada como COMPLETED e status.completed = true.');

      // Verifica que a conta foi salva com authMode INSTANCE_PRINCIPAL
      const accountsCheckRes = await fetch(`${baseUrl}/api/oci/accounts`, {
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      const accountsCheckJson = await accountsCheckRes.json();
      assert.strictEqual(accountsCheckJson.accounts.length, 1);
      assert.strictEqual(accountsCheckJson.accounts[0].authMode, 'INSTANCE_PRINCIPAL');
      console.log('  ✓ Conta persistida com authMode INSTANCE_PRINCIPAL e useInstancePrincipal.');
    } finally {
      ociModule.checkInstancePrincipalForTenancy = originalCheck;
    }

    console.log('\n==============================================================');
    console.log('✅ TODOS OS TESTES DE SEGURANÇA E OCI SDK PASSARAM COM SUCESSO!');
    console.log('==============================================================\n');
  } finally {
    await new Promise((resolve) => server.close(resolve));

    if (usingRealPostgres && createdUserIds.length > 0) {
      await dbModule.pool
        .query('DELETE FROM master_users WHERE id = ANY($1::varchar[]);', [createdUserIds])
        .catch(() => {});
      await dbModule.pool.end().catch(() => {});
    }
  }
}

runTests().catch((err) => {
  console.error('\n❌ FALHA NA SUITE test-oci.js:', err);
  process.exit(1);
});

