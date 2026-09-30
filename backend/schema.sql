-- Executar como postgres na VM:
CREATE USER cloudwatch_user WITH ENCRYPTED PASSWORD 'CloudWatch2024#Secure';
CREATE DATABASE cloudwatch_db OWNER cloudwatch_user;

\c cloudwatch_db;

-- 1. Tabela de Operadores (Master Users)
CREATE TABLE IF NOT EXISTS master_users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP WITH TIME ZONE
);

-- 2. Tabela de Vinculo de Contas de Nuvem (1:N)
CREATE TABLE IF NOT EXISTS cloud_accounts (
  id VARCHAR(64) PRIMARY KEY,
  master_user_id VARCHAR(64) NOT NULL REFERENCES master_users(id) ON DELETE CASCADE,
  provider VARCHAR(10) NOT NULL CHECK (provider IN ('OCI', 'AWS', 'GCP')),
  account_identifier VARCHAR(255) NOT NULL,
  region VARCHAR(50) NOT NULL,
  credentials_encrypted TEXT NOT NULL,
  biometrics_enabled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (master_user_id, provider)
);

-- 3. Tabela de Recursos e Telemetria
CREATE TABLE IF NOT EXISTS instances_cache (
  id VARCHAR(120) PRIMARY KEY,
  master_user_id VARCHAR(64) REFERENCES master_users(id) ON DELETE CASCADE,
  provider VARCHAR(10) NOT NULL,
  name VARCHAR(150) NOT NULL,
  shape VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL,
  cpu_usage NUMERIC(5,2) DEFAULT 0.00,
  memory_usage NUMERIC(5,2) DEFAULT 0.00,
  private_ip VARCHAR(45),
  region VARCHAR(50) NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
