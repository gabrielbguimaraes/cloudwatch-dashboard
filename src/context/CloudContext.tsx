/**
 * CloudWatch Dashboard - Contexto Global de Nuvem (CloudContext)
 * Gerencia recursos monitorados, provedor ativo (OCI por padrão), simulação e alertas.
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
} from '../services/simulationService';

interface CloudContextData {
  resources: CloudResource[];
  filteredResources: CloudResource[];
  selectedProvider: CloudProvider | 'ALL';
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
  setTimeRange: (range: '1h' | '6h' | '24h' | '7d' | '30d') => void;
  setSimulationMode: (enabled: boolean) => void;
  setSelectedResource: (resource: CloudResource | null) => void;
  refreshMetrics: () => void;
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
  const [selectedProvider, setSelectedProvider] = useState<CloudProvider | 'ALL'>('ALL');
  const [activeAccount, setActiveAccount] = useState<CloudAccount>(defaultAccount);
  const [isSimulationMode, setSimulationMode] = useState<boolean>(true);
  const [timeRange, setTimeRange] = useState<'1h' | '6h' | '24h' | '7d' | '30d'>('24h');
  const [selectedResource, setSelectedResource] = useState<CloudResource | null>(null);
  const [activeIncidents, setActiveIncidents] = useState<AlertIncident[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Carrega os dados iniciais
  const loadInitialData = () => {
    setIsLoading(true);
    const initialResources = generateSimulatedResources();
    const initialIncidents = generateSimulatedIncidents();
    setResources(initialResources);
    setActiveIncidents(initialIncidents);
    setSelectedResource(initialResources[0] || null);
    setLastUpdated(new Date().toLocaleTimeString());
    setIsLoading(false);
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Atualização das métricas (Faker ou OCI real)
  const refreshMetrics = () => {
    setIsLoading(true);
    setTimeout(() => {
      const refreshed = generateSimulatedResources();
      setResources(refreshed);
      setLastUpdated(new Date().toLocaleTimeString());
      setIsLoading(false);
    }, 400);
  };

  // Recursos filtrados por provedor selecionado
  const filteredResources = useMemo(() => {
    if (selectedProvider === 'ALL') return resources;
    return resources.filter((res) => res.provider === selectedProvider);
  }, [resources, selectedProvider]);

  // Cálculo dinâmico de KPIs
  const kpis = useMemo(() => {
    const total = resources.length;
    let healthy = 0;
    let warning = 0;
    let critical = 0;

    resources.forEach((r) => {
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
  }, [resources]);

  return (
    <CloudContext.Provider
      value={{
        resources,
        filteredResources,
        selectedProvider,
        activeAccount,
        isSimulationMode,
        timeRange,
        selectedResource,
        activeIncidents,
        kpis,
        isLoading,
        lastUpdated,
        setProviderFilter: setSelectedProvider,
        setTimeRange,
        setSimulationMode,
        setSelectedResource,
        refreshMetrics,
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
