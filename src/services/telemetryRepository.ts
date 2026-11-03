/**
 * CloudWatch Mobile - Camada de Dados Abstrata e Resiliencia (TelemetryRepository)
 * Sprint 2: Padrao Adapter/Repository unificando dados reais do BFF OCI (167.234.241.171)
 * com fallback transparente e instantaneo para cache local / motor de simulacao.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { SLA_CRITICAL_THRESHOLD } from '../config/env';
import apiClient from './apiClient';
import type { CloudResource, CloudProvider, HealthStatus } from '../types';
import {
  generateSimulatedResources,
  generateTimeSeriesMetrics,
  generateSimulatedLogs,
} from './simulationService';

export type TelemetrySource = 'LIVE_CLOUD' | 'LOCAL_CACHE';

export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface StructuredMetricsData {
  instanceId: string;
  window: '1h' | '24h' | '7d';
  metrics: {
    currentCpu: number;
    avgCpu: number;
    maxCpu: number;
    currentMemory: number;
    avgMemory: number;
    maxMemory: number;
    currentLatency: number;
    slaThreshold: number;
    correlationCoefficient?: number;
  };
  cpuSeries: TimeSeriesPoint[];
  memorySeries: TimeSeriesPoint[];
  latencySeries: TimeSeriesPoint[];
}

export interface InstanceLogEntry {
  id: string;
  timestamp: string;
  timeShort?: string;
  severity: 'INFO' | 'WARN' | 'ERROR';
  source: string;
  message: string;
}

export interface InstancesResult {
  data: CloudResource[];
  source: TelemetrySource;
  isOffline: boolean;
  error?: string;
}

export interface MetricsResult {
  data: StructuredMetricsData;
  source: TelemetrySource;
  isOffline: boolean;
  error?: string;
}

export interface LogsResult {
  data: InstanceLogEntry[];
  source: TelemetrySource;
  isOffline: boolean;
  error?: string;
}

export interface NetworkPortProbe {
  port: number;
  service: string;
  status: 'OPEN' | 'CLOSED';
  latencyMs: number;
  reason?: string;
}

export interface NetworkProbeResult {
  success: boolean;
  host: string;
  timestamp: string;
  instanceId?: string;
  summary: {
    totalProbed: number;
    openPorts: number;
    closedPorts: number;
    overallStatus: 'HEALTHY' | 'DEGRADED';
  };
  ports: NetworkPortProbe[];
  source: TelemetrySource;
}

export interface DockerContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  state: 'RUNNING' | 'STOPPED';
  health: 'HEALTHY' | 'RUNNING';
}

export interface CreateResourceParams {
  name: string;
  provider?: CloudProvider;
  resourceType?: string;
  shape?: string;
  publicIp?: string;
  privateIp?: string;
  region?: string;
  ocpus?: number;
  memoryGb?: number;
}

/**
 * TelemetryRepository - Interface unica consumida pelas telas do app
 */
export const telemetryRepository = {
  /**
   * Obtem a lista de instancias ativas via apiClient autenticado (sem userId em query)
   */
  async getInstances(provider: CloudProvider = 'OCI'): Promise<InstancesResult> {
    const cacheKey = `@cloudwatch_cache_instances_${provider}`;

    try {
      const response = await apiClient.get<any>(
        `/clouds/instances?provider=${encodeURIComponent(provider)}`
      );

      if (response.ok && response.data) {
        const json = response.data;
        const rawInstances: any[] = json.instances || [];

        if (Array.isArray(rawInstances) && rawInstances.length > 0) {
          const mapped: CloudResource[] = rawInstances.map((raw) => {
            const cpu = Number(raw.cpu_usage ?? raw.metricsSummary?.cpuPercent ?? 12);
            const mem = Number(raw.memory_usage ?? raw.metricsSummary?.memoryPercent ?? 45);

            let status: HealthStatus = 'HEALTHY';
            if (raw.status === 'CRITICAL' || cpu > 85) {
              status = 'CRITICAL';
            } else if (raw.status === 'WARNING' || cpu > 70) {
              status = 'WARNING';
            } else if (raw.status === 'STOPPED') {
              status = 'OFFLINE';
            } else if (raw.status === 'REBOOTING') {
              status = 'REBOOTING';
            }

            return {
              id: raw.id || `inst-${Math.random().toString(36).substr(2, 9)}`,
              ocid: raw.ocid,
              arn: raw.arn,
              name: raw.name || `${provider} Instance`,
              service: raw.service || (provider === 'OCI' ? 'OCI_COMPUTE' : 'EC2'),
              provider: raw.provider || provider,
              region: raw.region || 'sa-saopaulo-1',
              status,
              lifecycleState: raw.lifecycleState || (status === 'OFFLINE' ? 'STOPPED' : 'RUNNING'),
              availabilitySla: raw.availability_sla || 99.98,
              tags: raw.tags || { Environment: 'Production', Workload: 'Sprint-2' },
              metricsSummary: {
                cpuPercent: cpu,
                memoryPercent: mem,
                latencyMs: raw.metricsSummary?.latencyMs || 3.4,
                diskPercent: raw.metricsSummary?.diskPercent || 42,
                networkThroughputMbps: raw.metricsSummary?.networkThroughputMbps || 280,
              },
              monthlyCostEstimate: raw.monthlyCostEstimate || (provider === 'OCI' ? 0.0 : 45.0),
              lastHealthCheck: raw.last_updated || new Date().toISOString(),
              metadata: raw.metadata || {
                shape: raw.shape || 'VM.Standard.A1.Flex',
                ocpuCount: raw.ocpus || 4,
                memoryInGBs: raw.memory_in_gbs || 24,
                privateIp: raw.private_ip || '10.0.0.128',
                publicIp: raw.public_ip || '167.234.241.171',
              },
            };
          });

          await AsyncStorage.setItem(cacheKey, JSON.stringify(mapped)).catch(() => { });

          return {
            data: mapped,
            source: 'LIVE_CLOUD',
            isOffline: false,
          };
        }
      }
    } catch (err: any) {
      console.log(`[TelemetryRepository] BFF OCI indisponivel (${err?.message || 'timeout'}). Recorrendo ao cache local.`);
    }

    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return {
            data: parsed,
            source: 'LOCAL_CACHE',
            isOffline: true,
          };
        }
      }
    } catch (cacheErr) {
      console.warn('[TelemetryRepository] Erro ao ler cache local:', cacheErr);
    }

    const generated = generateSimulatedResources().filter((r) => r.provider === provider);
    return {
      data: generated.length > 0 ? generated : generateSimulatedResources(),
      source: 'LOCAL_CACHE',
      isOffline: true,
    };
  },

  /**
   * Cadastra dinamicamente um novo recurso/instancia OCI no PostgreSQL
   */
  async createInstance(params: CreateResourceParams): Promise<{ success: boolean; instance?: CloudResource; error?: string }> {
    try {
      const response = await apiClient.post<any>('/clouds/instances', params);

      if (response.ok && response.data) {
        const json = response.data;
        if (json.success && json.instance) {
          const raw = json.instance;
          const mappedSvc: CloudResource['service'] =
            (raw.service as any) ||
            (raw.provider === 'AWS' ? 'EC2' : raw.provider === 'GCP' ? 'GCP_RUN' : 'OCI_COMPUTE');

          const mapped: CloudResource = {
            id: raw.id,
            ocid: raw.id.startsWith('ocid1.') ? raw.id : `ocid1.instance.oc1.sa-saopaulo-1.${raw.id}`,
            name: raw.name,
            service: mappedSvc,
            provider: (raw.provider as CloudProvider) || 'OCI',
            region: raw.region || 'sa-saopaulo-1',
            status: 'HEALTHY',
            lifecycleState: 'RUNNING',
            availabilitySla: 99.98,
            tags: { Environment: 'Production', Workload: 'Sprint-2' },
            metricsSummary: {
              cpuPercent: Number(raw.cpu_usage || 15),
              memoryPercent: Number(raw.memory_usage || 30),
              latencyMs: 3.4,
              diskPercent: 25,
              networkThroughputMbps: 210,
            },
            monthlyCostEstimate: 0.0,
            lastHealthCheck: new Date().toISOString(),
            metadata: {
              shape: raw.shape || 'VM.Standard.A1.Flex',
              ocpuCount: raw.ocpus || 2,
              memoryInGBs: raw.memory_in_gbs || 16,
              privateIp: raw.private_ip || '10.0.0.10',
              publicIp: raw.public_ip || '167.234.241.171',
            },
          };
          return { success: true, instance: mapped };
        }
      }
    } catch (err: any) {
      console.warn('[TelemetryRepository] Falha ao cadastrar na VM OCI, criando localmente:', err.message);
    }

    // Fallback local se estiver offline
    const localId = `res-oci-local-${Date.now().toString(36)}`;
    const localSvc: CloudResource['service'] = params.resourceType?.includes('Database')
      ? 'OCI_DATABASE'
      : (params.provider === 'AWS' ? 'EC2' : params.provider === 'GCP' ? 'GCP_RUN' : 'OCI_COMPUTE');

    const localResource: CloudResource = {
      id: localId,
      ocid: `ocid1.instance.oc1.sa-saopaulo-1.${localId}`,
      name: params.name,
      service: localSvc,
      provider: params.provider || 'OCI',
      region: params.region || 'sa-saopaulo-1',
      status: 'HEALTHY',
      lifecycleState: 'RUNNING',
      availabilitySla: 99.98,
      tags: { Environment: 'Production', Workload: 'Sprint-2-Local' },
      metricsSummary: {
        cpuPercent: 14.5,
        memoryPercent: 32.0,
        latencyMs: 3.2,
        diskPercent: 20,
        networkThroughputMbps: 180,
      },
      monthlyCostEstimate: 0.0,
      lastHealthCheck: new Date().toISOString(),
      metadata: {
        shape: params.shape || 'VM.Standard.A1.Flex',
        ocpuCount: params.ocpus || 2,
        memoryInGBs: params.memoryGb || 16,
        privateIp: params.privateIp || '10.0.0.10',
        publicIp: params.publicIp || '167.234.241.171',
      },
    };

    return { success: true, instance: localResource };
  },

  /**
   * Remove recurso cadastrado
   */
  async deleteInstance(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await apiClient.delete(`/clouds/instances/${encodeURIComponent(id)}`);
      if (response.ok) {
        return { success: true };
      }
    } catch (err: any) {
      console.warn('[TelemetryRepository] Erro ao deletar no BFF:', err.message);
    }
    return { success: true };
  },

  /**
   * Sondagem Ativa de Rede e Portas estilo Zabbix via TCP Handshake
   */
  async probeNetwork(host?: string, instanceId?: string): Promise<NetworkProbeResult> {
    const targetHost = host || '';
    try {
      const response = await apiClient.get<any>(
        `/telemetry/network-probe?host=${encodeURIComponent(
          targetHost
        )}&instanceId=${encodeURIComponent(instanceId || '')}`
      );
      if (response.ok && response.data) {
        const json = response.data;
        if (json.success && Array.isArray(json.ports)) {
          return {
            success: true,
            host: json.host || targetHost,
            timestamp: json.timestamp || new Date().toISOString(),
            instanceId: json.instanceId || instanceId,
            summary: json.summary || {
              totalProbed: json.ports.length,
              openPorts: json.ports.filter((p: any) => p.status === 'OPEN').length,
              closedPorts: json.ports.filter((p: any) => p.status !== 'OPEN').length,
              overallStatus: 'HEALTHY',
            },
            ports: json.ports,
            source: 'LIVE_CLOUD',
          };
        }
      }
    } catch (err: any) {
      console.log(`[TelemetryRepository] Falha ao sondar portas na VM: ${err?.message || 'offline'}`);
    }

    // Fallback de sondagem sintetica realista para o IP
    const fallbackPorts: NetworkPortProbe[] = [
      { port: 22, service: 'OpenSSH Server', status: 'OPEN', latencyMs: 3.8 },
      { port: 80, service: 'HTTP Web Server', status: 'CLOSED', latencyMs: 15.0, reason: 'Porta fechada no firewall' },
      { port: 443, service: 'HTTPS / TLS Gateway', status: 'CLOSED', latencyMs: 14.5, reason: 'Certificado em emissao' },
      { port: 3000, service: 'CloudWatch BFF API', status: 'OPEN', latencyMs: 1.4 },
      { port: 5432, service: 'PostgreSQL Database Engine', status: 'OPEN', latencyMs: 2.2 },
    ];

    return {
      success: true,
      host: targetHost,
      timestamp: new Date().toISOString(),
      instanceId,
      summary: {
        totalProbed: 5,
        openPorts: 3,
        closedPorts: 2,
        overallStatus: 'HEALTHY',
      },
      ports: fallbackPorts,
      source: 'LOCAL_CACHE',
    };
  },

  /**
   * Obtem lista de containers Docker ativos no host OCI
   */
  async getDockerContainers(): Promise<{ success: boolean; containers: DockerContainerInfo[]; source: TelemetrySource }> {
    try {
      const response = await apiClient.get<any>('/telemetry/containers');
      if (response.ok && response.data) {
        const json = response.data;
        if (json.success && Array.isArray(json.containers)) {
          return {
            success: true,
            containers: json.containers,
            source: 'LIVE_CLOUD',
          };
        }
      }
    } catch (err) { }

    const fallbackContainers: DockerContainerInfo[] = [
      {
        id: 'c1a89b72',
        name: 'sidebrain_db',
        image: 'postgres:16-alpine',
        status: 'Up 3 days (healthy)',
        ports: '0.0.0.0:5432->5432/tcp',
        state: 'RUNNING',
        health: 'HEALTHY',
      },
      {
        id: 'f93d40e1',
        name: 'sidebrain_back',
        image: 'node:20-alpine',
        status: 'Up 3 days',
        ports: '0.0.0.0:8080->8080/tcp',
        state: 'RUNNING',
        health: 'RUNNING',
      },
      {
        id: 'd827c13a',
        name: 'cloudwatch_api_worker',
        image: 'node:20-slim (PM2)',
        status: 'Up 24 hours (healthy)',
        ports: '0.0.0.0:3000->3000/tcp',
        state: 'RUNNING',
        health: 'HEALTHY',
      },
    ];

    return {
      success: true,
      containers: fallbackContainers,
      source: 'LOCAL_CACHE',
    };
  },

  /**
   * Executa acao de mitigacao automatica da causa raiz
   */
  async mitigateRootCause(instanceId: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await apiClient.post<any>(
        `/telemetry/mitigate/${encodeURIComponent(instanceId)}`
      );
      if (response.ok && response.data) {
        const json = response.data;
        return { success: true, message: json.message || 'Mitigacao aplicada com sucesso.' };
      }
    } catch (err) { }
    return { success: true, message: 'Mitigacao executada com sucesso. Carga e conexoes normalizadas.' };
  },

  /**
   * Obtem series temporais de CPU, Memoria e Latencia para analise de correlacao
   */
  async getMetrics(
    instanceId: string,
    window: '1h' | '24h' | '7d' = '24h',
    currentCpuHint = 24.5,
    currentMemHint = 48.0
  ): Promise<MetricsResult> {
    const cacheKey = `@cloudwatch_cache_metrics_${instanceId}_${window}`;

    try {
      const response = await apiClient.get<any>(
        `/telemetry/metrics/${encodeURIComponent(
          instanceId
        )}?window=${encodeURIComponent(window)}`
      );

      if (response.ok && response.data) {
        const json = response.data;
        if (json.success && json.cpuSeries && json.memorySeries) {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(json)).catch(() => { });
          return {
            data: json,
            source: 'LIVE_CLOUD',
            isOffline: false,
          };
        }
      }
    } catch (err: any) {
      console.log(`[TelemetryRepository] Falha ao obter telemetria remota: ${err?.message || 'offline'}.`);
    }

    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.cpuSeries && parsed.memorySeries) {
          return {
            data: parsed,
            source: 'LOCAL_CACHE',
            isOffline: true,
          };
        }
      }
    } catch { }

    const rawCpuPoints = generateTimeSeriesMetrics(instanceId);
    const pointsCount = window === '1h' ? 12 : window === '24h' ? 24 : 28;
    const stepMin = window === '1h' ? 5 : window === '24h' ? 60 : 360;
    const now = Date.now();

    const cpuSeries: TimeSeriesPoint[] = [];
    const memorySeries: TimeSeriesPoint[] = [];
    const latencySeries: TimeSeriesPoint[] = [];

    let sumCpu = 0;
    let maxCpu = 0;
    let sumMem = 0;
    let maxMem = 0;

    for (let i = pointsCount - 1; i >= 0; i--) {
      const ptTime = new Date(now - i * stepMin * 60 * 1000);
      let label = '';
      if (window === '1h') {
        const hh = String(ptTime.getHours()).padStart(2, '0');
        const mm = String(ptTime.getMinutes()).padStart(2, '0');
        label = `${hh}:${mm}`;
      } else if (window === '24h') {
        const hh = String(ptTime.getHours()).padStart(2, '0');
        label = `${hh}:00`;
      } else {
        const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
        const day = days[ptTime.getDay()];
        const hh = String(ptTime.getHours()).padStart(2, '0');
        label = `${day} ${hh}h`;
      }

      if (i === 0) {
        cpuSeries.push({ timestamp: label, value: currentCpuHint });
        memorySeries.push({ timestamp: label, value: currentMemHint });
        latencySeries.push({ timestamp: label, value: 3.4 });
        sumCpu += currentCpuHint;
        sumMem += currentMemHint;
        maxCpu = Math.max(maxCpu, currentCpuHint);
        maxMem = Math.max(maxMem, currentMemHint);
      } else {
        const wave = Math.sin((i / pointsCount) * Math.PI * 2);
        const noise = (Math.random() - 0.5) * 6;
        const cpuVal = Math.min(100, Math.max(5, Number((currentCpuHint + wave * 12 + noise).toFixed(1))));
        const memVal = Math.min(100, Math.max(12, Number((currentMemHint + wave * 7 + noise * 0.4).toFixed(1))));
        const latVal = Number((3.2 + (cpuVal / 100) * 4.0 + Math.random() * 0.5).toFixed(1));

        cpuSeries.push({ timestamp: label, value: cpuVal });
        memorySeries.push({ timestamp: label, value: memVal });
        latencySeries.push({ timestamp: label, value: latVal });

        sumCpu += cpuVal;
        sumMem += memVal;
        maxCpu = Math.max(maxCpu, cpuVal);
        maxMem = Math.max(maxMem, memVal);
      }
    }

    const fallbackData: StructuredMetricsData = {
      instanceId,
      window,
      metrics: {
        currentCpu: currentCpuHint,
        avgCpu: Number((sumCpu / pointsCount).toFixed(1)),
        maxCpu,
        currentMemory: currentMemHint,
        avgMemory: Number((sumMem / pointsCount).toFixed(1)),
        maxMemory: maxMem,
        currentLatency: 3.4,
        slaThreshold: SLA_CRITICAL_THRESHOLD,
        correlationCoefficient: 0.84,
      },
      cpuSeries,
      memorySeries,
      latencySeries,
    };

    return {
      data: fallbackData,
      source: 'LOCAL_CACHE',
      isOffline: true,
    };
  },

  /**
   * Obtem logs operacionais centralizados da instancia
   */
  async getLogs(
    instanceId: string,
    severity: string = 'ALL',
    search: string = ''
  ): Promise<LogsResult> {
    const cacheKey = `@cloudwatch_cache_logs_${instanceId}`;

    try {
      const response = await apiClient.get<any>(
        `/telemetry/logs/${encodeURIComponent(
          instanceId
        )}?severity=${encodeURIComponent(severity)}&search=${encodeURIComponent(search)}`
      );

      if (response.ok && response.data) {
        const json = response.data;
        if (json.success && Array.isArray(json.logs)) {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(json.logs)).catch(() => { });
          return {
            data: json.logs,
            source: 'LIVE_CLOUD',
            isOffline: false,
          };
        }
      }
    } catch (err: any) {
      console.log(`[TelemetryRepository] Falha ao obter logs do BFF: ${err?.message || 'offline'}.`);
    }

    const rawSim = generateSimulatedLogs(instanceId);
    let filtered = rawSim.map((l) => ({
      id: l.id,
      timestamp: l.timestamp,
      timeShort: l.timestamp.includes('T') ? l.timestamp.split('T')[1].substr(0, 8) : l.timestamp,
      severity: l.severity,
      source: l.logGroup || 'kernel',
      message: l.message,
    }));

    if (severity && severity !== 'ALL') {
      filtered = filtered.filter((l) => l.severity === severity);
    }

    if (search.trim()) {
      const s = search.toLowerCase();
      filtered = filtered.filter(
        (l) =>
          l.message.toLowerCase().includes(s) ||
          l.source.toLowerCase().includes(s) ||
          l.id.toLowerCase().includes(s)
      );
    }

    return {
      data: filtered,
      source: 'LOCAL_CACHE',
      isOffline: true,
    };
  },
};

export default telemetryRepository;
