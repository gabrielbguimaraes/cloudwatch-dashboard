/**
 * CloudWatch Dashboard - Modelos de Dados e Tipagens TypeScript
 * Foco Primário: Oracle Cloud Infrastructure (OCI) + AWS & GCP
 * Aluno: João Gabriel Barros Guimarães (RA: 1461392411007)
 * FATEC Prof. Dr. Eng. Gerson Penha - 4DSM
 */

/** Provedores de Nuvem Suportados (OCI Primário) */
export type CloudProvider = 'OCI' | 'AWS' | 'GCP';

/** Tipos de Serviços Monitorados */
export type CloudServiceType =
  | 'OCI_COMPUTE'
  | 'OCI_DATABASE'
  | 'OCI_STORAGE'
  | 'OCI_FUNCTIONS'
  | 'EC2'
  | 'RDS'
  | 'LAMBDA'
  | 'S3'
  | 'GCP_RUN';

/** Status do Semáforo Visual de Saúde */
export type HealthStatus = 'HEALTHY' | 'WARNING' | 'CRITICAL' | 'OFFLINE';

/** Ciclo de Vida Nativo dos Recursos */
export type LifecycleState =
  | 'RUNNING'
  | 'STARTING'
  | 'STOPPED'
  | 'TERMINATED'
  | 'DEGRADED'
  | 'PROVISIONING';

/** Níveis de Severidade para Logs e Alertas */
export type SeverityLevel = 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL';

/** Canais de Disparo de Alertas */
export type NotificationChannel = 'PUSH_FCM' | 'HAPTIC_VIBRATE' | 'SOUND_ALARM' | 'EMAIL';

/** Métricas Oficiais da OCI e CloudWatch */
export type OciMetricName =
  | 'CpuUtilization'
  | 'MemoryUtilization'
  | 'DiskBytesRead'
  | 'DiskBytesWritten'
  | 'NetworkBytesIn'
  | 'NetworkBytesOut'
  | 'StorageAllocated';

export type AwsMetricName =
  | 'CPUUtilization'
  | 'Latency'
  | 'Errors'
  | 'NetworkIn';

export type UnifiedMetricName = OciMetricName | AwsMetricName;

/** Credenciais Específicas da Oracle Cloud (OCI) */
export interface OciCredentials {
  tenancyOcid: string;
  userOcid: string;
  fingerprint: string;
  privateKeyPem?: string; // Armazenado exclusivamente via KeyChain / EncryptedStorage
  region: string; // Ex: 'sa-saopaulo-1', 'us-ashburn-1'
  compartmentOcid: string;
}

/** Credenciais AWS */
export interface AwsCredentials {
  accessKeyId: string;
  secretAccessKey?: string;
  region: string; // Ex: 'us-east-1', 'sa-east-1'
}

/** Credenciais GCP */
export interface GcpCredentials {
  clientEmail: string;
  privateKey?: string;
  projectId: string;
  region: string;
}

/** Perfil de Conta Conectada */
export interface CloudAccount {
  id: string;
  name: string;
  provider: CloudProvider;
  defaultRegion: string;
  isSimulationMode: boolean;
  ociConfig?: OciCredentials;
  awsConfig?: AwsCredentials;
  gcpConfig?: GcpCredentials;
  credentialsEncryptedRef?: string;
  createdAt: string;
  updatedAt: string;
}

/** Sessão de Usuário com Suporte a 2FA (TOTP) */
export interface UserSession {
  userId: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  token: string;
  refreshToken: string;
  twoFactorEnabled: boolean;
  twoFactorVerified: boolean;
  biometricEnabled: boolean;
  expiresAt: string;
}

/** Metadados Específicos para Instâncias OCI Compute */
export interface OciComputeMetadata {
  shape: string; // Ex: 'VM.Standard.A1.Flex', 'VM.Standard.E4.Flex'
  ocpuCount: number;
  memoryInGBs: number;
  availabilityDomain: string;
  faultDomain: string;
  publicIp?: string;
  privateIp?: string;
}

/** Metadados para OCI Autonomous Database */
export interface OciDatabaseMetadata {
  dbWorkload: 'OLTP' | 'DW' | 'APEX' | 'AJD';
  cpuCoreCount: number;
  dataStorageSizeInTBs: number;
  isAutoScalingEnabled: boolean;
  dbVersion: string;
}

/** Resumo de Métricas de Desempenho */
export interface MetricsSummary {
  cpuPercent?: number;
  memoryPercent?: number;
  latencyMs?: number;
  errorRatePercent?: number;
  diskPercent?: number;
  networkThroughputMbps?: number;
  activeConnections?: number;
}

/** Recurso de Infraestrutura Cloud Monitorado */
export interface CloudResource {
  id: string;
  ocid?: string; // Identificador oficial OCI
  arn?: string;  // Identificador oficial AWS
  name: string;
  service: CloudServiceType;
  provider: CloudProvider;
  region: string;
  compartmentId?: string; // Compartimento OCI
  status: HealthStatus;
  lifecycleState: LifecycleState;
  availabilitySla: number; // Ex: 99.98%
  tags: Record<string, string>;
  metricsSummary: MetricsSummary;
  monthlyCostEstimate: number; // Em USD
  lastHealthCheck: string;
  isPinned?: boolean;
  metadata?: OciComputeMetadata | OciDatabaseMetadata | Record<string, any>;
}

/** Ponto de Série Temporal de Métricas para Gráficos */
export interface MetricDataPoint {
  timestamp: string;
  value: number;
  unit: 'Percent' | 'Milliseconds' | 'Count' | 'Bytes' | 'Gigabytes' | 'MBps';
}

/** Regra de Limite de Alerta Configurável */
export interface AlertRule {
  id: string;
  resourceId: string;
  resourceName: string;
  metricName: UnifiedMetricName;
  operator: '>' | '>=' | '<' | '<=' | '==';
  threshold: number;
  severity: SeverityLevel;
  isEnabled: boolean;
  notificationChannels: NotificationChannel[];
  createdAt: string;
}

/** Registro Histórico de Incidentes Disparados */
export interface AlertIncident {
  id: string;
  ruleId: string;
  resourceId: string;
  resourceName: string;
  provider: CloudProvider;
  severity: SeverityLevel;
  triggeredAt: string;
  resolvedAt?: string;
  valueRecorded: number;
  threshold: number;
  status: 'ACTIVE' | 'RESOLVED' | 'ACKNOWLEDGED';
  message: string;
}

/** Registro de Log Centralizado (OCI Logging / CloudWatch) */
export interface CloudLogEvent {
  id: string;
  resourceId: string;
  timestamp: string;
  severity: 'INFO' | 'WARN' | 'ERROR';
  logGroup: string;
  logStream?: string;
  message: string;
}

/** Registro de Auditoria Local */
export interface AuditLogEntry {
  id: string;
  userId: string;
  action: 'LOGIN' | 'ALERT_RULE_CHANGED' | 'CRITICAL_DATA_VIEWED' | 'CONFIG_EXPORTED' | 'ACCOUNT_ADDED';
  resourceId?: string;
  timestamp: string;
  details: string;
}

/** Preferências Globais do Aplicativo */
export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: 'pt-BR' | 'en-US';
  defaultTimezone: string; // Ex: 'America/Sao_Paulo'
  offlineFirstEnabled: boolean;
  biometricAuthEnabled: boolean;
  pushNotificationsEnabled: boolean;
  hapticFeedbackEnabled: boolean;
  simulationModeActive: boolean;
  autoRefreshIntervalSeconds: number; // Ex: 30
}
