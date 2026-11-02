# Instruções de Implantação e Atualização na VM OCI (167.234.241.171)

Este guia contém as instruções prontas para o desenvolvedor implantar o banco de dados PostgreSQL isolado e atualizar o serviço BFF para a **Sprint 2** na máquina Oracle Cloud (Oracle Linux ARM / Ampere A1).

---

## 1. Conectar na VM OCI via SSH
```bash
ssh -i ~/.oci/oci_api_key.pem opc@167.234.241.171
```

---

## 2. Banco de Dados PostgreSQL (`cloudwatch_db`)
Caso ainda não tenha criado a base dedicada:
```bash
sudo -u postgres psql -c "CREATE USER cloudwatch_user WITH ENCRYPTED PASSWORD 'CloudWatch2024#Secure';"
sudo -u postgres psql -c "CREATE DATABASE cloudwatch_db OWNER cloudwatch_user;"
```

> **Sincronização Automática:** As tabelas (`users`, `master_users`, `cloud_accounts`, `instances` e `instances_cache`) são criadas e sincronizadas automaticamente pelo `cloudwatch-bff` no startup através da função `initDatabase()`.

---

## 3. Atualizar o BFF para a Sprint 2 (`cloudwatch-bff/`)
O BFF da Sprint 2 inclui assinador OCI RSA-SHA256 nativo, sondagem de rede estilo Zabbix (`/api/telemetry/network-probe`), inspeção Docker (`/api/telemetry/containers`), telemetria real do host OCI (`os.loadavg()`, `os.freemem()`), endpoints de série temporal e Logs Insights:

```bash
# Navegar até a pasta do BFF
cd ~/cloudwatch-bff

# Instalar dependências (inclui bcryptjs, pg, cors, dotenv, express)
npm install

# Iniciar ou recarregar o processo padronizado com PM2
pm2 describe cloudwatch-api > /dev/null 2>&1 && pm2 restart cloudwatch-api || pm2 start index.js --name "cloudwatch-api"
pm2 save
```

Para verificar os logs de execução em tempo real:
```bash
pm2 logs cloudwatch-api --lines 50
```

---

## 4. Firewall da VM (Porta 3000)
Certifique-se de liberar o tráfego de entrada na porta 3000 no Oracle Linux (firewalld):
```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

---

## 5. Teste Rápido de Verificação dos Endpoints Sprint 2
```bash
# 1. Healthcheck e métricas de host OCI:
curl -s http://localhost:3000/health | jq .

# 2. Instâncias e recursos da conta OCI:
curl -s "http://localhost:3000/api/clouds/instances?provider=OCI" | jq .

# 3. Sondagem de rede estilo Zabbix por IP real (Portas 22, 80, 443, 3000, 5432):
curl -s "http://localhost:3000/api/telemetry/network-probe?host=167.234.241.171" | jq .

# 4. Containers Docker ativos no host:
curl -s "http://localhost:3000/api/telemetry/containers" | jq .

# 5. Série temporal para correlação CPU x Memória (janela 24h):
curl -s "http://localhost:3000/api/telemetry/metrics/res-oci-sidebrain-prd?window=24h" | jq .

# 6. Logs centralizados operacionais:
curl -s "http://localhost:3000/api/telemetry/logs/res-oci-sidebrain-prd?severity=ALL" | jq .
```

> **Garantia de Resiliência (Offline-First):** O aplicativo mobile foi projetado com fallback automático (`telemetryRepository.ts`). Caso a máquina OCI esteja temporariamente inacessível ou em manutenção, o aplicativo recorre de forma transparente ao cache local criptografado (`EncryptedStorage` e `AsyncStorage`), garantindo funcionamento ininterrupto para a apresentação da banca.
