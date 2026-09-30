# Instrucoes de Implantacao na VM OCI (167.234.241.171)

Este guia contem as instrucoes prontas para o desenvolvedor implantar o banco de dados PostgreSQL isolado e o Micro-BFF na maquina OCI.

---

## 1. Conectar na VM
```bash
ssh -i sua_chave.key opc@167.234.241.171
```

---

## 2. Criar a Base e o Usuario Isolados no PostgreSQL
A maquina ja executa PostgreSQL para outro projeto. Para garantir isolamento total, crie o usuario e a base dedicados do CloudWatch:

```bash
sudo -u postgres psql -c "CREATE USER cloudwatch_user WITH ENCRYPTED PASSWORD 'CloudWatch2024#Secure';"
sudo -u postgres psql -c "CREATE DATABASE cloudwatch_db OWNER cloudwatch_user;"
```

---

## 3. Executar o Schema das Tabelas
Envie o arquivo `backend/schema.sql` para o servidor (ou clone o repositorio) e execute:

```bash
sudo -u postgres psql -d cloudwatch_db -f backend/schema.sql
```

---

## 4. Iniciar o Micro-BFF com PM2
```bash
cd backend
npm install
npm run build
pm2 start dist/index.js --name "cloudwatch-bff"
pm2 save
```

---

## 5. Abrir a Porta 3000 no Firewall da VM (Ubuntu / Oracle Linux)
Certifique-se de liberar o trafego de entrada na porta 3000 para a comunicacao com o app mobile:

```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --reload
```

> **Nota de Resiliencia (Offline-First):** O aplicativo mobile foi projetado com fallback automatico. Caso a maquina OCI esteja temporariamente inacessivel ou em manutencao, o aplicativo recorre de forma transparente ao cofre local criptografado (`EncryptedStorage` e `AsyncStorage`), garantindo funcionamento ininterrupto para a apresentacao da banca.
