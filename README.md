# CloudWatch Mobile Dashboard

Painel corporativo mobile para monitoramento e governança de infraestrutura multi-cloud com prioridade nativa para **Oracle Cloud Infrastructure (OCI)**, complementado por suporte a **Amazon Web Services (AWS)** e **Google Cloud Platform (GCP)**.

O projeto implementa uma arquitetura híbrida segura, integrando recursos de hardware físico do smartphone (Leitor Biométrico, Câmera e GPS) e um motor dinâmico de telemetria em tempo real.


---

## 🏗️ Arquitetura do Sistema

A solução adota o padrão **Dual-Engine Multi-Cloud**, desacoplando a autenticação e segurança de hardware dos provedores de dados. Esse modelo garante a integridade dos testes de validação em bancas acadêmicas sem gerar custos financeiros ou dependência de conectividade externa constante.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       CAMADA 1: APRESENTAÇÃO (UI)                           │
│  ┌───────────────────────┐  ┌──────────────────────┐  ┌───────────────────┐ │
│  │     LoginScreen       │  │   DashboardScreen    │  │MetricsDetailScreen│ │
│  │ (Form OCI + Cam Modal)│  │ (Semáforo + KPIs)    │  │(CPU/RAM + Histórico│ │
│  └───────────┬───────────┘  └──────────┬───────────┘  └─────────┬─────────┘ │
└──────────────┼─────────────────────────┼────────────────────────┼───────────┘
               ▼                         ▼                        ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                 CAMADA 2: GESTÃO DE ESTADO & REGRAS DE NEGÓCIO              │
│       ┌───────────────────────────────┐ ┌─────────────────────────┐         │
│       │          AuthContext          │ │      CloudContext       │         │
│       │ • Validação Sintática OCI     │ │ • Filtro de Provedor    │         │
│       │ • Sessão e Pareamento         │ │ • Recursos Fixados (Pin)│         │
│       └──────────────┬────────────────┘ └───────────┬─────────────┘         │
└──────────────────────┼──────────────────────────────┼───────────────────────┘
                       ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│             CAMADA 3: NATIVE HARDWARE BRIDGE & ARMAZENAMENTO SEGURO         │
│  ┌──────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐ │
│  │ react-native-keychain│  │  EncryptedStorage   │  │   expo-location     │ │
│  │ (Biometria / RSA)    │  │  (AES-256-GCM)      │  │ (GPS Fine Location) │ │
│  │ Token de Sessão 38B  │  │  Credenciais OCI    │  │ sa-saopaulo-1 (Lat) │ │
│  └──────────────────────┘  └─────────────────────┘  └─────────────────────┘ │
└──────────────────────┬──────────────────────────────┬───────────────────────┘
                       ▼                              ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CAMADA 4: DUAL-ENGINE DE TELEMETRIA                      │
│       ┌───────────────────────────────┐ ┌─────────────────────────┐         │
│       │   simulationService (Faker)   │ │  OCI Telemetry REST API │         │
│       │   (Motor da Sprint 1 / MVP 1) │ │   (Escopo Sprint 2/MVP 2│         │
│       │ • Flutuação de CPU / Status   │ │ • HTTP Signature RFC    │         │
│       │ • Provisionamento sob Demanda │ │ • Instâncias VM Compute │         │
│       └───────────────────────────────┘ └─────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 📋 Product Backlog

O backlog unificado agrupa as necessidades corporativas de monitoramento móvel em 5 épicos estratégicos, priorizados para entrega incremental de valor:

| ID | Épico | História de Usuário / Requisito Funcional | Prioridade | Estimativa | Sprint Alocada |
| :---: | :--- | :--- | :---: | :---: | :---: |
| **US01** | Acesso & Segurança | Acesso seguro ao aplicativo por biometria nativa vinculada a cofre digital | Alta | 8 pts | Sprint 1 |
| **US02** | Acesso & Segurança | Importação instantânea de credenciais corporativas via leitura óptica de QR Code | Alta | 8 pts | Sprint 1 |
| **US03** | Acesso & Segurança | Identificação contextual da região de datacenter mais próxima via localização do dispositivo | Média | 5 pts | Sprint 1 |
| **US04** | Governança | Validação automática da estrutura e conformidade dos identificadores de nuvem | Alta | 5 pts | Sprint 1 |
| **US05** | Painel Operacional | Semáforo visual de integridade para classificação rápida de incidentes e servidores saudáveis | Alta | 5 pts | Sprint 1 |
| **US06** | Operação em Tempo Real | Provisionamento interativo de servidores com recálculo instantâneo de métricas operacionais | Alta | 5 pts | Sprint 1 |
| **US07** | Experiência de Uso | Fixação de servidores prioritários no topo da tela para monitoramento contínuo | Média | 3 pts | Sprint 1 |
| **US08** | Auditoria & Gestão | Geração e compartilhamento de relatório executivo da infraestrutura em arquivo PDF | Média | 5 pts | Sprint 1 |
| **US09** | Conexão Direta Nuvem | Comunicação autenticada e segura com os serviços de telemetria da nuvem principal (OCI) | Alta | 13 pts | Sprint 2 |
| **US10** | Conexão Direta Nuvem | Listagem e sincronização em tempo real das máquinas ativas na conta corporativa | Alta | 8 pts | Sprint 2 |
| **US11** | Conexão Direta Nuvem | Leitura direta do consumo de processamento e memória de instâncias em produção | Alta | 8 pts | Sprint 2 |
| **US12** | Análise Histórica | Visualização de curvas de tendência e picos de uso por períodos customizados (1h, 24h, 7d) | Média | 8 pts | Sprint 2 |
| **US13** | Governança | Alternância rápida entre diferentes ambientes corporativos e regiões geográficas | Média | 5 pts | Sprint 2 |
| **US14** | Integração Multi-Cloud | Monitoramento unificado de servidores da Amazon Web Services (AWS) no mesmo painel | Alta | 8 pts | Sprint 3 |
| **US15** | Integração Multi-Cloud | Monitoramento unificado de serviços do Google Cloud Platform (GCP) no mesmo painel | Alta | 8 pts | Sprint 3 |
| **US16** | Comandos Operacionais | Execução remota de ações de ciclo de vida (iniciar, pausar e reiniciar servidores) | Alta | 8 pts | Sprint 3 |
| **US17** | Alertas & Notificações | Avisos imediatos no dispositivo em caso de sobrecarga de capacidade ou indisponibilidade | Média | 5 pts | Sprint 3 |
| **US18** | Auditoria & Gestão | Exportação consolidada de relatórios de cumprimento de SLA entre diferentes provedores | Baixa | 3 pts | Sprint 3 |

---

## ⚡ Planejamento das Sprints & Entregas de MVP

### 🟢 Sprint 1: Fundação, Hardware Nativo e OCI-First

> **🏆 MVP 1:** Aplicativo funcional instalado no smartphone Android (`.apk`), capaz de autenticar o usuário por biometria nativa, importar credenciais corporativas via câmera através de QR Code, identificar a região local mais próxima por satélite e apresentar um painel dinâmico com semáforo de integridade, provisionamento customizável e exportação de relatório operacional em PDF.

* **Esforço Total:** 44 Story Points
* **Status:** Concluído

#### Sprint Backlog 1

| ID | História de Usuário | Área de Atuação | Complexidade | Status |
| :--- | :--- | :--- | :---: | :---: |
| **US01** | Acesso seguro ao aplicativo por biometria nativa vinculada a cofre digital | Biometria / Segurança Física | 8 pts | Concluído |
| **US02** | Importação instantânea de credenciais corporativas via leitura óptica de QR Code | Câmera do Smartphone | 8 pts | Concluído |
| **US03** | Identificação contextual da região de datacenter mais próxima via localização do dispositivo | Sensor de Localização (GPS) | 5 pts | Concluído |
| **US04** | Validação automática da estrutura e conformidade dos identificadores de nuvem | Validação de Regras OCI | 5 pts | Concluído |
| **US05** | Semáforo visual de integridade para classificação rápida de incidentes e servidores saudáveis | Interface / Semáforo de Cores | 5 pts | Concluído |
| **US06** | Provisionamento interativo de servidores com recálculo instantâneo de métricas operacionais | Gestão Dinâmica de Recursos | 5 pts | Concluído |
| **US07** | Fixação de servidores prioritários no topo da tela para monitoramento contínuo | Painel Operacional | 3 pts | Concluído |
| **US08** | Geração e compartilhamento de relatório executivo da infraestrutura em arquivo PDF | Exportação de Documentos | 5 pts | Concluído |

---

### 🟡 Sprint 2: Telemetria Real OCI e Análise Gráfica

> **🏆 MVP 2:** Painel conectado diretamente aos serviços oficiais de monitoramento da nuvem em produção, substituindo simulações locais pela extração real de métricas de processamento e armazenamento de servidores ativos, exibindo curvas de tendência em gráficos interativos por período selecionável.

* **Esforço Total:** 42 Story Points
* **Status:** Pending

#### Sprint Backlog 2

| ID | História de Usuário | Área de Atuação | Complexidade | Status |
| :--- | :--- | :--- | :---: | :---: |
| **US09** | Comunicação autenticada e segura com os serviços de telemetria da nuvem principal (OCI) | Conectividade Criptográfica | 13 pts | Backlog |
| **US10** | Listagem e sincronização em tempo real das máquinas ativas na conta corporativa | Sincronização de Infraestrutura | 8 pts | Backlog |
| **US11** | Leitura direta do consumo de processamento e memória de instâncias em produção | Coleta Contínua de Telemetria | 8 pts | Backlog |
| **US12** | Visualização de curvas de tendência e picos de uso por períodos customizados (1h, 24h, 7d) | Gráficos Analíticos de Tendência | 8 pts | Backlog |
| **US13** | Alternância rápida entre diferentes ambientes corporativos e regiões geográficas | Governança Multi-Ambiente | 5 pts | Backlog |

---

### 🔵 Sprint 3: Gestão Multi-Cloud Completa, Ações Remotas e Alertas

> **🏆 MVP 3:** Plataforma unificada de gestão em múltiplos provedores (Oracle OCI, AWS e Google Cloud), permitindo atuar diretamente sobre os servidores com comandos operacionais de parada e reinício na palma da mão, recebendo notificações em segundo plano para saturação de capacidade e gerando auditorias consolidadas de disponibilidade.

* **Esforço Total:** 32 Story Points
* **Status:** Pending

#### Sprint Backlog 3

| ID | História de Usuário | Área de Atuação | Complexidade | Status |
| :--- | :--- | :--- | :---: | :---: |
| **US14** | Monitoramento unificado de servidores da Amazon Web Services (AWS) no mesmo painel | Ecossistema Multi-Cloud | 8 pts | Backlog |
| **US15** | Monitoramento unificado de serviços do Google Cloud Platform (GCP) no mesmo painel | Ecossistema Multi-Cloud | 8 pts | Backlog |
| **US16** | Execução remota de ações de ciclo de vida (iniciar, pausar e reiniciar servidores) | Automação e Controle Remoto | 8 pts | Backlog |
| **US17** | Avisos imediatos no dispositivo em caso de sobrecarga de capacidade ou indisponibilidade | Notificações de Incidente | 5 pts | Backlog |
| **US18** | Exportação consolidada de relatórios de cumprimento de SLA entre diferentes provedores | Auditoria Corporativa | 3 pts | Backlog |

---

## 📱 Recursos de Hardware Integrados

1. **Leitor Biométrico (Biometria Nativa):**
   * Protege as credenciais e chaves criptográficas no hardware seguro do smartphone (Android Keystore).
   * Exige a confirmação física de identidade por toque para autorizar o acesso à sessão.
2. **Câmera Física do Dispositivo (Scanner Óptico):**
   * Abertura do sensor de imagem em tempo de execução para captura de QR Code em texto puro (`Plain Text`).
   * Decodificação estruturada do payload de configuração da Oracle Cloud:
     ```json
     {
       "provider": "OCI",
       "tenancyId": "ocid1.tenancy.oc1..aaaa...",
       "userId": "ocid1.user.oc1..aaaa...",
       "fingerprint": "0e:ed:6e:d2:98:cf:84:1e:7d:b7:16:37:ef:8c:e1:59",
       "region": "sa-saopaulo-1"
     }
     ```
3. **Sensor de GPS (Geolocalização e Proximidade de Datacenter):**
   * Consulta coordenadas físicas de satélite do aparelho via `expo-location`.
   * Identifica contextualmente se o operador está na América do Sul e sugere o datacenter local de menor latência geográfica (`sa-saopaulo-1`).

---

## 🚦 Semáforo de Integridade Operacional

O monitoramento classifica as instâncias em três estados com base nos limites de telemetria coletados:

* 🟢 **Operacional (HEALTHY):** Consumo de processamento abaixo de 70%, sem erros ou alertas de instabilidade.
* 🟡 **Atenção (WARNING):** Consumo de processamento entre 70% e 85%, ou oscilações temporárias de resposta.
* 🔴 **Crítico (CRITICAL):** Consumo de processamento superior a 85%, esgotamento de memória ou servidores sem resposta.

---

## 🛠️ Tecnologias e Bibliotecas

* **Linguagem & Framework:** React Native (0.76+), TypeScript
* **Navegação:** React Navigation (Native Stack & Bottom Tabs)
* **Cofre & Criptografia:** `react-native-keychain`, `react-native-encrypted-storage`
* **Integração de Hardware:** `react-native-camera-kit`, `expo-location`
* **Geração de Documentos:** `expo-print` (Exportação PDF nativa)
* **Motor de Telemetria Dinâmica:** `@faker-js/faker` (Simulação e recálculo em tempo real)
* **Estilização:** Material Design Dark Theme

