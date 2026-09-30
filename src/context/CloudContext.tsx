/**
 * CloudWatch Dashboard - Contexto Global de Nuvem (CloudContext)
 * Gerencia recursos monitorados, governanca (fixar no topo), CRUD corporativo e KPIs.
 * Aluno: Joao Gabriel Barros Guimaraes - FATEC 4DSM
 */

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
import { Vibration } from 'react-native';
import type {
  CloudResource,
  CloudProvider,
  CloudAccount,
  AlertIncident,
} from '../types';
import {
  generateSimulatedResources,
  generateSimulatedIncidents,
  provisionNewInstance,
} from '../services/simulationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';

const STORAGE_KEY_PINNED = '@cloudwatch:pinned_resources';
const STORAGE_KEY_RESOURCES = '@cloudwatch_resources';

export interface CustomProvisionOptions {
  name: string;
  shape: string;
  ocpuCount: number;
  memoryInGBs: number;
  provider: CloudProvider;
}

interface CloudContextData {
  resources: CloudResource[];
  filteredResources: CloudResource[];
  pinnedResources: CloudResource[];
  pinnedResourceIds: string[];
  selectedProvider: CloudProvider | 'ALL';
  activeProvider: CloudProvider;
  connectedProviders: CloudProvider[];
  activeAccount: CloudAccount;
  isSimulationMode: boolean;
  timeRange: '1h' | '6h' | '24h' | '7d' | '30d';
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
  setProviderFilter: (provider: CloudProvider | 'ALL') => void;
  setActiveProvider: (provider: CloudProvider) => void;
  addConnectedProvider: (provider: CloudProvider) => void;
  isProviderConnected: (provider: CloudProvider) => boolean;
  setTimeRange: (range: '1h' | '6h' | '24h' | '7d' | '30d') => void;
  setSimulationMode: (enabled: boolean) => void;
  setSelectedResource: (resource: CloudResource | null) => void;
  refreshMetrics: () => void;
  provisionInstance: (options?: CustomProvisionOptions | CloudProvider) => CloudResource;
  togglePin: (resourceId: string) => void;
  isResourcePinned: (resourceId: string) => boolean;
  restartInstance: (id: string) => void;
  deleteInstance: (id: string) => void;
  editInstance: (id: string, newName: string, newShape?: string) => void;
  injectChaosCpuOverload: () => { success: boolean; instanceName?: string };
  crashPrimaryInstance: () => { success: boolean; instanceName?: string };
  restoreInfrastructure: () => { success: boolean; restoredCount: number };
}

const defaultAccount: CloudAccount = {
  id: 'acc-oci-main',
  name: 'Oracle Cloud Production (Tenancy Principal)',
  provider: 'OCI',
  defaultRegion: 'sa-saopaulo-1',
  isSimulationMode: true,
  ociConfig: {
    tenancyOcid: 'ocid1.tenancy.oc1..aaaaaaaab1234567890',
    userOcid: 'ocid1.user.oc1..aaaaaaaax74n9b2k3l4m',
    fingerprint: '20:3b:97:13:55:01:bc:ef:90:12:44:88:aa:bb:cc:dd',
    region: 'sa-saopaulo-1',
    compartmentOcid: 'ocid1.compartment.oc1..production-workloads',
  },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const CloudContext = createContext<CloudContextData>({} as CloudContextData);

export const CloudProviderComponent: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { activeProvider: authActiveProvider, switchActiveProvider } = useAuth();
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [pinnedResourceIds, setPinnedResourceIds] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | 'ALL'>('OCI');
  const [connectedProviders, setConnectedProviders] = useState<CloudProvider[]>(['OCI', 'AWS', 'GCP']);
  const [activeAccount, setActiveAccount] = useState<CloudAccount>(defaultAccount);
  const [isSimulationMode, setSimulationMode] = useState<boolean>(true);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('24h');
  const [selectedResource, setSelectedResource] = useState<CloudResource | null>(null);
  const [activeIncidents, setActiveIncidents] = useState<AlertIncident[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastUpdated, setLastUpdated] = useState<string>(new Date().toLocaleTimeString());

  const activeProvider = authActiveProvider || 'OCI';

  // Sincroniza recursos salvos no AsyncStorage ou carrega padrao
  useEffect(() => {
    const initializeData = async () => {
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY_RESOURCES);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setResources(parsed);
            setSelectedResource(parsed[0]);
          } else {
            const initial = generateSimulatedResources();
            setResources(initial);
            setSelectedResource(initial[0]);
            await AsyncStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(initial));
          }
        } else {
          const initial = generateSimulatedResources();
          setResources(initial);
          setSelectedResource(initial[0]);
          await AsyncStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(initial));
        }

        const storedPinned = await AsyncStorage.getItem(STORAGE_KEY_PINNED);
        if (storedPinned) {
          setPinnedResourceIds(JSON.parse(storedPinned));
        }

        setActiveIncidents(generateSimulatedIncidents());
      } catch (err) {
        console.warn('Erro ao inicializar recursos no CloudContext:', err);
        const fallback = generateSimulatedResources();
        setResources(fallback);
        setSelectedResource(fallback[0]);
      } finally {
        setIsLoading(false);
      }
    };

    initializeData();
  }, []);

  // Persiste recursos no AsyncStorage
  const saveResourcesToDisk = async (newResources: CloudResource[]) => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(newResources));
    } catch (err) {
      console.warn('Erro ao salvar recursos no AsyncStorage:', err);
    }
  };

  const isProviderConnected = (provider: CloudProvider): boolean => {
    return connectedProviders.includes(provider);
  };

  const addConnectedProvider = (provider: CloudProvider) => {
    if (!connectedProviders.includes(provider)) {
      setConnectedProviders((prev) => [...prev, provider]);
    }
  };

  // Filtra recursos pertencentes a nuvem ativa
  const filteredResources = useMemo(() => {
    return resources.filter((r) => r.provider === activeProvider);
  }, [resources, activeProvider]);

  // Recursos Fixados no Topo da Nuvem Ativa
  const pinnedResources = useMemo(() => {
    return filteredResources.filter((r) => pinnedResourceIds.includes(r.id));
  }, [filteredResources, pinnedResourceIds]);

  // Calculo dinamico dos KPIs para a nuvem ativa
  const kpis = useMemo(() => {
    const list = filteredResources;
    const total = list.length;
    const healthy = list.filter((r) => r.status === 'HEALTHY').length;
    const warning = list.filter((r) => r.status === 'WARNING').length;
    const critical = list.filter((r) => r.status === 'CRITICAL' || r.status === 'OFFLINE').length;

    let uptimeSla = 99.98;
    if (total > 0) {
      const healthyRatio = healthy / total;
      uptimeSla = Number((98.5 + healthyRatio * 1.49).toFixed(2));
      if (critical > 0) {
        uptimeSla = Number((uptimeSla - critical * 0.45).toFixed(2));
      }
    }

    return {
      total,
      healthy,
      warning,
      critical,
      uptimeSla: Math.max(90, Math.min(100, uptimeSla)),
    };
  }, [filteredResources]);

  // Alternancia do status de fixacao
  const togglePin = async (resourceId: string) => {
    try {
      let updated: string[];
      if (pinnedResourceIds.includes(resourceId)) {
        updated = pinnedResourceIds.filter((id) => id !== resourceId);
      } else {
        updated = [resourceId, ...pinnedResourceIds];
      }
      setPinnedResourceIds(updated);
      await AsyncStorage.setItem(STORAGE_KEY_PINNED, JSON.stringify(updated));
    } catch (err) {
      console.warn('Erro ao salvar pin:', err);
    }
  };

  const isResourcePinned = (resourceId: string): boolean => {
    return pinnedResourceIds.includes(resourceId);
  };

  /**
   * Recalcula oscilacoes de telemetria sem excluir nenhuma instancia da lista
   */
  const refreshMetrics = () => {
    setResources((prev) => {
      const updated = prev.map((item) => {
        if (item.status === 'REBOOTING' || item.lifecycleState === 'STOPPED') {
          return item;
        }

        const deltaCpu = (Math.random() * 8 - 4);
        const currentCpu = item.metricsSummary.cpuPercent || 40;
        const newCpu = Math.min(98, Math.max(8, Math.round((currentCpu + deltaCpu) * 10) / 10));

        let status = item.status;
        if (newCpu > 88) status = 'CRITICAL';
        else if (newCpu > 70) status = 'WARNING';
        else status = 'HEALTHY';

        return {
          ...item,
          status,
          metricsSummary: {
            ...item.metricsSummary,
            cpuPercent: newCpu,
            memoryPercent: Math.min(95, Math.max(20, Math.round((item.metricsSummary.memoryPercent || 45) + (Math.random() * 4 - 2)))),
            latencyMs: Math.round((item.metricsSummary.latencyMs || 5) * 10) / 10,
          },
        };
      });

      saveResourcesToDisk(updated);
      return updated;
    });

    setLastUpdated(new Date().toLocaleTimeString());
  };

  /**
   * Provisionamento de Nova Maquina
   */
  const provisionInstance = (options?: CustomProvisionOptions | CloudProvider): CloudResource => {
    let targetProvider: CloudProvider = activeProvider;
    let customOpts: Partial<CustomProvisionOptions> | undefined;

    if (typeof options === 'string') {
      targetProvider = options;
    } else if (options && typeof options === 'object') {
      targetProvider = options.provider || activeProvider;
      customOpts = options;
    }

    const newInst = provisionNewInstance(targetProvider);
    if (customOpts?.name) newInst.name = customOpts.name;
    if (customOpts?.shape && newInst.metadata) {
      (newInst.metadata as any).shape = customOpts.shape;
    }

    setResources((prev) => {
      const updated = [newInst, ...prev];
      saveResourcesToDisk(updated);
      return updated;
    });

    setLastUpdated(new Date().toLocaleTimeString());
    return newInst;
  };

  /**
   * Reiniciar Instancia
   */
  const restartInstance = (id: string) => {
    setResources((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            status: 'REBOOTING' as const,
            metricsSummary: {
              ...item.metricsSummary,
              cpuPercent: 5.0,
            },
          };
        }
        return item;
      });
      saveResourcesToDisk(updated);
      return updated;
    });

    setTimeout(() => {
      setResources((prev) => {
        const updated = prev.map((item) => {
          if (item.id === id) {
            return {
              ...item,
              status: 'HEALTHY' as const,
              metricsSummary: {
                ...item.metricsSummary,
                cpuPercent: 12.0,
                memoryPercent: 32.0,
                latencyMs: 3.8,
              },
            };
          }
          return item;
        });
        saveResourcesToDisk(updated);
        return updated;
      });
    }, 2000);
  };

  /**
   * Terminar / Excluir Instancia
   */
  const deleteInstance = (id: string) => {
    setResources((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      saveResourcesToDisk(updated);
      return updated;
    });

    if (pinnedResourceIds.includes(id)) {
      setPinnedResourceIds((prev) => {
        const updated = prev.filter((pId) => pId !== id);
        AsyncStorage.setItem(STORAGE_KEY_PINNED, JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    }

    if (selectedResource?.id === id) {
      const remaining = resources.filter((r) => r.id !== id);
      setSelectedResource(remaining.length > 0 ? remaining[0] : null);
    }
  };

  /**
   * Editar Especificacoes da Instancia
   */
  const editInstance = (id: string, newName: string, newShape?: string) => {
    setResources((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            name: newName,
            metadata: {
              ...(item.metadata || {}),
              shape: newShape || (item.metadata as any)?.shape || 'VM.Standard.A1.Flex',
            },
            tags: {
              ...(item.tags || {}),
              Shape: newShape || item.tags?.Shape || 'VM.Standard.A1.Flex',
            },
          };
        }
        return item;
      });
      saveResourcesToDisk(updated);
      return updated;
    });

    if (selectedResource?.id === id) {
      setSelectedResource((prev) =>
        prev
          ? {
              ...prev,
              name: newName,
              metadata: {
                ...(prev.metadata || {}),
                shape: newShape || (prev.metadata as any)?.shape || 'VM.Standard.A1.Flex',
              },
            }
          : null
      );
    }
  };

  /**
   * Chaos Monkey: Injetar Sobrecarga de CPU (98%)
   */
  const injectChaosCpuOverload = (): { success: boolean; instanceName?: string } => {
    let affectedName = '';
    setResources((prev) => {
      let injected = false;
      const updated = prev.map((item) => {
        if (!injected && (item.status === 'HEALTHY' || item.status === 'WARNING')) {
          injected = true;
          affectedName = item.name;
          return {
            ...item,
            status: 'CRITICAL' as const,
            metricsSummary: {
              ...item.metricsSummary,
              cpuPercent: 98.4,
              memoryPercent: 91.2,
              latencyMs: 145.8,
            },
            availabilitySla: 94.2,
          };
        }
        return item;
      });
      saveResourcesToDisk(updated);
      return updated;
    });

    Vibration.vibrate([0, 50, 100, 50]);

    const newIncident: AlertIncident = {
      id: `inc-${Date.now()}`,
      ruleId: 'rule-cpu-critical',
      resourceId: resources[0]?.id || 'res-01',
      resourceName: affectedName || resources[0]?.name || 'Nó Computacional',
      provider: activeProvider,
      severity: 'CRITICAL',
      triggeredAt: new Date().toLocaleTimeString(),
      valueRecorded: 98.4,
      threshold: 85.0,
      status: 'ACTIVE',
      message: 'Sobrecarga de CPU detectada (98.4%). Limiar de seguranca violado.',
    };

    setActiveIncidents((prev) => [newIncident, ...prev]);
    setLastUpdated(new Date().toLocaleTimeString());
    return { success: true, instanceName: affectedName };
  };

  /**
   * Chaos Monkey: Derrubar Instancia Principal (0% CPU / STOPPED)
   */
  const crashPrimaryInstance = (): { success: boolean; instanceName?: string } => {
    let affectedName = '';
    setResources((prev) => {
      if (prev.length === 0) return prev;
      affectedName = prev[0].name;
      const updated = prev.map((item, idx) => {
        if (idx === 0) {
          return {
            ...item,
            status: 'CRITICAL' as const,
            metricsSummary: {
              ...item.metricsSummary,
              cpuPercent: 0.0,
              latencyMs: 0.0,
            },
            availabilitySla: 88.0,
          };
        }
        return item;
      });
      saveResourcesToDisk(updated);
      return updated;
    });

    const newIncident: AlertIncident = {
      id: `inc-crash-${Date.now()}`,
      ruleId: 'rule-host-crash',
      resourceId: resources[0]?.id || 'res-primary',
      resourceName: resources[0]?.name || 'Instancia Primaria',
      provider: resources[0]?.provider || activeProvider,
      severity: 'CRITICAL',
      triggeredAt: new Date().toLocaleTimeString(),
      valueRecorded: 0,
      threshold: 0,
      status: 'ACTIVE',
      message: 'Host Offline (STOPPED). CPU 0%. Failover ativo.',
    };
    setActiveIncidents((prev) => [newIncident, ...prev]);
    setLastUpdated(new Date().toLocaleTimeString());
    return { success: true, instanceName: affectedName };
  };

  /**
   * Chaos Monkey: Restaurar Infraestrutura (Normaliza para HEALTHY)
   */
  const restoreInfrastructure = () => {
    let count = 0;
    setResources((prev) => {
      count = prev.length;
      const updated = prev.map((item) => ({
        ...item,
        status: 'HEALTHY' as const,
        metricsSummary: {
          ...item.metricsSummary,
          cpuPercent: Math.round((Math.random() * 25 + 15) * 10) / 10,
          memoryPercent: Math.round((Math.random() * 20 + 35) * 10) / 10,
          latencyMs: 4.2,
        },
        availabilitySla: 99.98,
      }));
      saveResourcesToDisk(updated);
      return updated;
    });

    setActiveIncidents([]);
    setLastUpdated(new Date().toLocaleTimeString());
    return { success: true, restoredCount: count };
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
        isSimulationMode,
        timeRange,
        selectedResource,
        activeIncidents,
        kpis,
        isLoading,
        lastUpdated,
        setProviderFilter: (p) => {
          setSelectedProvider(p);
          if (p !== 'ALL') switchActiveProvider(p);
        },
        setActiveProvider: (p) => switchActiveProvider(p),
        addConnectedProvider,
        isProviderConnected,
        setTimeRange,
        setSimulationMode,
        setSelectedResource,
        refreshMetrics,
        provisionInstance,
        togglePin,
        isResourcePinned,
        restartInstance,
        deleteInstance,
        editInstance,
        injectChaosCpuOverload,
        crashPrimaryInstance,
        restoreInfrastructure,
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
