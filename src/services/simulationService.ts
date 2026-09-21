/**
 * CloudWatch Dashboard - Serviço de Simulação com Dual-Engine (Faker / OCI)
 * Gera métricas realistas, recursos e logs com foco prioritário na Oracle Cloud (OCI).
 * Aluno: João Gabriel Barros Guimarães - FATEC 4DSM
 */

import type {
  CloudResource,
  CloudProvider,
  CloudServiceType,
  HealthStatus,
  MetricDataPoint,
  CloudLogEvent,
  AlertIncident,
} from '../types';

// Gerador pseudo-aleatório seguro e sem dependências rígidas para garantir execução imediata
const getRandomInt = (min: number, max: number): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const getRandomFloat = (min: number, max: number, decimals = 1): number => {
  const str = (Math.random() * (max - min) + min).toFixed(decimals);
  return parseFloat(str);
};

const pickRandom = <T>(items: T[]): T => {
  return items[Math.floor(Math.random() * items.length)];
};

/**
 * Gera a lista inicial ou atualizada de recursos em nuvem (OCI Primário + AWS + GCP)
 */
export const generateSimulatedResources = (): CloudResource[] => {
  const now = new Date().toISOString();

  // 1. Instância OCI Compute (VM.Standard.A1.Flex - ARM Ampere)
  const ociCpu1 = getRandomFloat(88, 97);
  const ociStatus1: HealthStatus = ociCpu1 > 90 ? 'CRITICAL' : 'WARNING';

  // 2. OCI Autonomous Database (ATP Serverless)
  const ociCpu2 = getRandomFloat(15, 38);

  // 3. AWS EC2 Prod Web Cluster
  const awsCpu1 = getRandomFloat(25, 45);

  // 4. OCI Object Storage Vault
  const ociStorageUsage = getRandomFloat(40, 65);

  // 5. Google Cloud Run API Gateway
  const gcpErrors = getRandomFloat(1.5, 3.8);
  const gcpStatus: HealthStatus = gcpErrors > 2.5 ? 'WARNING' : 'HEALTHY';

  // 6. AWS Lambda Serverless Auth
  const awsLambdaDuration = getRandomFloat(70, 110);

  return [
    {
      id: 'res-oci-01',
      ocid: 'ocid1.instance.oc1.sa-saopaulo-1.ab2x.aaaaaaaak73mf9b2k',
      name: 'OCI - VM.Standard.A1.Flex',
      service: 'OCI_COMPUTE',
      provider: 'OCI',
      region: 'sa-saopaulo-1',
      compartmentId: 'ocid1.compartment.oc1..production-workloads',
      status: ociStatus1,
      lifecycleState: 'RUNNING',
      availabilitySla: 99.95,
      tags: { Environment: 'Production', Project: 'Core-API', Tier: 'Compute' },
      metricsSummary: {
        cpuPercent: ociCpu1,
        memoryPercent: getRandomFloat(80, 92),
        latencyMs: getRandomFloat(3.5, 6.2),
        diskPercent: 54,
        networkThroughputMbps: getRandomFloat(240, 480),
      },
      monthlyCostEstimate: 48.0,
      lastHealthCheck: now,
      metadata: {
        shape: 'VM.Standard.A1.Flex',
        ocpuCount: 4,
        memoryInGBs: 24,
        availabilityDomain: 'sa-saopaulo-1-AD-1',
        faultDomain: 'FAULT-DOMAIN-1',
        publicIp: '144.22.108.45',
        privateIp: '10.0.1.15',
      },
    },
    {
      id: 'res-oci-02',
      ocid: 'ocid1.autonomousdatabase.oc1.sa-saopaulo-1.ab2x.atp01',
      name: 'OCI - Autonomous DB (ATP)',
      service: 'OCI_DATABASE',
      provider: 'OCI',
      region: 'sa-saopaulo-1',
      compartmentId: 'ocid1.compartment.oc1..production-workloads',
      status: 'HEALTHY',
      lifecycleState: 'RUNNING',
      availabilitySla: 99.99,
      tags: { Environment: 'Production', Engine: 'Oracle-Autonomous-23ai' },
      metricsSummary: {
        cpuPercent: ociCpu2,
        memoryPercent: getRandomFloat(40, 55),
        latencyMs: getRandomFloat(1.2, 2.8),
        diskPercent: 41,
        activeConnections: getRandomInt(45, 80),
      },
      monthlyCostEstimate: 120.0,
      lastHealthCheck: now,
      metadata: {
        dbWorkload: 'OLTP',
        cpuCoreCount: 2,
        dataStorageSizeInTBs: 1,
        isAutoScalingEnabled: true,
        dbVersion: '23ai',
      },
    },
    {
      id: 'res-aws-01',
      arn: 'arn:aws:ec2:us-east-1:123456789012:instance/i-09f83a2bc71',
      name: 'AWS - EC2 Prod Web Cluster',
      service: 'EC2',
      provider: 'AWS',
      region: 'us-east-1',
      status: 'HEALTHY',
      lifecycleState: 'RUNNING',
      availabilitySla: 99.95,
      tags: { Environment: 'Production', Role: 'WebServer' },
      metricsSummary: {
        cpuPercent: awsCpu1,
        memoryPercent: getRandomFloat(45, 60),
        latencyMs: getRandomFloat(12, 18),
        diskPercent: 38,
      },
      monthlyCostEstimate: 95.0,
      lastHealthCheck: now,
    },
    {
      id: 'res-gcp-01',
      name: 'GCP - Cloud Run API Gateway',
      service: 'GCP_RUN',
      provider: 'GCP',
      region: 'southamerica-east1',
      status: gcpStatus,
      lifecycleState: 'RUNNING',
      availabilitySla: 99.9,
      tags: { Environment: 'Production', Service: 'API-Gateway' },
      metricsSummary: {
        cpuPercent: getRandomFloat(65, 78),
        memoryPercent: getRandomFloat(50, 70),
        errorRatePercent: gcpErrors,
        latencyMs: getRandomFloat(45, 95),
      },
      monthlyCostEstimate: 35.0,
      lastHealthCheck: now,
    },
    {
      id: 'res-oci-03',
      ocid: 'ocid1.bucket.oc1.sa-saopaulo-1.backupvault',
      name: 'OCI - Object Storage Vault',
      service: 'OCI_STORAGE',
      provider: 'OCI',
      region: 'sa-saopaulo-1',
      compartmentId: 'ocid1.compartment.oc1..storage-vault',
      status: 'HEALTHY',
      lifecycleState: 'RUNNING',
      availabilitySla: 99.999,
      tags: { Tier: 'Standard-Storage', Retention: '90-Days' },
      metricsSummary: {
        diskPercent: ociStorageUsage,
        latencyMs: getRandomFloat(15, 25),
      },
      monthlyCostEstimate: 18.5,
      lastHealthCheck: now,
    },
    {
      id: 'res-aws-02',
      arn: 'arn:aws:lambda:us-east-1:123456789012:function:fn-auth-payment',
      name: 'AWS - Lambda Payment Handler',
      service: 'LAMBDA',
      provider: 'AWS',
      region: 'us-east-1',
      status: 'HEALTHY',
      lifecycleState: 'RUNNING',
      availabilitySla: 99.99,
      tags: { Runtime: 'Nodejs20', Serverless: 'True' },
      metricsSummary: {
        cpuPercent: getRandomFloat(10, 20),
        latencyMs: awsLambdaDuration,
        errorRatePercent: 0.1,
      },
      monthlyCostEstimate: 12.0,
      lastHealthCheck: now,
    },
  ];
};

/**
 * Gera série temporal realista para os gráficos vetoriais (últimas 24 horas)
 */
export const generateTimeSeriesMetrics = (
  resourceId: string,
  metricType = 'CpuUtilization'
): MetricDataPoint[] => {
  const points: MetricDataPoint[] = [];
  const now = Date.now();
  const stepMs = 30 * 60 * 1000; // Intervalos de 30 minutos (48 pontos para 24h)

  // Determina patamar base dependendo do recurso
  let baseValue = resourceId.includes('res-oci-01') ? 85 : 30;

  for (let i = 48; i >= 0; i--) {
    const time = new Date(now - i * stepMs).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    // Variação orgânica com ruído realista
    const fluctuation = getRandomFloat(-8, 9);
    let val = Math.max(5, Math.min(99, baseValue + fluctuation));

    // Simula pico crítico recente para o recurso problemático
    if (resourceId.includes('res-oci-01') && i <= 4) {
      val = getRandomFloat(92, 98.4);
    }

    points.push({
      timestamp: time,
      value: val,
      unit: 'Percent',
    });
  }

  return points;
};

/**
 * Gera logs de eventos simulados da OCI e CloudWatch
 */
export const generateSimulatedLogs = (resourceId: string): CloudLogEvent[] => {
  const now = new Date();
  const formatTime = (minutesAgo: number) => {
    return new Date(now.getTime() - minutesAgo * 60000).toLocaleTimeString();
  };

  if (resourceId.includes('res-oci-01')) {
    return [
      {
        id: 'log-oci-1',
        resourceId,
        timestamp: formatTime(2),
        severity: 'ERROR',
        logGroup: 'oci-compute-syslog',
        logStream: 'instance-vnic-01',
        message: 'CPUUtilization reached 96.4% threshold on VM.Standard.A1.Flex worker-thread #04.',
      },
      {
        id: 'log-oci-2',
        resourceId,
        timestamp: formatTime(6),
        severity: 'WARN',
        logGroup: 'oci-monitoring-service',
        logStream: 'alarm-evaluator',
        message: 'High memory saturation warning: allocated 21.8 GB of 24.0 GB total.',
      },
      {
        id: 'log-oci-3',
        resourceId,
        timestamp: formatTime(14),
        severity: 'INFO',
        logGroup: 'oci-audit',
        logStream: 'audit-events',
        message: 'HealthCheck probe HTTP /ready returned 200 OK from region sa-saopaulo-1.',
      },
    ];
  }

  return [
    {
      id: 'log-gen-1',
      resourceId,
      timestamp: formatTime(3),
      severity: 'INFO',
      logGroup: 'cloud-monitor-service',
      message: 'Telemetry metrics synced successfully with region endpoints.',
    },
    {
      id: 'log-gen-2',
      resourceId,
      timestamp: formatTime(10),
      severity: 'INFO',
      logGroup: 'cloud-monitor-service',
      message: 'Connection pool verified: 100% operational.',
    },
  ];
};

/**
 * Gera lista de incidentes e alertas ativos
 */
export const generateSimulatedIncidents = (): AlertIncident[] => {
  return [
    {
      id: 'inc-01',
      ruleId: 'rule-cpu-critical',
      resourceId: 'res-oci-01',
      resourceName: 'OCI - VM.Standard.A1.Flex',
      provider: 'OCI',
      severity: 'CRITICAL',
      triggeredAt: new Date(Date.now() - 12 * 60000).toISOString(),
      valueRecorded: 96.4,
      threshold: 85.0,
      status: 'ACTIVE',
      message: 'Uso de CPU excedeu 85% por mais de 5 minutos consecutivos.',
    },
    {
      id: 'inc-02',
      ruleId: 'rule-gcp-errors',
      resourceId: 'res-gcp-01',
      resourceName: 'GCP - Cloud Run API Gateway',
      provider: 'GCP',
      severity: 'WARN',
      triggeredAt: new Date(Date.now() - 45 * 60000).toISOString(),
      valueRecorded: 2.8,
      threshold: 2.0,
      status: 'ACTIVE',
      message: 'Taxa de erros HTTP 5XX superior ao limiar de segurança de 2%.',
    },
  ];
};
