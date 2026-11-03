# Implantação HTTPS em Produção (BFF na Oracle Cloud + App Android)

> **Atenção:** este guia genérico instala um Caddy/Nginx novo no host. Na VM `vnic-sidebrain-prd` a porta 80 já é usada pelo container `sidebrain_proxy` (Caddy), então instalar outro no host gera conflito. Para essa VM siga a Fase 5 de [`PLANO_PRODUCAO_OCI_REAL.md`](PLANO_PRODUCAO_OCI_REAL.md).

O uso de **HTTPS (TLS 1.2/1.3)** na porta `443` é um **pré-requisito obrigatório** para operar o CloudWatch Dashboard fora de ambiente local de desenvolvimento (`NODE_ENV=development`):

1. **Segurança do Pareamento via OCI Cloud Shell:** O comando `curl -fsSL https://<SEU_DOMINIO>/p/<codigo> | bash` baixa o script de pareamento e envia a chave privada RSA dedicada para `/api/oci/pair/<codigo>`. Sem TLS válido, o BFF recusa criar sessões de pareamento (`HTTPS_REQUIRED_FOR_PAIRING`) para impedir interceptação (MITM).
2. **Release Android sem Cleartext:** O manifesto principal do Android não habilita tráfego HTTP em texto puro, e `src/config/env.ts` bloqueia URLs `http://` em builds de release (`!__DEV__`).

---

## 1. Configurar o Domínio DNS

1. No console da OCI (**Networking > Virtual Cloud Networks > IP Administration > Reserved Public IPs**), garanta que a VM do BFF possua um **IPv4 Público Reservado** (fixo).
2. No seu provedor de DNS (Cloudflare em modo *DNS Only / nuvem cinza*, Route53, Registro.br ou serviço DDNS como DuckDNS), crie um registro do tipo **`A`**:
   - **Nome / Host:** `api.cloudwatch` (resultando em `api.cloudwatch.seudominio.com`)
   - **Valor:** `<IP_PUBLICO_RESERVADO_DA_VM>`
   - **TTL:** `300` segundos

Teste a propagação antes de emitir o certificado:
```bash
dig +short api.cloudwatch.seudominio.com
```

---

## 2. Regras de Rede (OCI VCN + Firewall do Oracle Linux)

Em produção, o Node.js escuta apenas em `127.0.0.1:3000` (loopback interno) e **somente o proxy reverso** recebe conexões externas nas portas `80` (desafio ACME Let's Encrypt + redirecionamento HTTPS) e `443` (HTTPS).

### 2.1. Security List ou NSG na Console da OCI
Em **Networking > Virtual Cloud Networks > Sua VCN > Sub-rede Pública > Security List**, mantenha abertas para `0.0.0.0/0` apenas:
- **TCP `443`** — HTTPS (API do BFF e rotas `/p/:codigo`)
- **TCP `80`** — HTTP (validação automática HTTP-01 do Let's Encrypt e redirect 301)
- **TCP `22`** — SSH (preferencialmente restrito ao seu IP administrativo)

> **Importante:** Remova qualquer regra de entrada pública para a porta **TCP `3000`** na Security List da OCI.

### 2.2. Firewall Interno da VM (`firewalld` no Oracle Linux 8/9)
Conectado via SSH (`opc@<IP_PUBLICO_DA_VM>`):
```bash
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --permanent --remove-port=3000/tcp || true
sudo firewall-cmd --reload
sudo firewall-cmd --list-all
```

---

## 3. Proxy Reverso com Certificado Let's Encrypt

Escolha **uma** das duas opções abaixo (Caddy ou Nginx + Certbot).

### Opção A (Recomendada): Caddy Server (TLS Automático)

O Caddy provisiona e renova certificados Let's Encrypt automaticamente sem necessidade de cronjobs externos.

1. **Instalar o Caddy no Oracle Linux 8/9 (ARM64 / x86_64):**
   ```bash
   sudo dnf install -y 'dnf-command(copr)'
   sudo dnf copr enable -y @caddy/caddy
   sudo dnf install -y caddy
   ```

2. **Configurar `/etc/caddy/Caddyfile`:**
   ```caddyfile
   api.cloudwatch.seudominio.com {
       encode zstd gzip

       header {
           Strict-Transport-Security "max-age=31536000; includeSubDomains"
           X-Content-Type-Options "nosniff"
           X-Frame-Options "DENY"
           -Server
       }

       request_body {
           max_size 64KB
       }

       reverse_proxy 127.0.0.1:3000
   }
   ```

3. **Habilitar e iniciar o serviço:**
   ```bash
   sudo caddy validate --config /etc/caddy/Caddyfile
   sudo systemctl enable --now caddy
   sudo systemctl status caddy
   ```

---

### Opção B: Nginx + Certbot (Let's Encrypt)

1. **Instalar Nginx e Certbot no Oracle Linux 8/9:**
   ```bash
   sudo dnf install -y oracle-epel-release-el9 || sudo dnf install -y oracle-epel-release-el8
   sudo dnf install -y nginx certbot python3-certbot-nginx
   sudo systemctl enable --now nginx
   ```
   Permitir que o SELinux autorize o Nginx a conectar no loopback local `127.0.0.1:3000`:
   ```bash
   sudo setsebool -P httpd_can_network_connect 1
   ```

2. **Criar `/etc/nginx/conf.d/cloudwatch-bff.conf`:**
   ```nginx
   server {
       listen 80;
       listen [::]:80;
       server_name api.cloudwatch.seudominio.com;

       client_max_body_size 64k;

       location / {
           proxy_pass http://127.0.0.1:3000;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_read_timeout 30s;
       }
   }
   ```

3. **Validar Nginx e emitir o certificado TLS com redirecionamento HTTPS:**
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d api.cloudwatch.seudominio.com --redirect -m seu-email@seudominio.com --agree-tos -n
   sudo systemctl enable --now certbot-renew.timer
   ```

---

## 4. Variáveis de Ambiente do BFF (`cloudwatch-bff/.env`)

O BFF já está configurado com `app.set('trust proxy', 1)` para respeitar o IP real do cliente encaminhado pelo Caddy/Nginx no `express-rate-limit`.

Crie o arquivo `~/cloudwatch-bff/.env` na VM com permissões restritas (`chmod 600 .env`):

```dotenv
PORT=3000
BIND_HOST=127.0.0.1
NODE_ENV=production

# Obrigatoriamente com https:// e sem barra final
PUBLIC_BASE_URL=https://api.cloudwatch.seudominio.com

# PostgreSQL local da VM
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=cloudwatch_db
DB_USER=cloudwatch_user
DB_PASSWORD=<SENHA_FORTE_DO_POSTGRES>

# Segredo JWT (>= 32 caracteres aleatorios)
JWT_ACCESS_SECRET=<GERAR_COM_CRYPTO_RANDOMBYTES_48_HEX>
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_TTL_DAYS=7

# Chave AES-256-GCM para criptografar credenciais OCI no banco (EXATAMENTE 64 caracteres hex = 32 bytes)
CREDENTIALS_ENC_KEY=<GERAR_COM_CRYPTO_RANDOMBYTES_32_HEX>

# Deixe vazio se apenas o app Android consumir a API (bloqueia origens de navegadores)
CORS_ORIGINS=

# Username no app pertencente ao administrador dono da VM OCI (para Instance Principal demo)
OWNER_USERNAME=<SEU_USERNAME_NO_APP>
```

### Comandos para gerar os segredos na VM:
```bash
# JWT_ACCESS_SECRET (96 chars hex):
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# CREDENTIALS_ENC_KEY (64 chars hex = 32 bytes exatos para AES-256-GCM):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Reiniciar o BFF no PM2 e testar HTTPS:
```bash
cd ~/cloudwatch-bff
chmod 600 .env
npm ci --omit=dev
pm2 describe cloudwatch-api > /dev/null 2>&1 && pm2 restart cloudwatch-api --update-env || pm2 start index.js --name "cloudwatch-api"
pm2 save

curl -fsSL https://api.cloudwatch.seudominio.com/health
```

---

## 5. Build de Release do Aplicativo Android

Antes de empacotar o bundle JS ou gerar o APK de release, crie o arquivo `.env` na raiz do projeto mobile (`cloudwatch-dashboard/.env`, ignorado pelo Git):

```dotenv
CLOUDWATCH_PUBLIC_BASE_URL=https://api.cloudwatch.seudominio.com
CLOUDWATCH_API_BASE_URL=https://api.cloudwatch.seudominio.com/api
```

O plugin inline em [`babel.config.js`](../babel.config.js) injeta apenas essas duas variáveis públicas no bundle durante a compilação. Caso o cache do Metro exista de um build anterior, limpe-o ao iniciar/empacotar:
```bash
npx react-native start --reset-cache
```

---

## 6. Preparação Futura para SSL Pinning (Stub Inativo)

O arquivo [`src/config/sslPinning.ts`](../src/config/sslPinning.ts) contém o ponto central de transporte (`performPinnedOrStandardFetch`) consumido por `src/services/apiClient.ts`, mantido **desativado (`enabled: false`)** por padrão para não bloquear trocas de domínio durante a implantação inicial.

Quando o domínio definitivo estiver estável em produção e você desejar ativar **Public Key Pinning (SPKI SHA-256)**:

1. Extraia o hash SHA-256 da chave pública do certificado atual do servidor:
   ```bash
   openssl s_client -servername api.cloudwatch.seudominio.com -connect api.cloudwatch.seudominio.com:443 < /dev/null 2>/dev/null \
     | openssl x509 -pubkey -noout \
     | openssl pkey -pubin -outform der \
     | openssl dgst -sha256 -binary | openssl enc -base64
   ```
2. Gere ou extraia obrigatoriamente um **segundo pin de backup** (por exemplo, o SPKI da autoridade intermediária Let's Encrypt ativa `E5`/`E6`/`R10`/`R11` ou de um par RSA reserva), evitando indisponibilidade do aplicativo a cada renovação de 90 dias do certificado ACME.
3. Preencha `hostname` e `spkiPinsSha256` em `src/config/sslPinning.ts` e conecte o adaptador de pinning escolhido conforme documentado no próprio arquivo.

