# CloudWatch Mobile Dashboard

Painel móvel de monitoramento multi-cloud voltado para administradores de sistemas e equipes de DevOps, permitindo o acompanhamento em tempo real da integridade, métricas e alertas de instâncias em nuvem (Oracle Cloud Infrastructure, AWS e GCP).

## 🚀 Funcionalidades Entregues no MVP (Sprint 1)

### 🔐 Autenticação Segura e Hardware
* **Cofre de Chaves e Biometria Nativa:** Armazenamento seguro de identificadores de acesso e chaves de API utilizando o Android Keystore via `react-native-keychain`, com confirmação de identidade por leitura de impressão digital no login.
* **Importação Ágil por QR Code:** Captura de configurações e credenciais de tenancy através da câmera física do dispositivo móvel.

### 📊 Painel de Infraestrutura e Métricas
* **Semáforo Visual de Saúde:** Classificação instantânea do estado operacional dos servidores (Verde para normal, Amarelo para atenção e Vermelho para incidentes críticos).
* **Motor de Simulação de Infraestrutura:** Geração dinâmica de eventos e telemetria sob demanda com `@faker-js/faker`, simulando flutuações de CPU, consumo de memória e provisionamento de novas instâncias.
* **Personalização (Fixar Recursos):** Capacidade de destacar recursos prioritários no topo do painel principal para acesso rápido.
* **Emissão de Relatórios:** Exportação e compartilhamento de relatórios de desempenho e histórico de incidentes em formato PDF diretamente pelo sistema operacional.

## 🛠️ Tecnologias e Bibliotecas Utilizadas
* **Core:** React Native, TypeScript
* **Segurança:** react-native-keychain
* **Geração de Dados:** @faker-js/faker
* **Navegação:** React Navigation (Stack & Bottom Tabs)
* **Design:** Material Design Dark Theme
