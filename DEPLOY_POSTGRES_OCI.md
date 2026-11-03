# Guia Rápido de Banco PostgreSQL e Processo PM2 na VM OCI

> **Atenção:** este guia genérico assume PostgreSQL instalado no host (`sudo -u postgres`). Na VM `vnic-sidebrain-prd` o PostgreSQL roda no container Docker `sidebrain_db`. Para essa VM siga [`docs/PLANO_PRODUCAO_OCI_REAL.md`](docs/PLANO_PRODUCAO_OCI_REAL.md).

Este guia resume a criação da base PostgreSQL e o gerenciamento do processo `cloudwatch-api` via PM2 em uma VM **Oracle Linux ARM (Ampere A1)** na Oracle Cloud Infrastructure.

Para a configuração completa de **HTTPS (TLS/Let's Encrypt na porta 443)** e **permissões IAM / Oracle Cloud Agent**, consulte os documentos oficiais da Fase 4:
- [`docs/DEPLOY_HTTPS.md`](docs/DEPLOY_HTTPS.md) — Domínio DNS, Caddy ou Nginx + Certbot, porta 443, variáveis `.env` do BFF e stub de SSL Pinning.
- [`docs/OCI_SETUP.md`](docs/OCI_SETUP.md) — Dynamic Group do dono, policies IAM, plugin `Compute Instance Monitoring`, usuário somente leitura, revogação da chave do app e troubleshooting.

---

## 1. Conectar na VM OCI via SSH
```bash
ssh -i ~/.ssh/<SUA_CHAVE_SSH> opc@<IP_PUBLICO_DA_VM>
```

---

## 2. Banco de Dados PostgreSQL (`cloudwatch_db`)
Caso ainda não tenha criado o usuário e a base dedicada:
```bash
sudo -u postgres psql -c "CREATE USER cloudwatch_user WITH ENCRYPTED PASSWORD '<SENHA_FORTE_DO_BANCO>';"
sudo -u postgres psql -c "CREATE DATABASE cloudwatch_db OWNER cloudwatch_user;"
```

> **Sincronização Automática (`initDatabase`):** No startup, o `cloudwatch-bff` garante automaticamente as tabelas `master_users`, `refresh_tokens` (apenas hashes SHA-256), `cloud_accounts` (credenciais OCI cifradas com AES-256-GCM) e `oci_pairing_sessions` (hashes SHA-256 de códigos de uso único com TTL de 10 minutos).

---

## 3. Configurar `.env` e Atualizar o Serviço (`cloudwatch-bff/`)
```bash
cd ~/cloudwatch-bff
cp -n .env.example .env
# Edite o arquivo .env preenchendo DB_PASSWORD, JWT_ACCESS_SECRET, CREDENTIALS_ENC_KEY e PUBLIC_BASE_URL (https://...)

npm install

pm2 describe cloudwatch-api > /dev/null 2>&1 && pm2 restart cloudwatch-api --update-env || pm2 start index.js --name "cloudwatch-api"
pm2 save
```

Logs em tempo real:
```bash
pm2 logs cloudwatch-api --lines 50
```

---

## 4. Verificação Local do BFF
Com `NODE_ENV=production` e `BIND_HOST=127.0.0.1`, o Node.js responde apenas localmente para o proxy reverso HTTPS (`:443`):
```bash
# 1. Healthcheck público:
curl -s http://127.0.0.1:3000/health | jq .

# 2. Verificar exigência de JWT nas rotas protegidas (deve retornar HTTP 401):
curl -i http://127.0.0.1:3000/api/oci/status
```
