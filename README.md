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
* **Meta da Sprint 1 (MVP Funcional):** 28 de Setembro

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
│       │   (Motor da Sprint 1 / MVP)   │ │    (Escopo Sprint 2)    │         │
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

## 🎯 Product Backlog & Planejamento das Sprints

### 🟢 Sprint 1: MVP Funcional, Hardware Nativo e OCI-First (Concluída)
*Meta: Entregar autenticação segura com biometria, leitura de QR Code via câmera, proximidade geográfica via GPS, semáforo visual e compilação do instalador APK.*

| ID | Requisito / User Story | Hardware / API | Complexidade | Status |
| :--- | :--- | :--- | :---: | :---: |
| **US01** | Autenticação biométrica vinculada a credenciais salvas no cofre | Leitor de Impressão Digital | 8 pts | Concluído |
| **US02** | Importação de credenciais via leitura óptica de QR Code | Câmera Traseira | 8 pts | Concluído |
| **US03** | Detecção da região de datacenter mais próxima via satélite | Sensor GPS (`expo-location`) | 5 pts | Concluído |
| **US04** | Validação sintática estrita dos identificadores da Oracle Cloud | Regex / `validation.ts` | 5 pts | Concluído |
| **US05** | Painel com semáforo de integridade (Verde, Amarelo, Vermelho) | UI / Componentes | 5 pts | Concluído |
| **US06** | Provisionamento dinâmico de instâncias e recálculo de telemetria | Engine Dinâmica | 5 pts | Concluído |
| **US07** | Fixação de instâncias prioritárias no topo do Dashboard | Estado Persistente | 3 pts | Concluído |
| **US08** | Emissão e compartilhamento de relatório operacional em PDF | `react-native-share` / Intent | 5 pts | Concluído |
| **US09** | Compilação e empacotamento do instalador executável Android (`.apk`) | Gradle (Debug / Release) | 5 pts | Concluído |

### 🟡 Sprint 2: Conexão Direta com a API REST da OCI
*Meta: Conexão real aos endpoints de telemetria da Oracle Cloud Infrastructure via assinaturas criptográficas HTTP.*

| ID | Requisito / User Story | Componente / Tecnologia | Complexidade | Status |
| :--- | :--- | :--- | :---: | :---: |
| **US10** | Assinador de requisições HTTP REST com chave privada RSA (RFC Draft) | Criptografia RSA-SHA256 | 13 pts | Backlog |
| **US11** | Consulta direta de instâncias ativas na tenancy via OCI Compute API | OCI Core Services API | 8 pts | Backlog |
| **US12** | Coleta de métricas reais de CPU e I/O via OCI Telemetry Monitoring API | OCI Monitoring Service | 8 pts | Backlog |
| **US13** | Gerenciamento de múltiplos perfis de tenancy e alternância de região | Multi-Tenant Session Engine | 5 pts | Backlog |

### 🔵 Sprint 3: Gestão Multi-Cloud Completa e Ações Remotas
*Meta: Conexões diretas à AWS e GCP, push notifications e controles remotos de ciclo de vida de instâncias.*

| ID | Requisito / User Story | Componente / Tecnologia | Complexidade | Status |
| :--- | :--- | :--- | :---: | :---: |
| **US14** | Integração do cliente AWS CloudWatch via AWS SDK v3 | AWS Monitoring REST | 8 pts | Backlog |
| **US15** | Integração do Google Cloud Monitoring via Service Account | GCP IAM & Metrics API | 8 pts | Backlog |
| **US16** | Disparo de comandos remotos de ciclo de vida (Start, Stop, Reboot) | Cloud Compute Controls | 8 pts | Backlog |
| **US17** | Notificações push em segundo plano para alertas críticos de saturação | Firebase Cloud Messaging | 5 pts | Backlog |

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

## 🛠️ Tecnologias e Bibliotecas

* **Core:** React Native (0.76+), TypeScript
* **Navegação:** React Navigation (Native Stack & Bottom Tabs)
* **Segurança e Criptografia:** `react-native-keychain`, `react-native-encrypted-storage`
* **Hardware Nativo:** `react-native-camera-kit`, `expo-location`
* **Engine de Telemetria:** `@faker-js/faker`
* **Interface & Ícones:** Material Design Dark Theme, Vetores customizados e suporte a Logo PNG em `src/assets/logo.png`

---


