/**
 * CloudWatch Dashboard - Contexto Global de Nuvem (CloudContext)
 * Gerencia recursos monitorados, criação dinâmica via Faker, governança (fixar no topo) e KPIs.
 * Aluno: João Gabriel Barros Guimarães - FATEC 4DSM
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

const STORAGE_KEY_PINNED = '@cloudwatch:pinned_resources';
const STORAGE_KEY_RESOURCES = '@cloudwatch_resources';

export interface CustomProvisionOptions {
  name: string;
  shape: 'VM.Standard.E4.Flex' | 'VM.Standard.A1.Flex';
  ocpuCount: number; // 1, 2 ou 4 OCPUs
  memoryInGBs: number; // 4, 8 ou 16 GB RAM
  provider: CloudProvider;
}

interface CloudContextData {
  resources: CloudResource[];
  filteredResources: CloudResource[];
  pinnedResources: CloudResource[];
  pinnedResourceIds: string[];
  selectedProvider: CloudProvider | 'ALL';
  activeProvider: CloudProvider | 'ALL';
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
  setActiveProvider: (provider: CloudProvider | 'ALL') => void;
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
  const [resources, setResources] = useState<CloudResource[]>([]);
  const [pinnedResourceIds, setPinnedResourceIds] = useState<string[]>([]);
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | 'ALL'>('OCI');
  const [connectedProviders, setConnectedProviders] = useState<CloudProvider[]>(['OCI']);
  const [activeAccount, setActiveAccount] = useState<CloudAccount>(defaultAccount);
  const [isSimulationMode, setSimulationMode] = useState<boolean>(true);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('24h');
  const [selectedResource, setSelectedResource] = useState<CloudResource | null>(null);
  const [activeIncidents, setActiveIncidents] = useState<AlertIncident[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Carrega recursos iniciais (com persistência) e lista persistente de itens fixados
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const savedResourcesRaw = await AsyncStorage.getItem(STORAGE_KEY_RESOURCES);
      let activeList: CloudResource[] = [];
      if (savedResourcesRaw) {
        try {
          const parsed = JSON.parse(savedResourcesRaw);
          if (Array.isArray(parsed) && parsed.length > 0) {
            activeList = parsed;
          }
        } catch (err) {
          console.warn('Erro ao ler recursos salvos:', err);
        }
      }

      if (activeList.length === 0) {
        activeList = generateSimulatedResources();
        await AsyncStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(activeList));
      }

      setResources(activeList);
      setSelectedResource(activeList[0] || null);

      const initialIncidents = generateSimulatedIncidents();
      setActiveIncidents(initialIncidents);
      setLastUpdated(new Date().toLocaleTimeString());

      const savedPinned = await AsyncStorage.getItem(STORAGE_KEY_PINNED);
      if (savedPinned) {
        setPinnedResourceIds(JSON.parse(savedPinned));
      } else {
        // Fixa por padrão o recurso principal de produção (OCI Compute)
        const defaultPinned = ['res-oci-01'];
        setPinnedResourceIds(defaultPinned);
        await AsyncStorage.setItem(STORAGE_KEY_PINNED, JSON.stringify(defaultPinned));
      }
    } catch (e) {
      console.warn('Erro ao carregar dados iniciais no CloudContext:', e);
      const fallback = generateSimulatedResources();
      setResources(fallback);
      setSelectedResource(fallback[0] || null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Alterna o estado de fixação do recurso (Pin to Dashboard)
  const togglePin = async (resourceId: string) => {
    setPinnedResourceIds((prev) => {
      const exists = prev.includes(resourceId);
      const updated = exists ? prev.filter((id) => id !== resourceId) : [resourceId, ...prev];
      AsyncStorage.setItem(STORAGE_KEY_PINNED, JSON.stringify(updated)).catch((err) =>
        console.warn('Erro ao salvar pin:', err)
      );
      return updated;
    });
  };

  const isResourcePinned = (resourceId: string): boolean => {
    return pinnedResourceIds.includes(resourceId);
  };

  // Cria nova instância (personalizada pelo usuário ou aleatória nos bastidores) e insere no topo
  const provisionInstance = (options?: CustomProvisionOptions | CloudProvider): CloudResource => {
    let newInstance: CloudResource;
    if (options && typeof options === 'object') {
      const { name, shape, ocpuCount, memoryInGBs, provider } = options;
      const uid = Math.random().toString(36).substring(2, 10);
      const isOci = provider === 'OCI';
      const isAws = provider === 'AWS';
      const service = isOci ? 'OCI_COMPUTE' : isAws ? 'EC2' : 'GCP_RUN';
      const region = activeAccount.defaultRegion || 'sa-saopaulo-1';
      const serverName = name.trim() || `${provider} - ${shape} (Worker-${uid.substring(0, 4)})`;

      newInstance = {
        id: `res-${provider.toLowerCase()}-${uid}`,
        ocid: isOci ? `ocid1.instance.oc1.${region}.ab2x.${uid}a1b2c3d4e5f6` : undefined,
        arn: isAws ? `arn:aws:ec2:us-east-1:146139241100:instance/i-${uid}` : undefined,
        name: serverName,
        service,
        provider,
        region,
        compartmentId: isOci ? 'ocid1.compartment.oc1..production-workloads' : undefined,
        status: 'HEALTHY',
        lifecycleState: 'RUNNING',
        availabilitySla: 99.98,
        tags: {
          Environment: 'Production',
          Shape: shape,
          ManagedBy: 'CloudWatch-Mobile',
        },
        metricsSummary: {
          cpuPercent: Math.round(15 + Math.random() * 20),
          memoryPercent: Math.round((memoryInGBs / 16) * 45 + Math.random() * 5),
          latencyMs: parseFloat((3.2 + Math.random() * 2).toFixed(1)),
          diskPercent: 24,
          networkThroughputMbps: 350,
        },
        monthlyCostEstimate: parseFloat((18.0 + ocpuCount * 11.5 + memoryInGBs * 2.1).toFixed(2)),
        lastHealthCheck: new Date().toISOString(),
        metadata: {
          shape,
          ocpuCount,
          memoryInGBs,
          availabilityDomain: `${region}-AD-1`,
          faultDomain: 'FAULT-DOMAIN-1',
          publicIp: `129.148.${Math.floor(Math.random() * 200 + 1)}.${Math.floor(Math.random() * 250 + 1)}`,
          privateIp: `10.0.${Math.floor(Math.random() * 10 + 1)}.${Math.floor(Math.random() * 250 + 1)}`,
        },
      };
    } else {
      newInstance = provisionNewInstance(options);
    }

    setResources((prev) => {
      const updated = [newInstance, ...prev];
      AsyncStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(updated)).catch((err) =>
        console.warn('Erro ao salvar nova instância provisionada:', err)
      );
      return updated;
    });
    setLastUpdated(new Date().toLocaleTimeString());
    return newInstance;
  };

  // Atualização de métricas preservando instâncias existentes e persistindo no storage
  const refreshMetrics = () => {
    setIsLoading(true);
    setResources((prev) => {
      const updated = prev.map((item) => {
        if (item.status === 'REBOOTING') return item;
        // Oscilação suave de CPU (+/- 7%)
        const currentCpu = item.cpuUsage ?? item.metricsSummary?.cpuPercent ?? 25;
        const delta = Math.floor(Math.random() * 15) - 7;
        const newCpu = Math.min(99, Math.max(8, currentCpu + delta));
        let newStatus = item.status;
        if (newCpu > 85) newStatus = 'CRITICAL';
        else if (newCpu > 65) newStatus = 'WARNING';
        else newStatus = 'HEALTHY';

        return {
          ...item,
          status: newStatus,
          cpuUsage: newCpu,
          metricsSummary: {
            ...item.metricsSummary,
            cpuPercent: newCpu,
          },
          lastUpdated: new Date().toLocaleTimeString(),
        };
      });
      AsyncStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(updated)).catch((err) =>
        console.warn('Erro ao sincronizar recursos no storage após refresh:', err)
      );
      return updated;
    });
    setLastUpdated(new Date().toLocaleTimeString());
    setIsLoading(false);
  };

  // Reinicia a instância (status REBOOTING por 2s e depois HEALTHY com cpu 14%)
  const restartInstance = (id: string) => {
    setResources((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          return {
            ...item,
            status: 'REBOOTING' as const,
            lifecycleState: 'STARTING' as const,
          };
        }
        return item;
      });
      AsyncStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(updated)).catch(console.warn);
      return updated;
    });

    setTimeout(() => {
      setResources((prev) => {
        const updated = prev.map((item) => {
          if (item.id === id) {
            return {
              ...item,
              status: 'HEALTHY' as const,
              lifecycleState: 'RUNNING' as const,
              cpuUsage: 14,
              metricsSummary: {
                ...item.metricsSummary,
                cpuPercent: 14,
              },
              lastHealthCheck: new Date().toISOString(),
              lastUpdated: new Date().toLocaleTimeString(),
            };
          }
          return item;
        });
        AsyncStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(updated)).catch(console.warn);
        return updated;
      });
    }, 2000);
  };

  // Exclui a instância permanentemente do array e storage
  const deleteInstance = (id: string) => {
    setResources((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      AsyncStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(updated)).catch(console.warn);
      return updated;
    });

    setPinnedResourceIds((prev) => {
      if (!prev.includes(id)) return prev;
      const updatedPins = prev.filter((pid) => pid !== id);
      AsyncStorage.setItem(STORAGE_KEY_PINNED, JSON.stringify(updatedPins)).catch(console.warn);
      return updatedPins;
    });

    setSelectedResource((prev) => (prev?.id === id ? null : prev));
  };

  // Edita o nome e opcionalmente o shape da instância
  const editInstance = (id: string, newName: string, newShape?: string) => {
    setResources((prev) => {
      const updated = prev.map((item) => {
        if (item.id === id) {
          const updatedName = newName.trim() || item.name;
          const updatedMetadata = {
            ...item.metadata,
            ...(newShape ? { shape: newShape } : {}),
          };
          const updatedTags = {
            ...item.tags,
            ...(newShape ? { Shape: newShape } : {}),
          };
          return {
            ...item,
            name: updatedName,
            metadata: updatedMetadata,
            tags: updatedTags,
          };
        }
        return item;
      });
      AsyncStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(updated)).catch(console.warn);
      return updated;
    });

    setSelectedResource((prev) => {
      if (prev?.id === id) {
        return {
          ...prev,
          name: newName.trim() || prev.name,
          metadata: {
            ...prev.metadata,
            ...(newShape ? { shape: newShape } : {}),
          },
          tags: {
            ...prev.tags,
            ...(newShape ? { Shape: newShape } : {}),
          },
        };
      }
      return prev;
    });
  };

  // Sincroniza o recurso selecionado caso ele seja atualizado na lista de recursos
  useEffect(() => {
    if (selectedResource) {
      const match = resources.find((r) => r.id === selectedResource.id);
      if (
        match &&
        (match.status !== selectedResource.status ||
          match.name !== selectedResource.name ||
          (match.cpuUsage ?? match.metricsSummary?.cpuPercent) !==
            (selectedResource.cpuUsage ?? selectedResource.metricsSummary?.cpuPercent))
      ) {
        setSelectedResource(match);
      }
    }
  }, [resources]);

  // Injetor de Incidentes (Chaos Monkey)
  // 1. Injetar Sobrecarga de CPU (98%) na primeira instância saudável + vibração háptica dupla
  const injectChaosCpuOverload = () => {
    let affectedName = '';
    setResources((prev) => {
      let found = false;
      const updated = prev.map((item) => {
        if (!found && item.status !== 'CRITICAL' && item.status !== 'REBOOTING') {
          found = true;
          affectedName = item.name;
          return {
            ...item,
            status: 'CRITICAL' as const,
            cpuUsage: 98,
            metricsSummary: {
              ...item.metricsSummary,
              cpuPercent: 98,
            },
            lastUpdated: new Date().toLocaleTimeString(),
          };
        }
        return item;
      });

      if (!found && prev.length > 0) {
        affectedName = prev[0].name;
        updated[0] = {
          ...prev[0],
          status: 'CRITICAL' as const,
          cpuUsage: 98,
          metricsSummary: {
            ...prev[0].metricsSummary,
            cpuPercent: 98,
          },
          lastUpdated: new Date().toLocaleTimeString(),
        };
      }

      AsyncStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(updated)).catch(console.warn);
      return updated;
    });

    try {
      Vibration.vibrate([0, 50, 100, 50]);
    } catch (e) {
      console.warn('Vibration error:', e);
    }

    setLastUpdated(new Date().toLocaleTimeString());
    return { success: true, instanceName: affectedName };
  };

  // 2. Derrubar Instância Principal (CPU 0%, STOPPED, incremento de incidentes e auditoria)
  const crashPrimaryInstance = () => {
    let affectedName = '';
    setResources((prev) => {
      if (prev.length === 0) return prev;
      const target = prev[0];
      affectedName = target.name;
      const updated = prev.map((item, idx) => {
        if (idx === 0) {
          return {
            ...item,
            status: 'CRITICAL' as const,
            lifecycleState: 'STOPPED' as const,
            cpuUsage: 0,
            metricsSummary: {
              ...item.metricsSummary,
              cpuPercent: 0,
            },
            lastUpdated: new Date().toLocaleTimeString(),
          };
        }
        return item;
      });
      AsyncStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(updated)).catch(console.warn);
      return updated;
    });

    const newIncident: AlertIncident = {
      id: `inc-crash-${Date.now()}`,
      ruleId: 'rule-host-crash',
      resourceId: resources[0]?.id || 'res-primary',
      resourceName: resources[0]?.name || 'Instância Primária',
      provider: resources[0]?.provider || 'OCI',
      severity: 'CRITICAL',
      triggeredAt: new Date().toLocaleTimeString(),
      valueRecorded: 0,
      threshold: 0,
      status: 'ACTIVE',
      message: 'Derrubada Forçada (Host Offline / STOPPED). CPU 0%. Failover ativo.',
    };
    setActiveIncidents((prev) => [newIncident, ...prev]);
    setLastUpdated(new Date().toLocaleTimeString());
    return { success: true, instanceName: affectedName };
  };

  // 3. Restaurar Infraestrutura: Normaliza todos os nós para HEALTHY e zera as anomalias
  const restoreInfrastructure = () => {
    let count = 0;
    setResources((prev) => {
      count = prev.length;
      const updated = prev.map((item) => {
        const normalCpu = Math.floor(14 + Math.random() * 18);
        return {
          ...item,
          status: 'HEALTHY' as const,
          lifecycleState: 'RUNNING' as const,
          cpuUsage: normalCpu,
          metricsSummary: {
            ...item.metricsSummary,
            cpuPercent: normalCpu,
          },
          lastHealthCheck: new Date().toISOString(),
          lastUpdated: new Date().toLocaleTimeString(),
        };
      });
      AsyncStorage.setItem(STORAGE_KEY_RESOURCES, JSON.stringify(updated)).catch(console.warn);
      return updated;
    });
    setActiveIncidents([]);
    setLastUpdated(new Date().toLocaleTimeString());
    return { success: true, restoredCount: count };
  };

  const addConnectedProvider = (provider: CloudProvider) => {
    setConnectedProviders((prev) => (prev.includes(provider) ? prev : [...prev, provider]));
    setSelectedProvider(provider);
  };

  const isProviderConnected = (provider: CloudProvider): boolean => {
    return connectedProviders.includes(provider);
  };

  // Recursos filtrados pelo provedor ativo (ou Todos apenas das nuvens conectadas)
  const filteredResources = useMemo(() => {
    if (selectedProvider === 'ALL') {
      return resources.filter((res) => connectedProviders.includes(res.provider));
    }
    return resources.filter((res) => res.provider === selectedProvider);
  }, [resources, selectedProvider, connectedProviders]);

  // Lista de recursos fixados pelo usuário para exibição no topo
  const pinnedResources = useMemo(() => {
    return resources.filter((res) => pinnedResourceIds.includes(res.id));
  }, [resources, pinnedResourceIds]);

  // Cálculo reativo e dinâmico de KPIs de topo com base nos recursos das contas conectadas
  const kpis = useMemo(() => {
    const relevant =
      selectedProvider === 'ALL'
        ? resources.filter((res) => connectedProviders.includes(res.provider))
        : resources.filter((res) => res.provider === selectedProvider);

    const total = relevant.length;
    let healthy = 0;
    let warning = 0;
    let critical = 0;

    relevant.forEach((r) => {
      if (r.status === 'HEALTHY' || r.status === 'REBOOTING') healthy++;
      else if (r.status === 'WARNING') warning++;
      else if (r.status === 'CRITICAL' || r.lifecycleState === 'STOPPED') critical++;
    });

    // Se houver incidentes ou nós críticos, decrementa o SLA
    const penalty = critical * 1.5 + (activeIncidents.length > 0 ? 0.8 : 0);
    const uptimeSla = Math.max(91.2, parseFloat((99.98 - penalty).toFixed(2)));

    return {
      total,
      healthy,
      warning,
      critical,
      uptimeSla,
    };
  }, [resources, selectedProvider, connectedProviders, activeIncidents]);

  return (
    <CloudContext.Provider
      value={{
        resources,
        filteredResources,
        pinnedResources,
        pinnedResourceIds,
        selectedProvider,
        activeProvider: selectedProvider,
        connectedProviders,
        activeAccount,
        isSimulationMode,
        timeRange,
        selectedResource,
        activeIncidents,
        kpis,
        isLoading,
        lastUpdated,
        setProviderFilter: setSelectedProvider,
        setActiveProvider: setSelectedProvider,
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
