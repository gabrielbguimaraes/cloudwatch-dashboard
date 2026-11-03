/**
 * Conexao com o PostgreSQL (cloudwatch_db)
 * Seguranca: nenhum segredo hardcoded. Todas as credenciais vem de variaveis de ambiente (.env).
 */
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '.env') });

if (!process.env.DB_PASSWORD) {
  console.warn(
    '[PostgreSQL] AVISO: DB_PASSWORD nao definida no ambiente (.env). Verifique a configuracao do BFF.'
  );
}

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'cloudwatch_db',
  user: process.env.DB_USER || 'cloudwatch_user',
  password: process.env.DB_PASSWORD,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Erro inesperado no pool de conexoes:', err.message);
});

module.exports = { pool };
