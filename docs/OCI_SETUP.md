# Guia de Configuração Oracle Cloud Infrastructure (OCI)

Este documento detalha todos os passos necessários no console da **Oracle Cloud Infrastructure (OCI)** para:
1. Configurar o modo de demonstração (`INSTANCE_PRINCIPAL`) exclusivo do dono da VM do BFF;
2. Habilitar a coleta real de CPU e Memória nas VMs via **Oracle Cloud Agent**;
3. Criar um usuário/grupo **somente leitura** (menor privilégio) para conectar contas OCI ao aplicativo;
4. Revogar a chave de API do aplicativo a qualquer momento;
5. Diagnosticar e corrigir erros `401`, `403`, limite de 3 chaves de API e contas federadas.

---

## 1. Dynamic Group e Policies do Dono da VM (`INSTANCE_PRINCIPAL`)

> **Escopo de Segurança:** No BFF (`cloudwatch-bff/ociClient.js`), o provedor `InstancePrincipalsAuthenticationDetailsProviderBuilder` é bloqueado para todos os usuários do aplicativo, **exceto** para o username definido em `OWNER_USERNAME` no `.env` do servidor. Isso permite que o dono da VM demonstre a própria infraestrutura sem armazenar chaves `.pem` da tenancy hospedeira, mantendo isolamento total para os demais usuários.

### Passo 1.1 — Obter o OCID da VM onde o BFF roda
1. Acesse o console da OCI: **Compute > Instances**.
2. Clique na instância onde o `cloudwatch-bff` está hospedado.
3. Em **Instance information**, copie o **OCID** (`ocid1.instance.oc1...`).

### Passo 1.2 — Criar o Dynamic Group
1. No menu principal, acesse **Identity & Security > Domains > Default domain > Dynamic groups** *(ou **Identity > Dynamic Groups** em tenancies sem Identity Domains)*.
2. Clique em **Create dynamic group**:
   - **Name:** `CloudWatchBffVmGroup`
   - **Description:** `Permite leitura de telemetria OCI pela VM do CloudWatch BFF para o usuario dono`
3. Em **Matching rules**, adicione a regra abaixo substituindo pelo OCID real da VM do BFF:
   ```text
   ALL { instance.id = 'ocid1.instance.oc1.sa-saopaulo-1.<SUBSTITUA_PELO_OCID_DA_SUA_VM>' }
   ```
4. Salve o Dynamic Group.

### Passo 1.3 — Criar a Policy para o Dynamic Group
1. Acesse **Identity & Security > Policies**.
2. Selecione o **Compartimento Raiz (`root` / nome da tenancy)** no seletor lateral — as políticas precisam estar na raiz para permitir busca multi-compartimento e leitura do OCI Audit.
3. Clique em **Create Policy**:
   - **Name:** `CloudWatchBffVmReadOnlyPolicy`
   - **Description:** `Acesso estritamente somente leitura para Instance Principal do BFF`
4. Ative **Show manual editor** e cole exatamente as 4 instruções:
   ```text
   Allow dynamic-group CloudWatchBffVmGroup to read instance-family in tenancy
   Allow dynamic-group CloudWatchBffVmGroup to read virtual-network-family in tenancy
   Allow dynamic-group CloudWatchBffVmGroup to read metrics in tenancy
   Allow dynamic-group CloudWatchBffVmGroup to read audit-events in tenancy
   ```
   *(Se o Dynamic Group foi criado fora do domínio `Default`, prefixe com o domínio: `Allow dynamic-group 'SeuDominio'/'CloudWatchBffVmGroup' to ...`)*

---

## 2. Ativar o Plugin de Monitoramento nas VMs (`oci_computeagent`)

O CloudWatch Dashboard nunca inventa curvas de CPU ou Memória. As séries temporais (`1h`, `24h`, `7d`) são consultadas no namespace oficial **`oci_computeagent`** do serviço **OCI Monitoring**. Caso o plugin esteja desligado em uma VM, o app exibirá a instância normalmente, porém informará que não há métricas publicadas.

Para ativar em cada VM monitorada:
1. No console da OCI, vá em **Compute > Instances** e clique na máquina virtual desejada.
2. Role até a seção/aba **Oracle Cloud Agent**.
3. Localize o plugin **`Compute Instance Monitoring`**:
   - Certifique-se de que a chave **Enabled** esteja ligada.
   - Verifique se o status aparece como **`Running`** (verde).
4. Aguarde de **2 a 5 minutos** para que os primeiros pontos de `CpuUtilization` e `MemoryUtilization` sejam ingeridos pela OCI e apareçam nos gráficos do aplicativo.

> **Caso o Oracle Cloud Agent apareça como `Stopped` dentro do Linux (Oracle Linux / Ubuntu):**
> ```bash
> sudo systemctl enable --now oracle-cloud-agent
> sudo systemctl status oracle-cloud-agent
> ```

---

## 3. Criar Usuário e Grupo Somente Leitura para Usuários do App (Recomendado)

Embora qualquer usuário administrador da OCI possa conectar sua conta rapidamente pelo comando do Cloud Shell, a melhor prática de segurança corporativa (Princípio do Menor Privilégio) é utilizar um grupo com permissão **exclusivamente de leitura** — o aplicativo não precisa de nenhuma permissão `manage` ou `use` que altere recursos na Sprint 2.

### Passo 3.1 — Criar o Grupo `CloudWatchReadOnly`
1. Acesse **Identity & Security > Domains > Default domain > Groups**.
2. Clique em **Create group**:
   - **Name:** `CloudWatchReadOnly`
   - **Description:** `Acesso somente leitura a VMs, rede, metricas e auditoria para o app CloudWatch`

### Passo 3.2 — Criar a Policy Somente Leitura na Raiz da Tenancy
1. Acesse **Identity & Security > Policies** (no compartimento **raiz / root**).
2. Clique em **Create Policy**, nomeie como `CloudWatchUsersReadOnlyPolicy`, marque **Show manual editor** e cole:
   ```text
   Allow group CloudWatchReadOnly to read instance-family in tenancy
   Allow group CloudWatchReadOnly to read virtual-network-family in tenancy
   Allow group CloudWatchReadOnly to read metrics in tenancy
   Allow group CloudWatchReadOnly to read audit-events in tenancy
   ```
   - `read instance-family`: permite listar VMs via Resource Search, ler shape/OCPUs/memória (`GetInstance`) e vínculos de placa de rede (`ListVnicAttachments`). **Não** permite ligar, desligar, alterar ou excluir VMs.
   - `read virtual-network-family`: permite ler os endereços IP privado e público reais da VNIC (`GetVnic`).
   - `read metrics`: permite executar consultas MQL (`SummarizeMetricsData`) de CPU e Memória.
   - `read audit-events`: permite listar eventos reais de auditoria (`AuditClient.listEvents`).

### Passo 3.3 — Criar ou Associar o Usuário IAM
1. Em **Identity & Security > Domains > Default domain > Users**, clique em **Create user** (ex.: `cloudwatch-monitor`).
2. Adicione o usuário ao grupo **`CloudWatchReadOnly`**.
3. Faça login no console OCI com esse usuário para usar o pareamento via **Cloud Shell**, ou gere uma **API Key** para ele e utilize a opção **"Prefiro conectar manualmente"** na tela **Conectar Oracle Cloud** do aplicativo.

---

## 4. Como Desconectar e Revogar a Chave de API do Aplicativo

O usuário mantém controle total sobre o acesso concedido ao CloudWatch Dashboard e pode encerrá-lo a qualquer instante:

1. **No Aplicativo (remoção imediata no BFF):**
   - Abra a aba **Configurações > Contas Cloud Conectadas**.
   - No cartão **Oracle Cloud (OCI)**, toque em **Desconectar OCI** (ou no botão **Remover** da tenancy desejada).
   - O BFF apaga imediatamente as credenciais criptografadas da tabela `cloud_accounts` e limpa o cache em memória da conta.

2. **No Console da Oracle Cloud (revogação criptográfica definitiva):**
   - Clique no ícone de **Perfil** (canto superior direito do console web da OCI) > **Configurações do usuário** *(User settings / My profile)*.
   - No menu lateral inferior/esquerdo, clique em **Tokens e chaves** *(Tokens and keys)* ou **Chaves de API** *(API keys)*.
   - Identifique a chave criada pelo pareamento (pelo **Fingerprint** exibido anteriormente ou pelo horário de criação).
   - Clique no menu de três pontos (`⋮`) ao lado da chave e selecione **Excluir** *(Delete)*, confirmando a remoção.
   - Mesmo que qualquer requisição futura tentasse reutilizar aquela chave, a OCI recusará instantaneamente com `401 NotAuthenticated`.

---

## 5. Troubleshooting (Resolução de Problemas Comuns)

### 5.1. Erro `401 NotAuthenticated` (`OCI_INVALID_CREDENTIALS`)
Ocorre quando a assinatura criptográfica chegou à OCI, mas foi recusada pelo serviço IAM. Verifique:
- **Chave revogada ou ainda propagando:** Confirme em **Configurações do usuário > Chaves de API** se o fingerprint informado está listado como `Active`.
- **Fingerprint ou `.pem` divergentes:** No fluxo manual, o BFF calcula o hash MD5 do SPKI DER diretamente da chave `.pem` enviada; se não coincidir com o campo `fingerprint`, ele bloqueia antes mesmo de chamar a OCI (`OCI_FINGERPRINT_MISMATCH`). Certifique-se de colar o par `[DEFAULT]` e `.pem` gerados juntos.
- **Tenancy ou User OCID incorretos:** Verifique se `tenancy` começa com `ocid1.tenancy.oc1..` e `user` com `ocid1.user.oc1..` da mesma conta.
- **Relógio do servidor BFF dessincronizado:** A especificação HTTP Signature da Oracle rejeita requisições cujo cabeçalho `Date` divirja em mais de **5 minutos** do horário UTC real. Na VM do BFF, verifique:
  ```bash
  timedatectl status
  sudo systemctl restart chronyd
  ```

### 5.2. Erro `403 NotAuthorizedOrNotFound` ou Aviso `NO_PERMISSION`
A conta foi **autenticada com sucesso** (usuário, tenancy e chave privada são válidos), mas o usuário não possui políticas IAM suficientes para listar instâncias ou consultar auditoria:
- Verifique se o usuário pertence ao grupo referenciado na Policy (Seção 3.2).
- Confirme que a Policy foi criada no **compartimento raiz (`root` / `in tenancy`)**, e não apenas dentro de um subcompartimento isolado (o `AuditClient` e o `ResourceSearch` global exigem escopo na tenancy).
- Caso sua tenancy utilize um **Identity Domain customizado** (diferente de `Default`), inclua o nome do domínio na policy:
  ```text
  Allow group 'NomeDoDominio'/'CloudWatchReadOnly' to read instance-family in tenancy
  ```

### 5.3. Limite de Chaves de API Atingido (`LimitExceeded` — Máximo de 3 Chaves)
A Oracle Cloud impõe um limite rígido de **3 chaves de API (`API Keys`) simultâneas por usuário IAM**.
- **Sintoma:** Durante a execução do comando no Cloud Shell, o OCI CLI exibe erro `LimitExceeded` ou `User already has max allowed API signing keys` e interrompe sem enviar nada.
- **Solução:**
  1. Abra **Perfil > Configurações do usuário > Chaves de API** no console da OCI.
  2. Exclua pelo menos uma chave antiga que não esteja mais em uso.
  3. No aplicativo, toque em **Gerar novo comando** e cole o novo comando no Cloud Shell.

### 5.4. Contas Federadas (Oracle Identity Cloud Service / SSO Externo)
Em tenancies antigas com federação SAML/IDCS separada, a variável `$OCI_CS_USER_OCID` dentro do Cloud Shell pode não iniciar com `ocid1.user.` (ex.: usuários provisionados apenas como principal federado efêmero) ou o administrador corporativo pode bloquear `oci iam user api-key upload` via CLI.
- **Comportamento seguro do script:** O script de pareamento detecta automaticamente que `$OCI_CS_USER_OCID` não começa com `ocid1.user.`, exibe orientação em português no terminal e **encerra imediatamente sem gerar chaves nem enviar requisições**.
- **Como conectar nesses casos:**
  - **Opção 1 (Conexão Manual Direta):** Acesse **Perfil > Configurações do usuário > Chaves de API > Adicionar chave de API**, escolha **Gerar par de chaves de API**, baixe a chave privada (`.pem`), clique em **Adicionar** e copie o bloco de texto `[DEFAULT]` exibido pela Oracle. No aplicativo, abra **Conectar Oracle Cloud > Prefiro conectar manualmente**, cole o bloco `[DEFAULT]` e o conteúdo do arquivo `.pem` baixado.
  - **Opção 2 (Usuário IAM Local Dedicado):** Crie um usuário IAM nativo somente leitura conforme a **Seção 3** e utilize as credenciais dele exclusivamente para monitoramento.

