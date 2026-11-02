/**
 * Conexao com o PostgreSQL cloudwatch_db na Oracle Cloud (OCI)
 */
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'cloudwatch_db',
  user: process.env.DB_USER || 'cloudwatch_user',
  password: process.env.DB_PASSWORD || 'CloudWatch2024#Secure',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[PostgreSQL] Erro inesperado no pool de conexoes:', err.message);
});

module.exports = { pool };

