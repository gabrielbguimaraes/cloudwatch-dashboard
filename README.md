# CloudWatch Mobile Dashboard

Painel corporativo mobile para monitoramento e governança de infraestrutura multi-cloud com prioridade nativa para **Oracle Cloud Infrastructure (OCI)**, complementado por suporte a **Amazon Web Services (AWS)** e **Google Cloud Platform (GCP)**.

O projeto implementa uma arquitetura híbrida segura, integrando recursos de hardware físico do dispositivo móvel (Leitor Biométrico, Câmera e GPS) e um motor dinâmico de telemetria em tempo real.

---

## 📌 Contexto Acadêmico

* **Instituição:** FATEC Prof. Jessen Vidal (São José dos Campos)
* **Curso:** Graduação em Tecnologia em Desenvolvimento de Software Multiplataforma (4º DSM)
* **Disciplina:** Programação para Dispositivos Móveis I
* **Docente Responsável:** Prof. Gerson Penha
* **Discente:** João Gabriel Barros Guimarães 


---

## 🏗️ Arquitetura do Sistema

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

---

## 📋 Product Backlog Geral (Visão Global)

O backlog agrupa as necessidades corporativas de monitoramento e governança móvel em 5 Épicos, priorizados para entrega progressiva de valor:

| ID | Épico | Entrega Funcional / Necessidade do Usuário | Prioridade | Estimativa | Sprint |
| :---: | :--- | :--- | :---: | :---: | :---: |
| **US01** | Acesso & Segurança | Acesso seguro ao aplicativo por biometria (impressão digital) | Alta | 8 pts | Sprint 1 |
| **US02** | Acesso & Segurança | Importação instantânea de contas de nuvem via leitura de QR Code | Alta | 8 pts | Sprint 1 |
| **US03** | Acesso & Segurança | Indicação automática do datacenter mais próximo por satélite | Média | 5 pts | Sprint 1 |
| **US04** | Governança & Dados | Validação imediata de formato para impedir credenciais inválidas | Alta | 5 pts | Sprint 1 |
| **US05** | Painel Operacional | Semáforo visual de integridade dos servidores (Normal, Alerta e Crítico) | Alta | 5 pts | Sprint 1 |
| **US06** | Telemetria Dinâmica | Criação de servidores sob demanda com recálculo ao vivo de indicadores | Alta | 5 pts | Sprint 1 |
| **US07** | Personalização | Fixação de servidores prioritários no topo do painel para acesso rápido | Média | 3 pts | Sprint 1 |
| **US08** | Relatórios | Geração e compartilhamento de relatório executivo de integridade em PDF | Média | 5 pts | Sprint 1 |
| **US09** | Conexão Real OCI | Canal de comunicação seguro e autenticado com a nuvem da Oracle | Alta | 13 pts | Sprint 2 |
| **US10** | Conexão Real OCI | Consulta ao vivo de máquinas e servidores ativos na conta de nuvem | Alta | 8 pts | Sprint 2 |
| **US11** | Conexão Real OCI | Monitoramento contínuo do consumo de processador e memória em tempo real | Alta | 8 pts | Sprint 2 |
| **US12** | Visualização Analítica | Gráficos visuais de tendências de consumo por hora, dia e semana | Média | 8 pts | Sprint 2 |
| **US13** | Governança de Contas | Alternância simples entre diferentes contas e regiões de atendimento | Média | 5 pts | Sprint 2 |
| **US14** | Expansão Multi-Cloud | Integração de servidores e bancos de dados da Amazon Web Services (AWS) | Alta | 8 pts | Sprint 3 |
| **US15** | Expansão Multi-Cloud | Integração dos serviços monitorados da Google Cloud Platform (GCP) | Alta | 8 pts | Sprint 3 |
| **US16** | Gestão de Servidores | Ações remotas diretas pelo celular para ligar, desligar e reiniciar máquinas | Alta | 8 pts | Sprint 3 |
| **US17** | Notificações & Alarmes | Avisos automáticos no celular quando houver saturação de capacidade | Média | 5 pts | Sprint 3 |
| **US18** | Auditoria | Relatório consolidado multi-cloud com índice de disponibilidade dos serviços | Baixa | 3 pts | Sprint 3 |

---

## ⚡ Planejamento das Sprints & MVPs

### 🟢 Sprint 1: Fundação, Hardware Nativo e OCI-First

> **🏆 MVP da Sprint 1:**  
> Aplicativo funcional no smartphone Android, permitindo ao administrador acessar via biometria física, configurar suas credenciais apontando a câmera para um QR Code, identificar o datacenter local mais próximo por localização e acompanhar o estado de saúde dos servidores em um painel interativo com semáforo visual e provisionamento de instâncias sob demanda.

* **Esforço Estimado:** 44 Story Points

#### Sprint Backlog 1

| ID | Funcionalidade Entregue | Área de Atuação | Esforço |
| :---: | :--- | :--- | :---: |
| **US01** | Acesso ao aplicativo protegido por leitor de impressão digital | Segurança & Hardware | 8 pts |
| **US02** | Leitura ótica de credenciais de nuvem através da câmera do aparelho | Câmera & Onboarding | 8 pts |
| **US03** | Identificação contextual do datacenter mais próximo por satélite | Localização & Proximidade | 5 pts |
| **US04** | Bloqueio visual e mensagens de orientação para dados incompletos | Validação de Entrada | 5 pts |
| **US05** | Painel principal com classificação visual de status (Verde, Amarelo e Vermelho) | Monitoramento Visual | 5 pts |
| **US06** | Provisionamento instantâneo de servidores com atualização de métricas | Motor de Telemetria | 5 pts |
| **US07** | Fixação de servidores favoritos em destaque no topo da tela | Personalização da UI | 3 pts |
| **US08** | Emissão e compartilhamento de relatório operacional da máquina em PDF | Relatórios & Documentos | 5 pts |

---

### 🟡 Sprint 2: Telemetria Real OCI e Análise Visual

> **🏆 MVP da Sprint 2:**  
> Painel conectado diretamente aos serviços da Oracle Cloud Infrastructure em produção, substituindo dados locais pela coleta real do uso de processador e memória das máquinas ativas, com curvas de desempenho em gráficos dinâmicos por período selecionável.

* **Esforço Estimado:** 42 Story Points

#### Sprint Backlog 2

| ID | Funcionalidade Entregue | Área de Atuação | Esforço |
| :---: | :--- | :--- | :---: |
| **US09** | Conexão autenticada e criptografada com a infraestrutura da Oracle Cloud | Comunicação em Nuvem | 13 pts |
| **US10** | Listagem das máquinas e servidores reais ativos na conta do cliente | Coleta de Recursos | 8 pts |
| **US11** | Leitura contínua dos índices reais de processamento e tráfego de dados | Telemetria em Produção | 8 pts |
| **US12** | Painel gráfico com histórico de consumo de recursos (1h, 24h e 7 dias) | Gráficos & Tendências | 8 pts |
| **US13** | Painel para troca rápida entre diferentes empresas e regiões da nuvem | Gestão Multi-Conta | 5 pts |

---

### 🔵 Sprint 3: Gestão Multi-Cloud Completa, Ações Remotas e Alertas

> **🏆 MVP da Sprint 3:**  
> Central corporativa multi-cloud completa, permitindo gerenciar simultaneamente contas da Oracle, AWS e Google Cloud em um só lugar, enviar comandos de reinício e parada de máquinas pelo celular, receber alertas de saturação em segundo plano e exportar relatórios consolidados de disponibilidade.

* **Esforço Estimado:** 32 Story Points

#### Sprint Backlog 3

| ID | Funcionalidade Entregue | Área de Atuação | Esforço |
| :---: | :--- | :--- | :---: |
| **US14** | Monitoramento integrado de instâncias e bancos de dados da AWS | Integração Multi-Cloud | 8 pts |
| **US15** | Monitoramento de serviços e indicadores da Google Cloud Platform | Integração Multi-Cloud | 8 pts |
| **US16** | Disparo de comandos remotos para ligar, pausar e reiniciar servidores | Controle de Infraestrutura | 8 pts |
| **US17** | Notificações no celular alertando sobre lentidão ou sobrecarga de recursos | Notificações & Alarmes | 5 pts |
| **US18** | Relatório unificado de disponibilidade e estabilidade de múltiplos provedores | Auditoria & SLA | 3 pts |

---

## 📱 Recursos de Hardware Integrados

1. **Leitor Biométrico:**
   * Protege as chaves de acesso no hardware de segurança do smartphone.
   * Exige a confirmação de identidade por toque para liberar as credenciais salvas.

2. **Câmera Física do Dispositivo:**
   * Leitura de QR Codes em texto plano para importar configurações de acesso de forma ágil, eliminando a digitação manual de identificadores extensos.

3. **Sensor de GPS (Geolocalização):**
   * Consulta coordenadas físicas de satélite para indicar contextualmente o datacenter geograficamente mais próximo do usuário.

---

## 🚦 Semáforo de Integridade Operacional

O monitoramento classifica as instâncias em três estados com base nos limites de telemetria coletados:

* 🟢 **Operacional (HEALTHY):** Servidor operando normalmente, com processamento abaixo de 70% e sem falhas registradas.
* 🟡 **Atenção (WARNING):** Consumo de processamento entre 70% e 85%, ou oscilações temporárias de resposta.
* 🔴 **Crítico (CRITICAL):** Consumo de processamento superior a 85%, gargalos severos de memória ou servidores sem resposta.


Os arquivos executáveis `.apk` gerados estarão disponíveis em:
* **Debug:** `android/app/build/outputs/apk/debug/app-debug.apk`
* **Release:** `android/app/build/outputs/apk/release/app-release.apk` (ou espelhado na raiz como `CloudWatchDashboard.apk`).
