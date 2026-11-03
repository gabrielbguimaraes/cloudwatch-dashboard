# Plano: colocar o BFF novo na VM, ligar HTTPS e testar com a conta OCI real

Este plano é específico para a **sua VM** (`vnic-sidebrain-prd`, Oracle Linux, `opc`). Ele foi montado a partir do que apareceu no seu terminal e **substitui** `DEPLOY_POSTGRES_OCI.md` e `docs/DEPLOY_HTTPS.md` nos pontos em que eles divergem da sua VM (esses dois assumem PostgreSQL instalado no host e um Caddy novo no host, o que não é o seu caso).

> Use `<IP_DA_VM>`, `<CAMINHO_DA_CHAVE_SSH>` e `<SEU_DOMINIO>` como lacunas. Nenhum segredo vai neste arquivo.

---

## 0. Diagnóstico: o que os seus logs mostraram

| # | Achado | Consequência |
|---|---|---|
| 1 | O `~/cloudwatch-bff/index.js` da VM foi **sobrescrito pelo `cat << EOF`** com a versão antiga (colada do outro chat). Ela tem instância fixa, IP `167.234.241.171` fixo, métricas em senoide, logs fixos, containers falsos e **senha do banco no código**. | A VM ainda serve **dados falsos**. O BFF novo (JWT, OCI SDK, pareamento) **nunca foi para a VM**. |
| 2 | `Node v16.20.2` na VM. | O BFF novo usa `helmet@8` (exige Node ≥ 18) e o SDK da OCI. Precisa de **Node 20**. |
| 3 | `sudo -u postgres` falhou (`unknown user postgres`). | O PostgreSQL **não está no host**: roda no container Docker `sidebrain_db` (`pgvector/pgvector:pg16`, usuário `sidebrain_admin`). Todo comando de banco deve ir via `sudo docker exec`. |
| 4 | O banco tem tabelas **antigas** (`users`, `cloud_accounts` com coluna `user_id`, `instances_cache`) criadas por `sidebrain_admin`. | O BFF novo usa `master_users` e um `cloud_accounts` **diferente** (`master_user_id`, `encrypted_credentials`). Se a tabela antiga continuar com esse nome, o `initDatabase()` falha e o app não funciona. |
| 5 | As tabelas antigas pertencem a `sidebrain_admin`, não a `cloudwatch_user`. No PostgreSQL 16, quem não é dono não cria tabelas no schema `public`. | O BFF precisa ser dono do banco `cloudwatch_db`, senão dá `permission denied for schema public`. |
| 6 | Você gerou uma senha nova com `openssl rand` **e colou no chat**. A senha antiga (`SuaSenhaSegura2026#`) estava dentro do `index.js`. | As duas devem ser consideradas **comprometidas**. Gere outra e não cole em lugar nenhum. |
| 7 | Existe o container `sidebrain_proxy` (Caddy) usando a porta 80. A sondagem mostrou a 443 **sem ninguém escutando**. | Não instale outro Caddy no host: dá conflito na porta 80. A saída é reaproveitar o Caddy que já existe. |
| 8 | `sidebrain_back` está em loop de reinício (`Restarting (1)`). | Não é do CloudWatch, mas vale olhar depois: consome CPU da VM. |

**Sobre apagar as contas de teste:** o BFF novo usa tabelas novas (`master_users`...), então ele **já começa sem nenhuma conta**. As tabelas antigas serão apenas renomeadas para `*_legacy` (nada é apagado agora; o apagamento definitivo é opcional, na Fase 9).

---

## Visão geral e ordem

```
Fase 1  Backup + enviar o BFF novo para a VM
Fase 2  Node 20 + PM2
Fase 3  Banco: senha nova, tabelas legadas, permissões
Fase 4  .env e subir o BFF (teste local na VM)
Fase 5  Domínio (DuckDNS) + HTTPS pelo Caddy que já existe
Fase 6  Fechar portas expostas (3000/5432)
Fase 7  Gerar o APK novo apontando para o domínio HTTPS
Fase 8  Testes com a sua conta OCI real
Fase 9  Limpeza final (opcional)
```

Pontos de parada marcados com **CHECKPOINT**: me mande a saída do comando indicado (sem senhas) que eu ajusto o próximo passo.

---

## Fase 1: Backup e envio do BFF novo

### 1.1 (Windows) Empacotar e enviar

```powershell
cd C:\Users\Biel_\cloudwatch-mobile\cloudwatch-dashboard\cloudwatch-bff
tar --exclude=node_modules --exclude=.env -czf $env:TEMP\cloudwatch-bff.tgz .
scp -i "<CAMINHO_DA_CHAVE_SSH>" $env:TEMP\cloudwatch-bff.tgz opc@<IP_DA_VM>:~/
```

Opcional, mas recomendado: faça commit e push do trabalho da Sprint 2 (hoje está só na sua máquina).

```powershell
cd C:\Users\Biel_\cloudwatch-mobile\cloudwatch-dashboard
git status          # confira: nenhum .env, .pem ou .apk na lista
git add -A
git commit -m "feat(sprint-2): JWT, OCI SDK oficial, pareamento Cloud Shell e preparo HTTPS"
git push origin main
```

### 1.2 (VM) Backup do que está lá e extração

```bash
ssh -i "<CAMINHO_DA_CHAVE_SSH>" opc@<IP_DA_VM>

cp -a ~/cloudwatch-bff ~/cloudwatch-bff.bak-$(date +%F)
cd ~/cloudwatch-bff
rm -rf node_modules
tar -xzf ~/cloudwatch-bff.tgz -C ~/cloudwatch-bff
ls -la    # deve listar index.js, ociClient.js, db.js, package.json, package-lock.json, .env.example
```

---

## Fase 2: Node 20 e PM2

```bash
cat /etc/os-release | head -3
node -v                                   # hoje: v16.20.2
sudo dnf module list nodejs               # veja se existe o stream 20
sudo dnf module switch-to -y nodejs:20 --allowerasing
node -v                                   # esperado: v20.x
sudo npm install -g pm2@latest
pm2 update
```

Se o stream `nodejs:20` não existir na sua versão do Oracle Linux, use o nvm:

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 20
npm install -g pm2@latest && pm2 update
```

> **CHECKPOINT 2:** `node -v` precisa mostrar `v20`. Sem isso, não siga.

---

## Fase 3: Banco de dados (container `sidebrain_db`)

### 3.1 Backup do banco (só por segurança)

```bash
sudo docker exec sidebrain_db pg_dump -U sidebrain_admin cloudwatch_db > ~/cloudwatch_db_backup_$(date +%F).sql
ls -lh ~/cloudwatch_db_backup_*.sql
```

### 3.2 Gerar a senha nova (anote localmente, **não cole em chat**)

```bash
openssl rand -hex 24
```

### 3.3 Entrar no psql e configurar

```bash
sudo docker exec -it sidebrain_db psql -U sidebrain_admin -d cloudwatch_db
```

Dentro do `psql`, rode **um bloco por vez**:

```sql
\password cloudwatch_user
```

(digite a senha nova duas vezes; ela não fica no histórico do bash)

```sql
-- Renomeia as tabelas antigas (reversível, não apaga dados)
ALTER TABLE IF EXISTS cloud_accounts  RENAME TO cloud_accounts_legacy;
ALTER TABLE IF EXISTS instances_cache RENAME TO instances_cache_legacy;
ALTER TABLE IF EXISTS users           RENAME TO users_legacy;

-- Faz o cloudwatch_user dono do banco para o BFF criar as tabelas novas
ALTER DATABASE cloudwatch_db OWNER TO cloudwatch_user;
GRANT ALL ON SCHEMA public TO cloudwatch_user;

\dt
\q
```

> **CHECKPOINT 3:** o `\dt` deve mostrar só as tabelas `*_legacy`. Se aparecer `master_users`, `refresh_tokens` ou `oci_pairing_sessions`, me mande a saída antes de continuar.

### 3.4 Verificar se o Postgres está exposto

```bash
sudo docker ps --format 'table {{.Names}}\t{{.Ports}}'
```

Se `sidebrain_db` aparecer como `0.0.0.0:5432->5432`, confira na Fase 6 que a porta 5432 **não** está liberada na Security List da OCI.

---

## Fase 4: `.env` e subir o BFF

```bash
cd ~/cloudwatch-bff
npm ci --omit=dev
cp -n .env.example .env
chmod 600 .env

# gera os dois segredos direto no arquivo, sem imprimir na tela
sed -i "s|^JWT_ACCESS_SECRET=.*|JWT_ACCESS_SECRET=$(openssl rand -hex 48)|" .env
sed -i "s|^CREDENTIALS_ENC_KEY=.*|CREDENTIALS_ENC_KEY=$(openssl rand -hex 32)|" .env

nano .env
```

Preencha no `nano`:

```dotenv
NODE_ENV=production
PORT=3000
BIND_HOST=127.0.0.1                # será ajustado na Fase 5
PUBLIC_BASE_URL=https://<SEU_DOMINIO>   # ainda não existe; pode deixar, será usado na Fase 5
DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=cloudwatch_db
DB_USER=cloudwatch_user
DB_PASSWORD=<a senha nova da Fase 3>
OWNER_USERNAME=<o username que VOCÊ vai criar no app>
CORS_ORIGINS=
```

> **Guarde uma cópia da `CREDENTIALS_ENC_KEY` em local seguro (gerenciador de senhas).** Se ela se perder, as contas OCI salvas não podem mais ser descriptografadas e todos terão de reconectar.

Subir:

```bash
pm2 delete cloudwatch-api
pm2 start index.js --name cloudwatch-api
pm2 save
pm2 logs cloudwatch-api --lines 30 --nostream
```

Reiniciar sozinho após reboot da VM (rode **uma vez** e execute o comando que ele imprimir):

```bash
pm2 startup
pm2 save
```

Verificar o BFF novo:

```bash
curl -s http://127.0.0.1:3000/health                 # {"status":"HEALTHY","service":"cloudwatch-api",...}
curl -i http://127.0.0.1:3000/api/oci/status         # esperado: HTTP 401 (exige token)
curl -i http://127.0.0.1:3000/api/clouds/instances   # esperado: 404 (rota falsa removida)
```

> **CHECKPOINT 4:** nos logs deve aparecer `Schema sincronizado com sucesso` e **não** pode aparecer `DB_PASSWORD nao definida`. Se aparecer `permission denied` ou `must be owner`, volte à Fase 3.

---

## Fase 5: Domínio e HTTPS (reaproveitando o Caddy do `sidebrain_proxy`)

Por que HTTPS é obrigatório: o comando do Cloud Shell envia uma **chave privada** ao BFF. O BFF recusa gerar o comando sem `https://`, e o APK de release bloqueia `http://`.

### 5.1 Domínio grátis (DuckDNS)

1. Acesse https://www.duckdns.org e entre com Google ou GitHub.
2. Crie um subdomínio (ex.: `cloudwatch-biel`) e coloque `<IP_DA_VM>` em *current ip*.
3. Seu domínio será `cloudwatch-biel.duckdns.org`. Teste do PC:
   ```powershell
   nslookup cloudwatch-biel.duckdns.org
   ```
4. Recomendado: no console da OCI, deixe o IP da VM como **IP público reservado** (Networking → IP management), para ele não mudar.

### 5.2 Liberar portas 80 e 443

- **Console OCI:** VCN da VM → Security List da sub-rede → *Ingress Rules* → TCP **80** e **443** com origem `0.0.0.0/0`.
- **Firewall da VM:**
  ```bash
  sudo firewall-cmd --permanent --add-service=http
  sudo firewall-cmd --permanent --add-service=https
  sudo firewall-cmd --reload
  ```

### 5.3 Descobrir como o Caddy atual está montado

```bash
sudo docker ps --format 'table {{.Names}}\t{{.Ports}}'
sudo docker inspect sidebrain_proxy --format '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{"\n"}}{{end}}'
sudo docker inspect sidebrain_proxy --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{$v.Gateway}}{{"\n"}}{{end}}'
```

O segundo comando mostra onde está o `Caddyfile` no host. Mostre-o:

```bash
sudo cat <CAMINHO_DO_CADDYFILE_NO_HOST>
```

> **CHECKPOINT 5:** me mande as saídas desses 4 comandos. Com elas eu te passo o bloco exato do Caddyfile. O que está em jogo: (a) a porta **443** precisa estar publicada no container (hoje parece não estar; se não estiver, será preciso recriar o container publicando a 443, e isso mexe no projeto sidebrain); (b) o endereço do host visto de dentro da rede do container (o *gateway* impresso acima).

### 5.4 Bloco a adicionar (modelo; confirme após o checkpoint)

```caddyfile
cloudwatch-biel.duckdns.org {
    encode zstd gzip
    request_body {
        max_size 64KB
    }
    reverse_proxy <GATEWAY_DA_REDE_DO_CADDY>:3000
}
```

Depois:

1. No `.env` do BFF: `BIND_HOST=<GATEWAY_DA_REDE_DO_CADDY>` (escuta só na rede do Docker, **não** em `0.0.0.0`) e `PUBLIC_BASE_URL=https://cloudwatch-biel.duckdns.org`.
2. `pm2 restart cloudwatch-api --update-env`
3. Recarregar o Caddy:
   ```bash
   sudo docker exec sidebrain_proxy caddy reload --config /etc/caddy/Caddyfile
   sudo docker logs sidebrain_proxy --tail 50     # procure a emissão do certificado
   ```
4. Do seu PC: `curl -i https://cloudwatch-biel.duckdns.org/health` deve responder `200`.

Se o Caddy retornar **502/timeout**, libere o tráfego da rede Docker até o host:

```bash
sudo firewall-cmd --permanent --zone=trusted --add-source=172.16.0.0/12
sudo firewall-cmd --reload
```

---

## Fase 6: Fechar o que não deve ficar público

1. **Porta 3000:** remova a regra de entrada da 3000 na Security List e no firewall da VM:
   ```bash
   sudo firewall-cmd --permanent --remove-port=3000/tcp
   sudo firewall-cmd --reload
   ```
2. **Porta 5432** (Postgres): confirme que **não** existe regra pública na Security List.
3. Teste do PC (os dois devem **falhar**):
   ```powershell
   Test-NetConnection <IP_DA_VM> -Port 3000
   Test-NetConnection <IP_DA_VM> -Port 5432
   ```

---

## Fase 7: Gerar o APK novo

O APK antigo na raiz é de 04/10 (Sprint 1). Este passo gera o novo apontando para o domínio HTTPS.

### 7.1 Configurar a URL do build

Crie `C:\Users\Biel_\cloudwatch-mobile\cloudwatch-dashboard\.env` (já está no `.gitignore`):

```dotenv
CLOUDWATCH_PUBLIC_BASE_URL=https://cloudwatch-biel.duckdns.org
CLOUDWATCH_API_BASE_URL=https://cloudwatch-biel.duckdns.org/api
```

### 7.2 Limpar caches (a URL é gravada no JS em tempo de build)

```powershell
cd C:\Users\Biel_\cloudwatch-mobile\cloudwatch-dashboard
Remove-Item -Recurse -Force $env:TEMP\metro-*, $env:TEMP\haste-map-* -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force android\app\build -ErrorAction SilentlyContinue
node node_modules\typescript\bin\tsc --noEmit
```

### 7.3 Build

```powershell
.\build-apk.bat
```

O resultado é copiado para `CloudWatchDashboard.apk` na raiz.

### 7.4 Conferir que o APK novo aponta para o domínio e não para o IP antigo

```powershell
Expand-Archive CloudWatchDashboard.apk -DestinationPath $env:TEMP\apkcheck -Force
Select-String -Path $env:TEMP\apkcheck\assets\index.android.bundle -Pattern 'duckdns' -SimpleMatch -List
Select-String -Path $env:TEMP\apkcheck\assets\index.android.bundle -Pattern '167.234.241.171' -SimpleMatch -List
```

O primeiro deve achar o domínio; o segundo **não pode achar nada**.

### 7.5 Instalar

Mande o `.apk` pelo Drive, **desinstale a versão antiga** no celular (para limpar dados e Keychain antigos) e instale o novo.

---

## Fase 8: Testes com a sua conta OCI real

**Pré-requisitos na OCI** (detalhes em `docs/OCI_SETUP.md`):

- Plugin **Compute Instance Monitoring** ativo na VM (senão a lista aparece, mas sem gráficos).
- Para o Teste A: Dynamic Group + policies da seção 1 de `docs/OCI_SETUP.md`.
- Para o Teste B: seu usuário IAM deve ser **local** (não federado/SSO), ter menos de 3 chaves de API e permissão de leitura (admin já serve; ou use o grupo somente leitura da seção 3).

### Teste A: atalho do dono ("Usar a conta da VM (demo)")

1. No app, cadastre-se com o **mesmo username** colocado em `OWNER_USERNAME`.
2. Pule a etapa "Conecte sua nuvem" ou entre em **Conectar Oracle Cloud**.
3. Toque em **Usar a conta da VM (demo)**.
4. Esperado: Dashboard com badge **LIVE** e as VMs reais da sua tenancy (nome, shape, OCPUs, memória, IPs, estado), com CPU e memória reais (1h, 24h, 7d).

### Teste B: pareamento pelo Cloud Shell (o fluxo que o usuário final usaria)

1. App → **Conectar Oracle Cloud** → **Gerar comando de conexão** → **Copiar**.
2. Console OCI → Cloud Shell → colar e Enter (o código vale 10 min e só funciona 1 vez).
3. Esperado no terminal: `Conectado! Pode voltar ao app.` Esperado no app: tela de sucesso com nome da tenancy, região e nº de instâncias.
4. Na conta OCI, a chave aparece em *Configurações do usuário → Chaves de API*.

### Teste C: credencial inválida (nada pode ser salvo)

1. App → **Prefiro conectar manualmente** → cole um `[DEFAULT]` com o **fingerprint adulterado**.
2. Esperado: erro em português (`OCI_FINGERPRINT_MISMATCH`), OCI **não** marcada como conectada, nenhuma instância.
3. Conferir no banco:
   ```bash
   sudo docker exec -it sidebrain_db psql -U sidebrain_admin -d cloudwatch_db \
     -c "SELECT id, provider, auth_mode, permission_status FROM cloud_accounts;"
   ```

### Teste D: Offline-First

```bash
pm2 stop cloudwatch-api
```

No app, puxe para atualizar: deve mostrar o banner **"Dados em cache de HH:mm"** e o badge **CACHE**. Depois:

```bash
pm2 start cloudwatch-api
```

### Teste E: isolamento entre usuários

Saia do app, crie um segundo usuário: ele deve começar com **zero nuvens e zero recursos**.

### Teste F: segurança

```powershell
curl -i https://cloudwatch-biel.duckdns.org/api/oci/instances      # esperado: 401
```

```bash
# nenhuma chave privada pode estar em texto puro no banco nem nos logs
sudo docker exec -it sidebrain_db psql -U sidebrain_admin -d cloudwatch_db \
  -c "SELECT count(*) FROM cloud_accounts WHERE encrypted_credentials LIKE '%BEGIN%';"   # esperado: 0
pm2 logs cloudwatch-api --lines 300 --nostream | grep -c "BEGIN"                          # esperado: 0
```

### Critério de sucesso

- [ ] `https://<SEU_DOMINIO>/health` responde 200 do PC e do celular em 4G.
- [ ] Teste A **ou** B mostra suas VMs reais com badge LIVE e gráficos reais.
- [ ] Teste C: credencial inválida rejeitada, nada salvo.
- [ ] Teste D: cache com banner de horário.
- [ ] Testes E e F aprovados.
- [ ] Portas 3000 e 5432 inacessíveis pela internet.

Ao terminar os testes, se quiser revogar o acesso: app → **Desconectar OCI** e, no console OCI, apague a chave em *Configurações do usuário → Chaves de API*.

---

## Fase 9: Limpeza final (opcional, **só depois** de tudo funcionar)

Apaga definitivamente as tabelas antigas (irreversível; o backup `.sql` da Fase 3 continua valendo):

```bash
sudo docker exec -it sidebrain_db psql -U sidebrain_admin -d cloudwatch_db \
  -c "DROP TABLE IF EXISTS cloud_accounts_legacy, instances_cache_legacy, users_legacy;"
```

Também remova o diretório `~/cloudwatch-bff.bak-*` e o `~/cloudwatch-bff.tgz` da VM.

---

## Solução de problemas

| Sintoma | Causa provável | Ação |
|---|---|---|
| `permission denied for schema public` nos logs | `cloudwatch_user` não é dono do banco | Refaça o bloco SQL da Fase 3.3 |
| `must be owner of table ...` | Tabela antiga ainda com o nome original | Renomear para `*_legacy` (Fase 3.3) |
| Erro de `engine` / `helmet` ao subir | Node < 18 | Fase 2 |
| `DB_PASSWORD nao definida` | `.env` ausente ou fora de `~/cloudwatch-bff` | Conferir `.env` e `pm2 restart cloudwatch-api --update-env` |
| App mostra erro `HTTPS_REQUIRED_FOR_PAIRING` | `PUBLIC_BASE_URL` sem `https://` | Ajustar o `.env` e reiniciar |
| Caddy retorna 502/timeout | `BIND_HOST` ou firewall | Fase 5.4 (gateway + regra `trusted`) |
| Certificado não é emitido | DNS não propagou ou porta 80/443 fechada | `sudo docker logs sidebrain_proxy --tail 100` e Fase 5.2 |
| App abre com "URL do servidor BFF não configurada" | APK gerado sem `.env`/com cache antigo | Refaça Fase 7.1 a 7.3 |
| Pareamento: aviso de conta federada | Usuário SSO (`$OCI_CS_USER_OCID` sem `ocid1.user.`) | Use a conexão manual (ver `docs/OCI_SETUP.md`, seção 5.4) |
| `LimitExceeded` no Cloud Shell | Já existem 3 chaves de API | Apague uma chave antiga no console OCI |
| Lista de VMs vazia / `NO_PERMISSION` | Faltam policies | `docs/OCI_SETUP.md`, seções 1 e 3 |
| VM aparece, mas sem gráficos | Plugin de monitoramento desligado | `docs/OCI_SETUP.md`, seção 2 |

