# CloudWatch Mobile Dashboard

Aplicativo Android multiusuário (**1:N**) desenvolvido em **React Native + TypeScript** com **Backend-for-Frontend (BFF) em Node.js/Express + PostgreSQL**, voltado ao monitoramento real e seguro de infraestrutura em **Oracle Cloud Infrastructure (OCI)** utilizando o **SDK Oficial da Oracle (`oci-*`)**.

Na **Sprint 2**, toda a camada de dados simulados foi **desativada e desconectada da interface**, substituindo mocks estáticos e geradores sintéticos por autenticação JWT real com rotação de refresh token, vínculo criptografado de contas OCI por usuário (via pareamento automatizado no OCI Cloud Shell ou configuração manual validada) e telemetria real extraída dos serviços **OCI Resource Search**, **Compute**, **Virtual Network**, **Monitoring (`oci_computeagent`)** e **Audit**.

---

## 🏗️ Arquitetura Real (Sprint 2 — Multiusuário 1:N)

Cada usuário possui sua própria conta no aplicativo e conecta **zero, uma ou múltiplas contas OCI** de forma independente e isolada. Entrar no aplicativo não exige conectar nenhuma nuvem previamente; o usuário visualiza exclusivamente os provedores e recursos que ele mesmo vinculou.

```
┌───────────────────────────────────────────────────────────────────────────────┐
│                     APP ANDROID (React Native 0.74 + TS)                      │
│  ┌─────────────────────┐  ┌────────────────────────┐  ┌─────────────────────┐ │
│  │ Auth & Onboarding   │  │    DashboardScreen     │  │ MetricsDetailScreen │ │
│  │ • Login / Cadastro  │  │ • Somente VMs reais    │  │ • Séries 1h/24h/7d  │ │
│  │ • Stepper OCI Shell │  │ • Badge LIVE / CACHE   │  │ • OCI Audit Events  │ │
│  └──────────┬──────────┘  └───────────┬────────────┘  └──────────┬──────────┘ │
│             ▼                         ▼                          ▼            │
│  ┌────────────────────────────────────┐  ┌──────────────────────────────────┐ │
│  │ apiClient + react-native-keychain  │  │ telemetryRepository (Offline 1st)│ │
│  │ • Bearer JWT (15 min)              │  │ • source: 'LIVE_OCI' | 'CACHE'   │ │
│  │ • Auto-refresh único em HTTP 401   │  │ • Cache isolado por userId       │ │
│  │ • Zero chave .pem ou senha no app  │  │ • Banner "Dados em cache HH:mm"  │ │
│  └──────────────────┬─────────────────┘  └─────────────────┬────────────────┘ │
└─────────────────────┼──────────────────────────────────────┼──────────────────┘
                      │          HTTPS / REST (TLS)          │
                      ▼                                      ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                 CLOUDWATCH BFF (Node.js + Express + PostgreSQL)               │
│  • Segurança HTTP: helmet, CORS restrito, zod, express-rate-limit             │
│  • Sessão: JWT (15m, sub=userId) + Refresh Token rotativo (hash SHA-256, 7d)  │
│  • Pareamento Cloud Shell: código aleatório (12 chars, TTL 10m, uso único)    │
│  • Validação OCI obrigatória: formato OCID + MD5 SPKI DER + IdentityClient    │
│  • Cofre em repouso: credenciais OCI cifradas com AES-256-GCM (IV por conta)  │
└───────────────────────────────────────┬───────────────────────────────────────┘
                                        │ SDK Oficial Oracle Cloud (oci-*)
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                      ORACLE CLOUD INFRASTRUCTURE (OCI)                        │
│  • IdentityClient       -> Validação real de User/Tenancy e Regiões           │
│  • ResourceSearchClient -> Descoberta de instâncias em todos os compartimentos│
│  • Compute & Vnic       -> Shape, OCPUs, RAM, lifecycleState e IPs reais      │
│  • MonitoringClient     -> CpuUtilization & MemoryUtilization (MQL)           │
│  • AuditClient          -> Eventos reais de auditoria com busca/severidade    │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔒 Segurança, Privacidade e Mudanças Estruturais da Sprint 2

1. **Fim do Armazenamento de Senhas e Chaves Privadas no Celular:**
   - O aplicativo armazena exclusivamente `accessToken` e `refreshToken` no hardware seguro (`react-native-keychain` / Android Keystore), com suporte a desbloqueio biométrico para renovação real da sessão no BFF.
   - Chaves privadas RSA (`.pem`) **nunca são salvas no celular**, **nunca são registradas em logs** e **nunca retornam em respostas HTTP**. No fluxo manual, o campo `.pem` é limpo do estado da interface imediatamente após o envio HTTPS ao BFF.
2. **Pareamento por Comando no OCI Cloud Shell (Substituição do QR Code):**
   - O antigo leitor de QR Code (`Plain Text`) da Sprint 1 foi removido dos fluxos de autenticação e substituído por pareamento criptográfico via **OCI Cloud Shell** (`curl -fsSL <PUBLIC_BASE_URL>/p/<codigo> | bash`).
   - O script executado no Cloud Shell do próprio usuário gera um par RSA 2048 exclusivo para o app, cadastra a chave pública via OCI CLI, transmite os dados por HTTPS usando o código de uso único (expiração de 10 minutos) e **apaga os arquivos temporários locais via `trap` mesmo em caso de erro**.
   - Contas federadas (Identity Domains) ou usuários sem acesso ao Cloud Shell contam com a opção **"Prefiro conectar manualmente"**, que interpreta diretamente o bloco `[DEFAULT]` do `~/.oci/config` + chave `.pem`.
3. **Verificação Criptográfica e Remota Antes de Persistir (`validateOciCredentials`):**
   - Nenhuma conta OCI é salva sem antes validar: formato dos OCIDs e região oficial, integridade da chave privada RSA e igualdade exata do fingerprint MD5 calculado sobre o SPKI DER, seguida de chamada assinada real a `IdentityClient.getUser` e `IdentityClient.getTenancy`. Credenciais inválidas ou inexistentes são recusadas sem gravar nada no banco.
4. **Simulação Desativada (`Zero Fake Data`):**
   - O arquivo `src/services/simulationService.ts`, o modal `SerialConsoleModal.tsx` e a dependência `@faker-js/faker` permanecem no repositório apenas isolados e **100% desligados** de qualquer tela, contexto ou repositório de dados.
   - Toda resposta de telemetria possui estritamente `source: 'LIVE_OCI'` ou `source: 'CACHE'`. Quando o plugin `Compute Instance Monitoring` está desativado em uma VM ou não há dados no período, a interface exibe um estado vazio honesto com orientações de configuração, sem inventar curvas ou números.
5. **Proteção Anti-SSRF na Sondagem de Rede:**
   - O endpoint `GET /api/telemetry/network-probe` exige autenticação JWT e só permite testar conectividade TCP em endereços IP que comprovadamente pertençam às instâncias OCI reais da conta do usuário autenticado.

---

## 📋 Status Honesto do Product Backlog (US01 a US18)

### Sprint 1 — Fundação Mobile & Hardware Nativo

| ID | História de Usuário | Status Atual (Pós-Refatoração Sprint 2) |
| :---: | :--- | :--- |
| **US01** | Acesso seguro ao aplicativo com biometria nativa vinculada ao `react-native-keychain` | **Concluído** *(evoluído na Sprint 2 para JWT + Refresh Token rotativo, sem senha local)* |
| **US02** | Importação rápida de credenciais corporativas OCI sem digitação manual de OCIDs | **Substituído na Sprint 2** *(QR Code removido; substituído por Pareamento via Comando no OCI Cloud Shell + parser `~/.oci/config`)* |
| **US03** | Sugestão contextual de datacenter próximo via localização GPS nativa Android | **Concluído** |
| **US04** | Validação rigorosa de estrutura e conformidade dos identificadores OCI | **Concluído** *(evoluído na Sprint 2 com validação criptográfica RSA/Fingerprint + `IdentityClient` ao vivo)* |
| **US05** | Semáforo visual de integridade para classificação rápida da saúde das instâncias | **Concluído** *(alimentado exclusivamente por métricas reais da OCI na Sprint 2)* |
| **US06** | Provisionamento interativo simulado de servidores no painel | **Desativado na Sprint 2** *(ocultado da interface; o app lista apenas VMs reais da tenancy conectada)* |
| **US07** | Fixação (Pin) de servidores prioritários no topo do painel | **Concluído** *(isolado por usuário em `@cloudwatch:pinned_resources:<userId>`)* |
| **US08** | Exportação e compartilhamento de relatório operacional em PDF nativo Android | **Concluído** *(gerado apenas com dados reais ou `N/D` quando não há métrica coletada)* |

### Sprint 2 — Autenticação Real, Multiusuário e Telemetria Oficial OCI

| ID | História de Usuário | Status Atual |
| :---: | :--- | :--- |
| **US09** | Vínculo multiusuário (1:N) de contas OCI com pareamento via Cloud Shell, validação real e criptografia AES-256-GCM no PostgreSQL | **Concluído** |
| **US10** | Descoberta e listagem real das VMs da conta OCI (shape, OCPUs, memória, estado e IPs público/privado) em todos os compartimentos | **Concluído** |
| **US11** | Extração real de séries temporais de CPU e Memória via OCI Monitoring (`oci_computeagent` / MQL) | **Concluído** |
| **US12** | Gráficos por janela (`1h`, `24h`, `7d`) com análise de correlação CPU × Memória e modo Offline-First (`LIVE` / `CACHE`) | **Concluído** |
| **US13** | Central de eventos reais via OCI Audit API (`ListEvents`) com filtro por severidade e busca textual | **Concluído** |

### Sprint 3 — Multi-Cloud Expandido, Ações Remotas e Alertas *(Não implementado nesta Sprint)*

| ID | História de Usuário | Status Atual |
| :---: | :--- | :--- |
| **US14** | Integração real com contas Amazon Web Services (AWS) | **Backlog (Sprint 3)** — *exibido como "Em breve" na UI* |
| **US15** | Integração real com contas Google Cloud Platform (GCP) | **Backlog (Sprint 3)** — *exibido como "Em breve" na UI* |
| **US16** | Ações remotas reais de ciclo de vida (iniciar, parar e reiniciar VMs na OCI/AWS/GCP) | **Backlog (Sprint 3)** — *ocultado da UI na Sprint 2* |
| **US17** | Regras de alerta configuráveis e notificações push em segundo plano | **Backlog (Sprint 3)** |
| **US18** | Console serial real, autenticação em dois fatores (2FA TOTP) e relatórios consolidados de SLA multi-cloud | **Backlog (Sprint 3)** |

---

## 🚀 Como Configurar e Executar

### 1. Backend BFF (`cloudwatch-bff/`)

1. Copie o arquivo de exemplo de variáveis de ambiente e preencha os segredos reais:
   ```bash
   cd cloudwatch-bff
   cp .env.example .env
   ```
   - Gere `JWT_ACCESS_SECRET` e `CREDENTIALS_ENC_KEY` (exatamente 64 caracteres hexadecimais = 32 bytes para AES-256-GCM):
     ```bash
     node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
     ```
   - Em produção, `PUBLIC_BASE_URL` **deve** utilizar `https://` (veja [`docs/DEPLOY_HTTPS.md`](docs/DEPLOY_HTTPS.md)). `http://` só é aceito quando `NODE_ENV=development`.

2. Instale as dependências e inicie o servidor:
   ```bash
   npm install
   npm start
   ```

3. Execute a suíte de validação de segurança, criptografia OCI e isolamento multiusuário:
   ```bash
   node test-oci.js
   ```

### 2. Aplicativo Android (Raiz do Projeto)

1. Copie `.env.example` para `.env` (documentação de build) e instale as dependências:
   ```bash
   npm install
   ```
2. Valide a tipagem estática TypeScript:
   ```bash
   npx tsc --noEmit
   ```
3. Inicie o Metro Bundler e execute no dispositivo/emulador Android:
   ```bash
   npm start
   npm run android
   ```

---

## 📚 Documentação Operacional Adicional

- **[`docs/OCI_SETUP.md`](docs/OCI_SETUP.md):** Guia passo a passo no console da Oracle Cloud (Dynamic Group do dono da VM, policies IAM de leitura, ativação do plugin `Compute Instance Monitoring`, criação de usuário somente leitura, revogação da chave de API do app e troubleshooting de erros `401`/`403`, limite de 3 chaves e contas federadas).
- **[`docs/DEPLOY_HTTPS.md`](docs/DEPLOY_HTTPS.md):** Configuração de domínio DNS, proxy reverso HTTPS com Let's Encrypt (Caddy ou Nginx + Certbot) na porta `443`, regras de firewall/VCN na OCI, variáveis de ambiente de produção do BFF e preparação para SSL Pinning.
