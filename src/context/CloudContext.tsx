/**
 * CloudWatch Dashboard - Contexto Global de Nuvem (CloudContext)
 * Gerencia recursos monitorados, criação dinâmica via Faker, governança (fixar no topo) e KPIs.
 * Aluno: João Gabriel Barros Guimarães - FATEC 4DSM
 */

import React, { createContext, useContext, useState, useEffect, useMemo, ReactNode } from 'react';
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
  addConnectedProvider: (provider: CloudProvider) => void;
  isProviderConnected: (provider: CloudProvider) => boolean;
  setTimeRange: (range: '1h' | '6h' | '24h' | '7d' | '30d') => void;
  setSimulationMode: (enabled: boolean) => void;
  setSelectedResource: (resource: CloudResource | null) => void;
  refreshMetrics: () => void;
  provisionInstance: (options?: CustomProvisionOptions | CloudProvider) => CloudResource;
  togglePin: (resourceId: string) => void;
  isResourcePinned: (resourceId: string) => boolean;
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

  // Carrega recursos iniciais e lista persistente de itens fixados
  const loadInitialData = async () => {
    setIsLoading(true);
    const initialResources = generateSimulatedResources();
    const initialIncidents = generateSimulatedIncidents();
    setResources(initialResources);
    setActiveIncidents(initialIncidents);
    setSelectedResource(initialResources[0] || null);
    setLastUpdated(new Date().toLocaleTimeString());

    try {
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
      console.warn('Erro ao carregar recursos fixados:', e);
    }

    setIsLoading(false);
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

    setResources((prev) => [newInstance, ...prev]);
    setLastUpdated(new Date().toLocaleTimeString());
    return newInstance;
  };

  // Atualização de métricas de todos os recursos
  const refreshMetrics = () => {
    setIsLoading(true);
    const refreshed = generateSimulatedResources();
    setResources(refreshed);
    setLastUpdated(new Date().toLocaleTimeString());
    setIsLoading(false);
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
      if (r.status === 'HEALTHY') healthy++;
      else if (r.status === 'WARNING') warning++;
      else if (r.status === 'CRITICAL') critical++;
    });

    return {
      total,
      healthy,
      warning,
      critical,
      uptimeSla: 99.94,
    };
  }, [resources, selectedProvider, connectedProviders]);

  return (
    <CloudContext.Provider
      value={{
        resources,
        filteredResources,
        pinnedResources,
        pinnedResourceIds,
        selectedProvider,
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
        addConnectedProvider,
        isProviderConnected,
        setTimeRange,
        setSimulationMode,
        setSelectedResource,
        refreshMetrics,
        provisionInstance,
        togglePin,
        isResourcePinned,
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
