import express, { Request, Response } from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { pool } from './db';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Helper para hash simples SHA-256
const hashPassword = (password: string): string => {
  return crypto.createHash('sha256').update(password).digest('hex');
};

/**
 * Health check
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'HEALTHY',
    service: 'cloudwatch-bff',
    timestamp: new Date().toISOString(),
  });
});

/**
 * 1. POST /api/auth/register
 * Recebe { username, email, password }, grava em master_users e retorna o token de sessao.
 */
app.post('/api/auth/register', async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Informe usuario, e-mail e senha para prosseguir.',
      });
    }

    const userId = `usr-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;
    const passwordHash = hashPassword(password);

    const query = `
      INSERT INTO master_users (id, username, email, password_hash, created_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (username) DO UPDATE
      SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash
      RETURNING id, username, email, created_at;
    `;

    const result = await pool.query(query, [
      userId,
      username.trim(),
      email.trim().toLowerCase(),
      passwordHash,
    ]);

    const user = result.rows[0];
    const sessionToken = `token_${crypto.randomBytes(24).toString('hex')}`;

    return res.status(201).json({
      success: true,
      token: sessionToken,
      user,
    });
  } catch (err: any) {
    console.error('Erro em /api/auth/register:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Falha ao registrar usuario mestre.',
    });
  }
});

/**
 * 2. POST /api/auth/login
 * Valida credenciais e retorna status e perfil do usuario.
 */
app.post('/api/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'Informe usuario e senha mestre.',
      });
    }

    const passwordHash = hashPassword(password);

    const query = `
      SELECT id, username, email, created_at, password_hash
      FROM master_users
      WHERE (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1))
      LIMIT 1;
    `;

    const result = await pool.query(query, [username.trim()]);

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais invalidas. Usuario nao cadastrado.',
      });
    }

    const user = result.rows[0];
    if (user.password_hash !== passwordHash) {
      return res.status(401).json({
        success: false,
        error: 'Credenciais invalidas. Senha incorreta.',
      });
    }

    await pool.query('UPDATE master_users SET last_login = NOW() WHERE id = $1', [user.id]);

    const sessionToken = `token_${crypto.randomBytes(24).toString('hex')}`;

    return res.json({
      success: true,
      token: sessionToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        created_at: user.created_at,
      },
    });
  } catch (err: any) {
    console.error('Erro em /api/auth/login:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Falha ao autenticar usuario.',
    });
  }
});

/**
 * 3. POST /api/cloud/link
 * Salva credenciais do provedor em cloud_accounts.
 */
app.post('/api/cloud/link', async (req: Request, res: Response) => {
  try {
    const {
      masterUserId,
      provider,
      accountIdentifier,
      region,
      credentialsEncrypted,
      biometricsEnabled,
    } = req.body;

    if (!masterUserId || !provider || !accountIdentifier) {
      return res.status(400).json({
        success: false,
        error: 'Parametros insuficientes para vinculo de nuvem.',
      });
    }

    const id = `cld-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`;

    const query = `
      INSERT INTO cloud_accounts (
        id, master_user_id, provider, account_identifier, region,
        credentials_encrypted, biometrics_enabled, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
      ON CONFLICT (master_user_id, provider) DO UPDATE
      SET account_identifier = EXCLUDED.account_identifier,
          region = EXCLUDED.region,
          credentials_encrypted = EXCLUDED.credentials_encrypted,
          biometrics_enabled = EXCLUDED.biometrics_enabled
      RETURNING *;
    `;

    const result = await pool.query(query, [
      id,
      masterUserId,
      provider,
      accountIdentifier,
      region || 'sa-saopaulo-1',
      credentialsEncrypted || '{}',
      !!biometricsEnabled,
    ]);

    return res.json({
      success: true,
      message: `Provedor ${provider} registrado com sucesso na base relacional.`,
      account: result.rows[0],
    });
  } catch (err: any) {
    console.error('Erro em /api/cloud/link:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Falha ao registrar provedor de nuvem.',
    });
  }
});

/**
 * 4. GET /api/instances
 * Retorna as instancias cadastradas com metricas.
 */
app.get('/api/instances', async (req: Request, res: Response) => {
  try {
    const { masterUserId, provider } = req.query;

    let query = 'SELECT * FROM instances_cache';
    const params: any[] = [];

    if (masterUserId && provider) {
      query += ' WHERE master_user_id = $1 AND provider = $2';
      params.push(masterUserId, provider);
    } else if (masterUserId) {
      query += ' WHERE master_user_id = $1';
      params.push(masterUserId);
    } else if (provider) {
      query += ' WHERE provider = $1';
      params.push(provider);
    }

    query += ' ORDER BY last_updated DESC;';

    const result = await pool.query(query, params);

    // Se nao houver registros no cache, retorna lista default simulada
    if (result.rows.length === 0) {
      const defaultInstances = [
        {
          id: 'res-oci-core-01',
          provider: 'OCI',
          name: 'OCI - VM.Standard.A1.Flex',
          shape: 'VM.Standard.A1.Flex',
          status: 'RUNNING',
          cpu_usage: 24.5,
          memory_usage: 48.0,
          private_ip: '10.0.1.15',
          region: 'sa-saopaulo-1',
          last_updated: new Date().toISOString(),
        },
        {
          id: 'res-oci-db-01',
          provider: 'OCI',
          name: 'OCI - Autonomous DB (ATP)',
          shape: 'Autonomous Database',
          status: 'RUNNING',
          cpu_usage: 12.0,
          memory_usage: 32.0,
          private_ip: '10.0.2.80',
          region: 'sa-saopaulo-1',
          last_updated: new Date().toISOString(),
        },
      ];

      return res.json({
        success: true,
        instances: defaultInstances,
      });
    }

    return res.json({
      success: true,
      instances: result.rows,
    });
  } catch (err: any) {
    console.error('Erro em /api/instances:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Falha ao buscar instancias.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Micro-BFF CloudWatch rodando na porta ${PORT}`);
});
