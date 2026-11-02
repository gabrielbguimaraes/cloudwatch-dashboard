/**
 * CloudWatch Mobile - Camada de Dados Abstrata e Resiliencia (TelemetryRepository)
 * Sprint 2: Padrao Adapter/Repository unificando dados reais do BFF OCI (167.234.241.171)
 * com fallback transparente e instantaneo para cache local / motor de simulacao.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, REQUEST_TIMEOUT_MS, SLA_CRITICAL_THRESHOLD } from '../config/env';
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

/**
 * Utilitario de requisicao HTTP com AbortController e timeout estrito (4.5s)
 */
const fetchWithTimeout = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(options.headers || {}),
      },
    });
    clearTimeout(timeoutId);
    return res;
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
};

/**
 * TelemetryRepository - Interface unica consumida pelas telas do app
 */
export const telemetryRepository = {
  /**
   * Obtem a lista de instancias ativas (Tenta BFF OCI -> Cache AsyncStorage -> Motor Local)
   */
  async getInstances(provider: CloudProvider = 'OCI', userId?: string): Promise<InstancesResult> {
    const cacheKey = `@cloudwatch_cache_instances_${provider}`;

    try {
      const url = `${API_BASE_URL}/clouds/instances?provider=${encodeURIComponent(
        provider
      )}&userId=${encodeURIComponent(userId || '')}`;

      const response = await fetchWithTimeout(url, { method: 'GET' });

      if (response.ok) {
        const json = await response.json();
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

          // Grava no cache persistido
          await AsyncStorage.setItem(cacheKey, JSON.stringify(mapped)).catch(() => {});

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

    // Fallback 1: Cache local persistido do AsyncStorage
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

    // Fallback 2: Motor de simulacao robusto
    const generated = generateSimulatedResources().filter((r) => r.provider === provider);
    return {
      data: generated.length > 0 ? generated : generateSimulatedResources(),
      source: 'LOCAL_CACHE',
      isOffline: true,
    };
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
      const url = `${API_BASE_URL}/telemetry/metrics/${encodeURIComponent(
        instanceId
      )}?window=${encodeURIComponent(window)}`;

      const response = await fetchWithTimeout(url, { method: 'GET' });

      if (response.ok) {
        const json = await response.json();
        if (json.success && json.cpuSeries && json.memorySeries) {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(json)).catch(() => {});
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

    // Fallback 1: Cache de metricas
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
    } catch {}

    // Fallback 2: Gerador sintetico de serie temporal com correlacao
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
      const url = `${API_BASE_URL}/telemetry/logs/${encodeURIComponent(
        instanceId
      )}?severity=${encodeURIComponent(severity)}&search=${encodeURIComponent(search)}`;

      const response = await fetchWithTimeout(url, { method: 'GET' });

      if (response.ok) {
        const json = await response.json();
        if (json.success && Array.isArray(json.logs)) {
          await AsyncStorage.setItem(cacheKey, JSON.stringify(json.logs)).catch(() => {});
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

    // Fallback local: gera logs simulados e aplica filtros
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
