/**
 * CloudWatch Dashboard - Contexto Global de Nuvem (CloudContext)
 * Fase 3:
 *  - 100% conectado aos dados reais da OCI via TelemetryRepository (LIVE_OCI | CACHE)
 *  - Modo simulacao permanentemente desligado (isSimulationMode = false, zero chamadas a simulationService)
 *  - Isolamento estrito por usuario no aparelho (limpa estado/pins ao trocar de usuario ou deslogar)
 *  - Nuvens independentes: exibe apenas provedores realmente conectados pelo usuario autenticado.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  CloudResource,
  CloudProvider,
  CloudAccount,
  AlertIncident,
} from '../types';
import { useAuth } from './AuthContext';
import { telemetryRepository, TelemetrySource } from '../services/telemetryRepository';

const getPinnedStorageKey = (userId: string) => `@cloudwatch:pinned_resources:${userId}`;

interface CloudContextData {
  resources: CloudResource[];
  filteredResources: CloudResource[];
  pinnedResources: CloudResource[];
  pinnedResourceIds: string[];
  selectedProvider: CloudProvider | 'ALL';
  activeProvider: CloudProvider;
  connectedProviders: CloudProvider[];
  activeAccount: CloudAccount;
  isSimulationMode: false;
  timeRange: '1h' | '24h' | '7d';
  selectedResource: CloudResource | null;
  activeIncidents: AlertIncident[];
  kpis: {
    total: number;
    healthy: number;
    warning: number;
    critical: number;
    uptimeSla: number;
  };
  isLoading: boolean;
  lastUpdated: string;
  telemetrySource: TelemetrySource;
  isLiveCloud: boolean;
  isOfflineCache: boolean;
  cachedAtHHmm: string | null;
  syncError: string | null;
  policyHint: string | null;
  setProviderFilter: (provider: CloudProvider | 'ALL') => void;
  setActiveProvider: (provider: CloudProvider) => void;
  isProviderConnected: (provider: CloudProvider) => boolean;
  setTimeRange: (range: '1h' | '24h' | '7d') => void;
  setSelectedResource: (resource: CloudResource | null) => void;
  refreshMetrics: (forceRefresh?: boolean) => Promise<void>;
  togglePin: (resourceId: string) => void;
  isResourcePinned: (resourceId: string) => boolean;
  simulateLoadSpike: (resourceId: string) => Promise<void>;
  mitigateAnomaly: (resourceId: string) => Promise<{ ok: boolean; message: string }>;
  provisionInstance: (targetProvider?: CloudProvider) => Promise<CloudResource | null>;
  deleteInstance: (resourceId: string) => Promise<void>;
}

const CloudContext = createContext<CloudContextData>({} as CloudContextData);

export const CloudProviderComponent: React.FC<{ children: ReactNode }> = ({ children }) => {
  const {
    masterUser,
    isAuthenticated,
    cloudAccounts,
    connectedProviders,
    activeProvider: authActiveProvider,
    activeOciAccountId,
    switchActiveProvider,
  } = useAuth();

  const [resources, setResources] = useState<CloudResource[]>([]);
  const [pinnedResourceIds, setPinnedResourceIds] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | 'ALL'>('OCI');
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('24h');
  const [selectedResource, setSelectedResource] = useState<CloudResource | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('—');
  const [telemetrySource, setTelemetrySource] = useState<TelemetrySource>('LIVE_OCI');
  const [isOfflineCache, setIsOfflineCache] = useState<boolean>(false);
  const [cachedAtHHmm, setCachedAtHHmm] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [policyHint, setPolicyHint] = useState<string | null>(null);

  const activeProvider: CloudProvider =
    connectedProviders.includes(authActiveProvider)
      ? authActiveProvider
      : connectedProviders[0] || 'OCI';

  const activeAccount: CloudAccount = useMemo(() => {
    const cfg = cloudAccounts[activeProvider];
    return {
      id: cfg?.id || `acc-${activeProvider.toLowerCase()}`,
      name: cfg?.tenancyName || cfg?.accountIdentifier || `Conta ${activeProvider}`,
      provider: activeProvider,
      defaultRegion: cfg?.region || 'sa-saopaulo-1',
      isSimulationMode: false,
      createdAt: cfg?.lastSyncedAt || new Date().toISOString(),
      updatedAt: cfg?.lastSyncedAt || new Date().toISOString(),
    };
  }, [cloudAccounts, activeProvider]);

  // Limpa completamente o estado em memoria ao deslogar ou trocar de usuario no aparelho
  useEffect(() => {
    if (!isAuthenticated || !masterUser?.id) {
      setResources([]);
      setSelectedResource(null);
      setPinnedResourceIds([]);
      setCachedAtHHmm(null);
      setIsOfflineCache(false);
      setSyncError(null);
      setPolicyHint(null);
      setTelemetrySource('LIVE_OCI');
      setLastUpdated('—');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const storedPinned = await AsyncStorage.getItem(getPinnedStorageKey(masterUser.id));
        if (!cancelled) {
          setPinnedResourceIds(storedPinned ? JSON.parse(storedPinned) : []);
        }
      } catch {
        if (!cancelled) setPinnedResourceIds([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, masterUser?.id]);

  const fetchRealResources = useCallback(
    async (forceRefresh = false) => {
      if (!isAuthenticated || !masterUser?.id) {
        setResources([]);
        setSelectedResource(null);
        return;
      }

      if (connectedProviders.length === 0 || !connectedProviders.includes(activeProvider)) {
        setResources([]);
        setSelectedResource(null);
        setSyncError(null);
        setPolicyHint(null);
        setIsOfflineCache(false);
        setCachedAtHHmm(null);
        setTelemetrySource('LIVE_OCI');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setSyncError(null);

      try {
        const repoRes = await telemetryRepository.getInstances(
          masterUser.id,
          activeProvider,
          activeOciAccountId,
          forceRefresh
        );

        setTelemetrySource(repoRes.source);
        setIsOfflineCache(repoRes.source === 'CACHE');
        setCachedAtHHmm(repoRes.cachedAtHHmm || null);
        setPolicyHint(repoRes.hint || null);
        setSyncError(repoRes.error || null);

        setResources(repoRes.data);
        setSelectedResource((prev) => {
          if (repoRes.data.length === 0) return null;
          if (prev) {
            const match = repoRes.data.find((r) => r.id === prev.id);
            if (match) return match;
          }
          return repoRes.data[0];
        });

        const hhmm =
          repoRes.cachedAtHHmm ||
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setLastUpdated(hhmm);
      } catch (err: any) {
        setSyncError(err?.message || 'Não foi possível sincronizar instâncias da Oracle Cloud.');
      } finally {
        setIsLoading(false);
      }
    },
    [isAuthenticated, masterUser?.id, connectedProviders, activeProvider, activeOciAccountId]
  );

  useEffect(() => {
    fetchRealResources(false);
  }, [fetchRealResources]);

  const isProviderConnected = useCallback(
    (provider: CloudProvider): boolean => connectedProviders.includes(provider),
    [connectedProviders]
  );

  const filteredResources = useMemo(() => {
    if (!connectedProviders.includes(activeProvider)) return [];
    return resources.filter((r) => r.provider === activeProvider);
  }, [resources, activeProvider, connectedProviders]);

  const pinnedResources = useMemo(() => {
    return filteredResources.filter((r) => pinnedResourceIds.includes(r.id));
  }, [filteredResources, pinnedResourceIds]);

  // Incidentes derivados EXCLUSIVAMENTE do estado real das VMs da conta conectada
  const activeIncidents: AlertIncident[] = useMemo(() => {
    return filteredResources
      .filter((r) => r.status === 'CRITICAL' || r.status === 'WARNING')
      .map((r) => {
        const cpu = r.metricsSummary.cpuPercent;
        const mem = r.metricsSummary.memoryPercent;
        const isCpuHigh = typeof cpu === 'number' && cpu > 70;
        const val = isCpuHigh ? cpu! : typeof mem === 'number' ? mem : 0;
        return {
          id: `real-inc-${r.id}`,
          ruleId: 'oci-monitoring-threshold',
          resourceId: r.id,
          resourceName: r.name,
          provider: r.provider,
          severity: r.status === 'CRITICAL' ? 'CRITICAL' : 'WARN',
          triggeredAt: lastUpdated,
          valueRecorded: val,
          threshold: r.status === 'CRITICAL' ? 85 : 70,
          status: 'ACTIVE',
          message:
            r.status === 'CRITICAL'
              ? `Utilização elevada detectada em ${r.name} (${val.toFixed(1)}%).`
              : `Atenção operacional em ${r.name} (${val.toFixed(1)}%).`,
        };
      });
  }, [filteredResources, lastUpdated]);

  const kpis = useMemo(() => {
    const list = filteredResources;
    const total = list.length;
    const healthy = list.filter((r) => r.status === 'HEALTHY').length;
    const warning = list.filter((r) => r.status === 'WARNING').length;
    const critical = list.filter((r) => r.status === 'CRITICAL' || r.status === 'OFFLINE').length;
    const runningCount = list.filter((r) => r.lifecycleState === 'RUNNING').length;
    const uptimeSla = total > 0 ? Number(((runningCount / total) * 100).toFixed(1)) : 0;

    return {
      total,
      healthy,
      warning,
      critical,
      uptimeSla,
    };
  }, [filteredResources]);

  const togglePin = async (resourceId: string) => {
    if (!masterUser?.id) return;
    try {
      const updated = pinnedResourceIds.includes(resourceId)
        ? pinnedResourceIds.filter((id) => id !== resourceId)
        : [resourceId, ...pinnedResourceIds];
      setPinnedResourceIds(updated);
      await AsyncStorage.setItem(getPinnedStorageKey(masterUser.id), JSON.stringify(updated));
    } catch (err) {
      console.warn('[CloudContext] Erro ao salvar pin:', err);
    }
  };

  const isResourcePinned = (resourceId: string): boolean => {
    return pinnedResourceIds.includes(resourceId);
  };

  const refreshMetrics = async (forceRefresh = true): Promise<void> => {
    await fetchRealResources(forceRefresh);
  };

  const simulateLoadSpike = async (resourceId: string): Promise<void> => {
    telemetryRepository.triggerLoadSpike(resourceId);
    await fetchRealResources(false);
  };

  const mitigateAnomaly = async (
    resourceId: string
  ): Promise<{ ok: boolean; message: string }> => {
    const res = await telemetryRepository.mitigateRootCause(resourceId);
    await fetchRealResources(false);
    return { ok: res.ok, message: res.message };
  };

  const provisionInstance = async (
    targetProvider?: CloudProvider
  ): Promise<CloudResource | null> => {
    const prov = targetProvider || activeProvider;
    const created = await telemetryRepository.createInstance({
      name: `${prov} - Node-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      provider: prov,
      serviceType: prov === 'OCI' ? 'OCI_COMPUTE' : prov === 'AWS' ? 'EC2' : 'GCP_RUN',
      region:
        prov === 'OCI'
          ? 'sa-saopaulo-1'
          : prov === 'AWS'
          ? 'us-east-1'
          : 'southamerica-east1',
    });
    await fetchRealResources(false);
    return created.instance || null;
  };

  const deleteInstance = async (resourceId: string): Promise<void> => {
    await telemetryRepository.deleteInstance(resourceId);
    await fetchRealResources(false);
  };

  return (
    <CloudContext.Provider
      value={{
        resources,
        filteredResources,
        pinnedResources,
        pinnedResourceIds,
        selectedProvider,
        activeProvider,
        connectedProviders,
        activeAccount,
        isSimulationMode: false,
        timeRange,
        selectedResource,
        activeIncidents,
        kpis,
        isLoading,
        lastUpdated,
        telemetrySource,
        isLiveCloud: telemetrySource === 'LIVE_OCI' || telemetrySource === 'SIMULATION',
        isOfflineCache,
        cachedAtHHmm,
        syncError,
        policyHint,
        setProviderFilter: (p) => {
          setSelectedProvider(p);
          if (p !== 'ALL') switchActiveProvider(p);
        },
        setActiveProvider: (p) => {
          switchActiveProvider(p);
        },
        isProviderConnected,
        setTimeRange,
        setSelectedResource,
        refreshMetrics,
        togglePin,
        isResourcePinned,
        simulateLoadSpike,
        mitigateAnomaly,
        provisionInstance,
        deleteInstance,
      }}
    >
      {children}
    </CloudContext.Provider>
  );
};

export const useCloud = (): CloudContextData => {
  const context = useContext(CloudContext);
  if (!context) {
    throw new Error('useCloud deve ser utilizado dentro de um CloudProviderComponent');
  }
  return context;
};
