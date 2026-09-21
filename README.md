# CloudWatch Mobile Dashboard

Painel corporativo mobile para monitoramento e governança de infraestrutura multi-cloud com prioridade nativa para **Oracle Cloud Infrastructure (OCI)**, complementado por suporte a **Amazon Web Services (AWS)** e **Google Cloud Platform (GCP)**. 

O projeto implementa uma arquitetura híbrida segura, integrando recursos de hardware físico do dispositivo móvel (Leitor Biométrico, Câmera e GPS) e um motor dinâmico de telemetria em tempo real.

---

## 📌 Contexto Acadêmico
* **Instituição:** FATEC Prof. Jessen Vidal (São José dos Campos)
* **Curso:** Graduação em Tecnologia em Desenvolvimento de Software Multiplataforma (4º DSM)
* **Disciplina:** Programação para Dispositivos Móveis I
* **Docente Responsável:** Prof. Dr. Eng. Gerson Penha
* **Discente:** João Gabriel Barros Guimarães (RA: 1461392411007)
* **Período de Desenvolvimento:** 2º Semestre Letivo

---

## 🏗️ Arquitetura do Sistema

A solução foi estruturada no padrão **Dual-Engine Multi-Cloud**, desacoplando a camada de autenticação e segurança física das fontes de dados para garantir operação contínua mesmo sem dependência de saldo ativo em nuvem durante a avaliação acadêmica.

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

### Segurança e Resolução do Limite de Bloco RSA
Para solucionar a exceção nativa `javax.crypto.IllegalBlockSizeException: input must be under 256 bytes` no Android Keystore, adotou-se a separação de responsabilidades criptográficas:
1. **Cofre Simétrico (AES-256-GCM):** O payload completo com as credenciais da OCI (Tenancy OCID, User OCID, Fingerprint e Chave Privada) é armazenado via `react-native-encrypted-storage` apoiado pelo Android `EncryptedSharedPreferences`.
2. **Token Biométrico Leve (RSA 2048-bit):** O `react-native-keychain` armazena estritamente um token de sessão de ~38 bytes protegido pelo prompt biométrico (`Keychain.ACCESS_CONTROL.BIOMETRY_ANY`).
3. **Fluxo de Acesso:** O reconhecimento bem-sucedido da impressão digital no Keystore autoriza a leitura e decodificação do payload persistido no cofre criptografado.

---

## 📋 Product Backlog Geral (Visão Global)

O backlog unificado agrupa as necessidades corporativas de monitoramento móvel em 5 Épicos prioritários, totalizando **110 Story Points**:

| ID | Épico | História de Usuário / Requisito Funcional | Prioridade | Estimativa | Sprint Alocada |
| :---: | :--- | :--- | :---: | :---: | :---: |
| **US01** | Autenticação & Hardware | Login com proteção biométrica nativa (Keystore/Biometria) | Alta | 8 pts | Sprint 1 |
| **US02** | Autenticação & Hardware | Leitura óptica de credenciais de nuvem via câmera (QR Code) | Alta | 8 pts | Sprint 1 |
| **US03** | Autenticação & Hardware | Detecção contextual de região de datacenter via sensor GPS | Média | 5 pts | Sprint 1 |
| **US04** | Governança & Validação | Validação sintática rigorosa de identificadores OCI (Regex) | Alta | 5 pts | Sprint 1 |
| **US05** | Dashboard & Métricas | Semáforo visual de saúde operacional (Healthy, Warning, Danger) | Alta | 5 pts | Sprint 1 |
| **US06** | Telemetria Dinâmica | Motor dinâmico de telemetria e provisionamento sob demanda | Alta | 5 pts | Sprint 1 |
| **US07** | Customização & UI | Fixação de instâncias prioritárias no topo do Dashboard | Média | 3 pts | Sprint 1 |
| **US08** | Auditoria & Relatórios | Exportação e compartilhamento de relatório operacional em PDF | Média | 5 pts | Sprint 1 |
| **US09** | Conexão Real OCI | Assinador de requisições HTTP REST com chave RSA (RFC Draft) | Alta | 13 pts | Sprint 2 |
| **US10** | Conexão Real OCI | Listagem real de instâncias ativas via OCI Core Services API | Alta | 8 pts | Sprint 2 |
| **US11** | Conexão Real OCI | Coleta de métricas reais de CPU/IO via OCI Telemetry Monitoring | Alta | 8 pts | Sprint 2 |
| **US12** | Visualização Analítica | Gráficos vetoriais de tendências temporais (1h, 24h, 7d) | Média | 8 pts | Sprint 2 |
| **US13** | Governança Multi-Tenant | Gerenciamento de múltiplos perfis e alternância de região OCI | Média | 5 pts | Sprint 2 |
| **US14** | Ecossistema Multi-Cloud | Integração do cliente AWS CloudWatch via AWS SDK v3 | Alta | 8 pts | Sprint 3 |
| **US15** | Ecossistema Multi-Cloud | Integração com Google Cloud Monitoring via Service Account | Alta | 8 pts | Sprint 3 |
| **US16** | Ações de Infraestrutura | Disparo de controles remotos de ciclo de vida (Start, Stop, Reboot) | Alta | 8 pts | Sprint 3 |
| **US17** | Alertas & Notificações | Push notifications em background para saturação de limites | Média | 5 pts | Sprint 3 |
| **US18** | Auditoria Avançada | Exportação de logs de auditoria e conformidade em PDF/CSV | Baixa | 3 pts | Sprint 3 |

---

## ⚡ Planejamento das Sprints & MVPs

### 🟢 Sprint 1: Fundação, Hardware Nativo e OCI-First
> **🏆 MVP da Sprint 1:**  
> Aplicativo funcional instalado no smartphone Android (`.apk`), capaz de autenticar o usuário através de biometria nativa, importar credenciais reais da OCI via câmera por QR Code, sugerir o datacenter local mais próximo por satélite (GPS) e exibir um painel dinâmico com semáforo de saúde e provisionamento de instâncias sem dependência de saldo em nuvem.


* **Esforço:** 44 Story Points


#### Sprint Backlog 1
| ID | User Story | Componente / Hardware | Complexidade | Status |
| :--- | :--- | :--- | :---: | :---: |
| **US01** | Autenticação biométrica vinculada ao Android Keystore sem estouro de bloco | Leitor de Impressão Digital | 8 pts | Concluído |
| **US02** | Importação de credenciais via leitura óptica de QR Code em texto puro | Câmera Traseira | 8 pts | Concluído |
| **US03** | Detecção da região de datacenter mais próxima via sensor GPS | Sensor GPS (`expo-location`) | 5 pts | Concluído |
| **US04** | Painel com semáforo de integridade (Verde, Amarelo, Vermelho) | UI / `ResourceCard` | 5 pts | Concluído |
| **US05** | Provisionamento dinâmico de instâncias e recálculo dinâmico de KPIs | `simulationService` | 5 pts | Concluído |
| **US06** | Fixação de recursos prioritários no topo da tela inicial | `CloudContext` | 3 pts | Concluído |
| **US07** | Geração e compartilhamento de relatório operacional em PDF | `react-native-share` / Intent | 5 pts | Concluído |

---

### 🟡 Sprint 2: Telemetria Real OCI e Análise Vetorial
> **🏆 MVP da Sprint 2:**  
> Painel conectado diretamente aos endpoints REST de telemetria da Oracle Cloud Infrastructure em produção, autenticando chamadas via assinaturas digitais RSA-SHA256, substituindo a simulação pela coleta de CPU e memória reais de instâncias de Compute e renderizando curvas de tendências em gráficos vetoriais com intervalos selecionáveis.

* **Esforço:** 42 Story Points

#### Sprint Backlog 2
| ID | User Story | Componente / Tecnologia | Complexidade | Status |
| :--- | :--- | :--- | :---: | :---: |
| **US09** | Assinador de requisições HTTP REST com chave privada RSA (RFC Draft) | Criptografia RSA-SHA256 | 13 pts | Backlog |
| **US10** | Consulta direta de instâncias ativas na tenancy via OCI Compute API | OCI Core Services REST | 8 pts | Backlog |
| **US11** | Coleta de métricas reais de CPU e I/O via OCI Telemetry Monitoring API | OCI Monitoring Service | 8 pts | Backlog |
| **US12** | Renderização de gráficos vetoriais com zoom e seletor (1h, 24h, 7d) | `react-native-svg-charts` | 8 pts | Backlog |
| **US13** | Gerenciamento de múltiplos perfis de tenancy e alternância de região | Multi-Tenant Session Engine | 5 pts | Backlog |

---

### 🔵 Sprint 3: Gestão Multi-Cloud Completa, Ações Remotas e Alertas
> **🏆 MVP da Sprint 3:**  
> Solução corporativa multi-cloud completa, permitindo parear simultaneamente contas da AWS e Google Cloud além da OCI, emitir comandos de ciclo de vida (Start, Stop, Reboot) diretamente pelo celular, receber alertas push em segundo plano sobre saturação de recursos e exportar relatórios consolidados de disponibilidade para auditoria.

* **Esforço:** 32 Story Points

#### Sprint Backlog 3
| ID | User Story | Componente / Tecnologia | Complexidade | Status |
| :--- | :--- | :--- | :---: | :---: |
| **US14** | Integração do cliente AWS CloudWatch para métricas de EC2 e RDS | `@aws-sdk/client-cloudwatch`| 8 pts | Backlog |
| **US15** | Integração com Google Cloud Monitoring via OAuth2 Service Account | GCP Metrics REST API | 8 pts | Backlog |
| **US16** | Disparo de comandos remotos de ciclo de vida (Start, Stop, Reboot) | Cloud Compute Controls | 8 pts | Backlog |
| **US17** | Notificações push em segundo plano para saturação de limites críticos | Firebase Cloud Messaging | 5 pts | Backlog |
| **US18** | Relatório consolidado multi-cloud com índice de disponibilidade SLA | `react-native-pdf-lib` | 3 pts | Backlog |

---

## 📱 Hardware Físico e Recursos Utilizados

1. **Leitor Biométrico (Biometria Nativa):**
   * Vincula a chave de sessão ao hardware seguro do smartphone via Android Keystore.
   * Exige a confirmação de identidade por toque para liberar as credenciais salvas.
2. **Câmera Física do Dispositivo (Scanner Óptico):**
   * Abertura em tempo de execução via `react-native-camera-kit` para captura de QR Code em texto puro.
   * Suporte nativo ao payload JSON oficial da Oracle Cloud:
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
   * Módulo `expo-location` consultando coordenadas físicas de satélite.
   * Vinculação contextual automática para exibir o badge `📍 Datacenter Local mais próximo (GPS)` ao detectar coordenadas no continente sul-americano.

---

## 🚦 Semáforo de Integridade Operacional

O monitoramento classifica as instâncias em três estados com base nos limiares de telemetria:

* 🟢 **Operacional (HEALTHY):** Consumo de CPU abaixo de 70%, sem erros de execução ou falhas de healthcheck registradas.
* 🟡 **Atenção (WARNING):** Consumo de CPU entre 70% e 85%, ou picos transitórios de latência de rede.
* 🔴 **Crítico (CRITICAL):** Consumo de CPU superior a 85%, gargalos severos de memória ou instâncias inacessíveis.

---


Os arquivos `.apk` gerados estarão disponíveis em:
* **Debug:** `android/app/build/outputs/apk/debug/app-debug.apk`
* **Release:** `android/app/build/outputs/apk/release/app-release.apk` (ou espelhado na raiz do projeto como `CloudWatchDashboard.apk`).
