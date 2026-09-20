# ☁️ CloudWatch Dashboard

> **Aluno:** João Gabriel Barros Guimarães
> **Disciplina:** Programação para Dispositivos Móveis I — 4º DSM  
> **Instituição:** FATEC-SJC
> **Professor:** Dr. Eng. Gerson Penha

---

## 📖 Descrição do Projeto

O **CloudWatch Dashboard** é um aplicativo móvel desenvolvido em **React Native** com **TypeScript** e compilado para **Android (.apk)**. Ele funciona como um painel de monitoramento para recursos de infraestrutura em nuvem (AWS, Oracle Cloud OCI e Google Cloud), permitindo acompanhar em tempo real métricas de desempenho (CPU, memória, latência, erros), logs e alertas de instâncias e serviços (EC2, OCI Compute, RDS, S3 e Lambda).

O aplicativo integra recursos nativos de hardware do smartphone (câmera para leitura de QR Code, biometria e alertas sonoros/vibração) e possui um **Modo Simulação (@faker-js/faker)** para testes e apresentações completas sem custos de nuvem.

---

##  Objetivo

Desenvolver uma solução móvel funcional, intuitiva e segura que centralize a saúde dos serviços em nuvem por meio de um semáforo visual (Verde, Amarelo e Vermelho), permitindo respostas rápidas a incidentes mesmo fora do ambiente de trabalho.

### Objetivos Específicos:
* Implementar autenticação segura com armazenamento em KeyStore (`react-native-keychain` e `react-native-encrypted-storage`).
* Integrar hardware nativo: Câmera (QR Code para importar credenciais), GPS (`expo-location`) e biometria.
* Disponibilizar modo Offline-First com cache local (`react-native-async-storage`) e simulação via `@faker-js/faker`.
* Renderizar gráficos vetoriais de métricas (`react-native-svg-charts`) com transições a 60 FPS (`react-native-reanimated`).
* Gerar o pacote de instalação executável `.apk` via Gradle para execução em dispositivo Android físico.

---

##  Modelo de Dados

| Entidade | Descrição | Principais Atributos |
| :--- | :--- | :--- |
| **`CloudAccount`** | Contas e credenciais de nuvem | `id`, `name`, `provider`, `defaultRegion`, `isSimulationMode` |
| **`CloudResource`** | Recursos monitorados (EC2, RDS, etc.) | `id`, `arn`, `name`, `service`, `region`, `status`, `availabilitySla`, `costEstimate` |
| **`MetricDataPoint`** | Série temporal para os gráficos | `timestamp`, `value`, `unit` (Percent, Milliseconds, Count) |
| **`AlertRule`** | Regras de limites de alerta | `id`, `resourceId`, `metricName`, `operator`, `threshold`, `severity`, `isEnabled` |
| **`AlertIncident`** | Histórico de incidentes disparados | `id`, `ruleId`, `resourceName`, `severity`, `triggeredAt`, `status`, `message` |
| **`CloudWatchLogEvent`** | Logs centralizados dos serviços | `id`, `resourceId`, `timestamp`, `severity` (INFO, WARN, ERROR), `message` |
| **`UserPreferences`** | Preferências do usuário | `theme`, `defaultTimezone`, `biometricEnabled`, `simulationActive` |

---

##  Product Backlog

| ID | Épico | Funcionalidade / História de Usuário | Prioridade | Sprint |
| :---: | :--- | :--- | :---: | :---: |
| **US01** | Segurança | Login com credenciais e armazenamento no KeyChain (`react-native-keychain`) | Alta | Sprint 1 |
| **US02** | Segurança | Autenticação biométrica (impressão digital / Face ID) | Alta | Sprint 1 |
| **US03** | Hardware | Leitura de QR Code pela câmera para importar credenciais | Alta | Sprint 1 |
| **US04** | Hardware | Contextualização de região mais próxima por GPS (`expo-location`) | Média | Sprint 1 |
| **US05** | Simulação | Serviço de geração de dados fictícios realistas com `@faker-js/faker` | Alta | Sprint 1 |
| **US06** | Dashboard | Painel de recursos com semáforo de status (Verde, Amarelo, Vermelho) | Alta | Sprint 1 |
| **US07** | Dashboard | Cabeçalho com status geral, SLA de Uptime (99.8%) e KPIs | Alta | Sprint 1 |
| **US08** | Build | Compilação do primeiro pacote `.apk` via Gradle para Android | Alta | Sprint 1 |
| **US09** | Métricas | Gráficos vetoriais de CPU, latência e erros (`react-native-svg-charts`) | Alta | Sprint 2 |
| **US10** | Cloud Real | Conexão com SDK oficial da AWS (`@aws-sdk/client-cloudwatch`) | Média | Sprint 2 |
| **US11** | Logs | Visualizador de logs do CloudWatch com filtros de severidade e busca | Alta | Sprint 2 |
| **US12** | Offline | Cache persistente com `react-native-async-storage` (Offline-First) | Alta | Sprint 2 |
| **US13** | Hardware | Pesquisa de recursos e métricas por comandos de voz | Baixa | Sprint 2 |
| **US14** | Alertas | Cadastro e gestão de regras de alertas personalizados | Alta | Sprint 3 |
| **US15** | Alertas | Notificações push (FCM) com alarme sonoro e vibração tátil (haptics) | Alta | Sprint 3 |
| **US16** | Background | Checagem periódica de saúde dos serviços em segundo plano (Headless JS) | Média | Sprint 3 |
| **US17** | Relatórios | Exportação e compartilhamento de relatórios em PDF (`react-native-pdf-lib`) | Média | Sprint 3 |
| **US18** | Qualidade | Coleta de telemetria do app com `@opentelemetry/api` e Grafana Faro | Média | Sprint 3 |
| **US19** | Build Final| Geração de APK de release assinado e homologação final | Alta | Sprint 3 |

---

##  Sprint Backlog

### Sprint 1: Fundação, Hardware & MVP
| Tarefa | Descrição | Status |
| :--- | :--- | :---: |
| Setup do Projeto | Inicialização do projeto React Native TypeScript | A Fazer |
| Estrutura de Pastas | Organização modular: `components`, `screens`, `services`, `types`, `navigation` | Em Andamento |
| Serviço Faker | Criação de `simulationService.ts` para geração de recursos, CPU e logs | A Fazer |
| Tela de Login | Login com campos, autenticação biométrica e atalho para QR Code | A Fazer |
| Leitor QR Code | Leitura de credenciais usando a câmera do smartphone | A Fazer |
| Dashboard Principal | Cabeçalho de Uptime, KPIs e lista de recursos com semáforo visual | A Fazer |
| Tela de Métricas | Tela com visualização de métricas e estrutura para logs | A Fazer |
| Compilação do APK | Geração do `.apk` funcional via Gradle para teste em celular físico | A Fazer |

### Sprint 2: Métricas Detalhadas, Nuvem Real & Offline
| Tarefa | Descrição | Status |
| :--- | :--- | :---: |
| Gráficos Vetoriais | Renderização de gráficos com `react-native-svg-charts` e seleção de períodos | Pendente |
| Conexão AWS Real | Integração com `@aws-sdk/client-cloudwatch` para dados de contas reais | Pendente |
| Central de Logs | Visualizador de logs com busca e filtros (INFO, WARN, ERROR) | Pendente |
| Cache Offline | Persistência local com `react-native-async-storage` | Pendente |
| Comandos de Voz | Busca de recursos usando a API de reconhecimento de voz do aparelho | Pendente |

### Sprint 3: Alertas, Background, Relatórios & APK Final
| Tarefa | Descrição | Status |
| :--- | :--- | :---: |
| Regras de Alerta | Cadastro de thresholds e canais de notificação | Pendente |
| Push & Haptics | Alertas via FCM com vibração háptica e som estridente | Pendente |
| Headless JS | Verificação de saúde periódica em segundo plano com o app fechado | Pendente |
| Exportação em PDF | Geração de relatórios de desempenho e status com `react-native-pdf-lib` | Pendente |
| Telemetria & Release | Instrumentação OpenTelemetry e geração do APK final assinado | Pendente |

---

##  MVP (Mínimo Produto Viável)

O MVP a ser entregue na **Sprint 1**:
1. **Autenticação:** Login seguro com opções de biometria e leitura de QR Code pela câmera.
2. **Dashboard de Saúde:** Visão geral com semáforo de status (Verde, Amarelo, Vermelho), percentual de Uptime e KPIs.
3. **Detalhes do Recurso:** Tela de métricas com histórico e bloco de logs.
4. **Modo Simulação:** Geração autônoma de dados fictícios via `@faker-js/faker` sem custos de nuvem.

---

>  **Protótipo Interativo:**  [`prototype.html`](./prototype.html)
