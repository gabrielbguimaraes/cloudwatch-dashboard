

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  Alert,
  Modal,
  Platform,
  PermissionsAndroid,
  TextInput,
  ActivityIndicator,
  Vibration,
  LayoutAnimation,
  UIManager,
} from 'react-native';
import { Camera } from 'react-native-camera-kit';
import { colors, getProviderTheme } from '../theme';
import { useCloud } from '../context/CloudContext';
import { useAuth } from '../context/AuthContext';
import type { CloudResource, CloudProvider } from '../types';
import { detectNearestDatacenter } from '../services/locationService';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    filteredResources,
    pinnedResources,
    selectedProvider,
    activeProvider,
    connectedProviders,
    setProviderFilter,
    setActiveProvider,
    addConnectedProvider,
    isProviderConnected,
    kpis,
    timeRange,
    setTimeRange,
    setSelectedResource,
    refreshMetrics,
    provisionInstance,
    togglePin,
    isResourcePinned,
    isLoading,
    lastUpdated,
    restartInstance,
    deleteInstance,
    editInstance,
    injectChaosCpuOverload,
    crashPrimaryInstance,
    restoreInfrastructure,
  } = useCloud();

  const { logout, loginWithQrCodePayload } = useAuth();

  // Estados de Hardware: Localização GPS e Câmera de Provedor
  const [gpsBadge, setGpsBadge] = useState<string>('📍 Detectando GPS...');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [targetProviderToConnect, setTargetProviderToConnect] = useState<CloudProvider | null>(null);
  const [isProcessingQr, setIsProcessingQr] = useState<boolean>(false);

  // Estado do Modal Chaos Monkey (Injetor de Incidentes ao Vivo)
  const [isChaosModalVisible, setIsChaosModalVisible] = useState<boolean>(false);

  // Estados do Modal Interativo de Provisionamento Personalizado (Tarefa A)
  const [isProvisionModalVisible, setIsProvisionModalVisible] = useState<boolean>(false);
  const [serverName, setServerName] = useState<string>('');
  const [selectedShape, setSelectedShape] = useState<'VM.Standard.E4.Flex' | 'VM.Standard.A1.Flex'>('VM.Standard.E4.Flex');
  const [selectedOcpu, setSelectedOcpu] = useState<number>(2);
  const [selectedMemory, setSelectedMemory] = useState<number>(8);
  const [isProvisioning, setIsProvisioning] = useState<boolean>(false);

  // Estados de Edição Rápida da Instância
  const [editingResource, setEditingResource] = useState<CloudResource | null>(null);
  const [editName, setEditName] = useState<string>('');

  const handleRestartCard = (id: string) => {
    Vibration.vibrate(30);
    restartInstance(id);
  };

  const handleOpenEditCard = (resource: CloudResource) => {
    setEditingResource(resource);
    setEditName(resource.name);
  };

  const handleSaveEditCard = () => {
    if (!editingResource) return;
    if (!editName.trim()) {
      Alert.alert('Nome Inválido', 'O nome da máquina não pode ficar em branco.');
      return;
    }
    editInstance(editingResource.id, editName.trim());
    setEditingResource(null);
    Alert.alert('Instância Atualizada', 'O nome do servidor foi atualizado com sucesso.');
  };

  const handleDeleteCard = (id: string) => {
    Alert.alert(
      'Encerrar Servidor',
      'Tem certeza que deseja terminar esta instância?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
          style: 'destructive',
          onPress: () => deleteInstance(id),
        },
      ]
    );
  };

  // Handlers do Chaos Monkey (Injetor de Incidentes)
  const handleChaosCpuOverload = () => {
    const res = injectChaosCpuOverload();
    setIsChaosModalVisible(false);
    Alert.alert(
      '🔥 Incidente: Sobrecarga de CPU (98%)',
      `Carga de 98% injetada em ${res.instanceName || 'servidor'}.\nStatus alterado para CRITICAL, vibração háptica disparada e SLA recalculado.`
    );
  };

  const handleChaosCrashPrimary = () => {
    const res = crashPrimaryInstance();
    setIsChaosModalVisible(false);
    Alert.alert(
      '🛑 Incidente: Host Derrubado',
      `${res.instanceName || 'Instância Principal'} colocada em estado STOPPED (CPU 0%).\nNovo incidente registrado nos logs de auditoria.`
    );
  };

  const handleChaosRestore = () => {
    const res = restoreInfrastructure();
    setIsChaosModalVisible(false);
    Alert.alert(
      '🟢 Infraestrutura Restaurada',
      `${res.restoredCount} nós retornaram para HEALTHY com métricas normalizadas.\nAnomalias zeradas e SLA estabilizado em 99.98%.`
    );
  };

  // Estados de Pull-to-Refresh e Filtro de Busca Instantâneo (Tarefa B)
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');

  const handlePullToRefresh = () => {
    setIsRefreshing(true);
    refreshMetrics();
    setTimeout(() => {
      setIsRefreshing(false);
      Vibration.vibrate(30);
    }, 800);
  };

  const displayedResources = filteredResources.filter(r => 
    r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Provedor ativo da sessão para o provisionamento
  const activeSessionProvider: CloudProvider =
    selectedProvider === 'ALL' ? (connectedProviders[0] || 'OCI') : selectedProvider;

  // Contextualização Regional por GPS (expo-location) - Totalmente blindada contra crashes (Tarefa C)
  useEffect(() => {
    let isMounted = true;
    try {
      detectNearestDatacenter()
        .then((res) => {
          if (isMounted) {
            setGpsBadge(res?.badge || '📍 sa-saopaulo-1 (Local GPS)');
          }
        })
        .catch((err) => {
          console.warn('Erro seguro capturado ao obter localização por GPS:', err);
          if (isMounted) {
            setGpsBadge('📍 sa-saopaulo-1 (Local GPS)');
          }
        });
    } catch (err) {
      console.warn('Exceção síncrona na detecção de GPS tratada com fallback:', err);
      if (isMounted) {
        setGpsBadge('📍 sa-saopaulo-1 (Local GPS)');
      }
    }
    return () => {
      isMounted = false;
    };
  }, []);

  const handleResourcePress = (resource: CloudResource) => {
    setSelectedResource(resource);
    navigation.navigate('MetricsDetail', { resourceId: resource.id, selectedInstanceId: resource.id });
  };

  const handleLogout = () => {
    logout();
    navigation.replace('Login');
  };

  /**
   * Abre o Modal Interativo de Provisionamento Personalizado
   */
  const handleOpenProvisionModal = () => {
    setServerName('');
    setSelectedShape('VM.Standard.E4.Flex');
    setSelectedOcpu(2);
    setSelectedMemory(8);
    setIsProvisioning(false);
    setIsProvisionModalVisible(true);
  };

  /**
   * Executa o provisionamento personalizado com simulação de delay de 1s e recálculo de KPIs
   */
  const handleConfirmProvision = () => {
    setIsProvisioning(true);

    setTimeout(() => {
      const newResource = provisionInstance({
        name: serverName,
        shape: selectedShape,
        ocpuCount: selectedOcpu,
        memoryInGBs: selectedMemory,
        provider: activeSessionProvider,
      });

      setIsProvisioning(false);
      setIsProvisionModalVisible(false);

      Alert.alert(
        '⚡ Nova Instância Provisionada',
        `Recurso provisionado com sucesso:\n\n• Nome: ${newResource.name}\n• Provedor: ${newResource.provider}\n• Shape: ${selectedShape}\n• Configuração: ${selectedOcpu} OCPU(s) | ${selectedMemory} GB RAM\n• Status: OPERACIONAL`,
        [{ text: 'OK' }]
      );
    }, 1000);
  };

  /**
   * Lógica de Provedor Ativo vs. Outras Nuvens no Dashboard:
   * Dispara LayoutAnimation suave e solicita QR Code se nuvem não estiver conectada
   */
  const handleSelectProvider = (prov: CloudProvider | 'ALL') => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    if (prov === 'ALL') {
      setProviderFilter('ALL');
      return;
    }

    if (isProviderConnected(prov)) {
      setProviderFilter(prov);
    } else {
      const providerName = PROVIDER_DISPLAY_NAMES[prov] || prov;
      Alert.alert(
        `Conta ${providerName} Não Conectada`,
        `Deseja escanear o QR Code deste provedor para monitorá-lo em conjunto?`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Escanear QR Code',
            onPress: async () => {
              setTargetProviderToConnect(prov);
              if (Platform.OS === 'android') {
                try {
                  const granted = await PermissionsAndroid.request(
                    PermissionsAndroid.PERMISSIONS.CAMERA,
                    {
                      title: 'Permissão de Câmera',
                      message: 'O CloudWatch necessita de acesso à câmera para ler QR Codes de provedores.',
                      buttonPositive: 'Permitir',
                      buttonNegative: 'Cancelar',
                    }
                  );
                  if (granted === PermissionsAndroid.RESULTS.GRANTED) {
                    setIsCameraActive(true);
                  } else {
                    Alert.alert('Permissão Negada', 'Acesso à câmera é necessário para ler o QR Code.');
                  }
                } catch (e) {
                  console.warn('Erro ao solicitar permissão de câmera:', e);
                }
              } else {
                setIsCameraActive(true);
              }
            },
          },
        ]
      );
    }
  };

  /**
   * Leitura do QR Code de outro provedor em execução
   */
  const handleBarcodeRead = (event: any) => {
    if (isProcessingQr) return;
    const rawValue = event?.nativeEvent?.codeStringValue || '';
    if (!rawValue) return;

    setIsProcessingQr(true);
    const result = loginWithQrCodePayload(rawValue);

    if (result.success && result.data) {
      const provToConnect = targetProviderToConnect || result.data.provider || 'AWS';
      addConnectedProvider(provToConnect);
      setIsCameraActive(false);
      setIsProcessingQr(false);
      Alert.alert(
        '✅ Conta Conectada com Sucesso',
        `Credenciais de ${PROVIDER_DISPLAY_NAMES[provToConnect] || provToConnect} vinculadas ao painel.`
      );
    } else {
      setIsProcessingQr(false);
      Alert.alert(
        'QR Code Inválido',
        result.error || 'Certifique-se de escanear uma configuração válida em Plain Text.'
      );
    }
  };

  const handleSimulateConnection = () => {
    if (targetProviderToConnect) {
      addConnectedProvider(targetProviderToConnect);
      setIsCameraActive(false);
      Alert.alert(
        '✅ Conta Conectada com Sucesso',
        `As instâncias de ${PROVIDER_DISPLAY_NAMES[targetProviderToConnect] || targetProviderToConnect} agora estão ativas no painel.`
      );
    }
  };

  // Semáforo Sóbrio (Padrão Google Cloud Monitoring)
  const getSemaphoreStyle = (status: CloudResource['status']) => {
    if (status === 'CRITICAL' || status === 'OFFLINE') {
      return {
        text: '#F28B82',
        bg: '#2D1515',
        border: '#4D1F1F',
        label: 'CRITICAL',
      };
    }
    if (status === 'WARNING') {
      return {
        text: '#FDD663',
        bg: '#2E230B',
        border: '#4D3A12',
        label: 'WARNING',
      };
    }
    if (status === 'REBOOTING') {
      return {
        text: '#38BDF8',
        bg: '#0C1B33',
        border: '#38BDF8',
        label: 'REBOOTING',
      };
    }
    return {
      text: '#81C995',
      bg: '#132B1D',
      border: '#1E462E',
      label: 'HEALTHY',
    };
  };

  const STANDARD_BADGE_STYLE = {
    bg: '#181C22',
    border: '#282E38',
    text: '#94A3B8',
  };

  const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
    OCI: 'ORACLE OCI',
    AWS: 'AWS',
    GCP: 'GOOGLE CLOUD',
    ALL: 'MULTI-CLOUD',
  };

  const getProviderBadge = (provider: CloudProvider) => {
    const theme = getProviderTheme(provider);
    return {
      name: PROVIDER_DISPLAY_NAMES[provider] || String(provider),
      bg: theme.primaryBg || STANDARD_BADGE_STYLE.bg,
      text: theme.accentColor || STANDARD_BADGE_STYLE.text,
      border: theme.borderColor || STANDARD_BADGE_STYLE.border,
    };
  };

  /**
   * Renderizador reutilizável de Card de Recurso com Semáforo e Botão de Fixar
   */
  const renderResourceCard = (res: CloudResource, isPinnedSection = false) => {
    const sem = getSemaphoreStyle(res.status);
    const badge = getProviderBadge(res.provider);
    const isPinned = isResourcePinned(res.id);

    return (
      <TouchableOpacity
        key={`${isPinnedSection ? 'pinned-' : 'all-'}${res.id}`}
        style={[styles.resourceCard, isPinnedSection && styles.resourceCardPinned]}
        onPress={() => handleResourcePress(res)}
        activeOpacity={0.7}
      >
        {/* Tarja Lateral do Semáforo Sóbrio */}
        <View style={[styles.semaphoreStripe, { backgroundColor: sem.text }]} />

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={styles.cardHeaderLeft}>
              <View style={styles.cardBadgeRow}>
                <View
                  style={[
                    styles.providerBadge,
                    { backgroundColor: badge.bg, borderColor: badge.border },
                  ]}
                >
                  <Text style={[styles.providerBadgeText, { color: badge.text }]}>
                    {badge.name}
                  </Text>
                </View>
                <Text style={styles.resourceName}>{res.name}</Text>
              </View>
              <Text style={styles.resourceSub} numberOfLines={1}>
                {res.ocid || res.arn || res.id}
              </Text>
            </View>

            {/* Ações do Card: Indicador de Saúde Sóbrio e Botão de Fixar */}
            <View style={styles.cardHeaderRight}>
              <TouchableOpacity
                style={styles.pinBtn}
                onPress={() => togglePin(res.id)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={[styles.pinIconText, isPinned && styles.pinIconTextActive]}>
                  {isPinned ? '📌' : '📍'}
                </Text>
              </TouchableOpacity>

              <View
                style={[
                  styles.statusBadgeM3,
                  { backgroundColor: sem.bg, borderColor: sem.border },
                ]}
              >
                {res.status === 'REBOOTING' ? (
                  <ActivityIndicator size="small" color="#38BDF8" style={{ marginRight: 4 }} />
                ) : (
                  <View style={[styles.statusDotM3, { backgroundColor: sem.text }]} />
                )}
                <Text style={[styles.statusBadgeTextM3, { color: sem.text }]}>
                  {sem.label}
                </Text>
              </View>
            </View>
          </View>

          {/* Resumo de Métricas */}
          <View style={styles.metricsRow}>
            {res.metricsSummary.cpuPercent !== undefined && (
              <View
                style={[
                  styles.metricPill,
                  {
                    backgroundColor: sem.bg,
                    borderColor: sem.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.metricPillText,
                    { color: sem.text },
                  ]}
                >
                  CPU: {res.metricsSummary.cpuPercent}%
                </Text>
              </View>
            )}

            {res.metricsSummary.memoryPercent !== undefined && (
              <View style={styles.metricPill}>
                <Text style={styles.metricPillText}>
                  Mem: {res.metricsSummary.memoryPercent}%
                </Text>
              </View>
            )}

            {res.metricsSummary.latencyMs !== undefined && (
              <View
                style={[
                  styles.metricPill,
                  res.metricsSummary.latencyMs > 50 && styles.metricPillWarning,
                ]}
              >
                <Text
                  style={[
                    styles.metricPillText,
                    res.metricsSummary.latencyMs > 50 && styles.metricPillTextWarning,
                  ]}
                >
                  {res.metricsSummary.latencyMs}ms
                </Text>
              </View>
            )}

            <View style={styles.metricPill}>
              <Text style={styles.metricPillText}>{res.region}</Text>
            </View>
          </View>

          {/* Barra de Ações Rápidas de Ciclo de Vida */}
          <View style={styles.cardActionsRow}>
            <TouchableOpacity
              style={[
                styles.cardActionBtn,
                res.status === 'REBOOTING' && styles.cardActionBtnDisabled,
              ]}
              onPress={() => {
                if (res.status === 'REBOOTING') return;
                handleRestartCard(res.id);
              }}
              disabled={res.status === 'REBOOTING'}
              activeOpacity={0.7}
            >
              {res.status === 'REBOOTING' ? (
                <>
                  <ActivityIndicator size="small" color="#38BDF8" style={{ marginRight: 4 }} />
                  <Text style={styles.cardActionTextRebooting}>Reiniciando...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.cardActionIcon}>🔄</Text>
                  <Text style={styles.cardActionText}>Reiniciar</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cardActionBtn}
              onPress={() => handleOpenEditCard(res)}
              activeOpacity={0.7}
            >
              <Text style={styles.cardActionIcon}>✏️</Text>
              <Text style={styles.cardActionText}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.cardActionBtn, styles.cardActionBtnDelete]}
              onPress={() => handleDeleteCard(res.id)}
              activeOpacity={0.7}
            >
              <Text style={styles.cardActionIcon}>🗑️</Text>
              <Text style={[styles.cardActionText, styles.cardActionTextDelete]}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handlePullToRefresh}
            colors={['#38BDF8']}
            tintColor="#38BDF8"
          />
        }
      >
        {/* Topo Tecnológico */}
        <View style={styles.headerCurved}>
          <View style={styles.headerTopRow}>
            <View style={styles.regionBadge}>
              <View style={styles.activePulseDot} />
              <Text style={styles.regionBadgeText}>{gpsBadge}</Text>
            </View>

            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>Sair</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.uptimeRow}>
            <View>
              <Text style={styles.uptimeLabel}>SLA MÉDIO DE UPTIME</Text>
              <View style={styles.uptimeValRow}>
                <Text style={styles.uptimeValue}>{kpis.uptimeSla}%</Text>
                <Text style={styles.uptimeDelta}>▲ +0.02%</Text>
              </View>
              <Text style={styles.uptimeSub}>Semáforo de Saúde Global Ativo</Text>
            </View>

            <View style={styles.topActionsRow}>
              <TouchableOpacity
                style={styles.chaosMonkeyBtn}
                onPress={() => setIsChaosModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.chaosMonkeyIcon}>⚡</Text>
                <Text style={styles.chaosMonkeyText}>Simular Incidente</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={() => {
                  refreshMetrics();
                  Alert.alert('Atualização Concluída', 'Métricas atualizadas em tempo real.');
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.refreshIcon}>🔄</Text>
                <Text style={styles.refreshText}>Atualizar</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Seletor de Período */}
          <View style={styles.timeRangeSelector}>
            {(['1h', '6h', '24h', '7d', '30d'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.timeRangeBtn,
                  timeRange === range && styles.timeRangeBtnActive,
                ]}
                onPress={() => setTimeRange(range)}
              >
                <Text
                  style={[
                    styles.timeRangeText,
                    timeRange === range && styles.timeRangeTextActive,
                  ]}
                >
                  {range}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Botão de Destaque: Provisionar Nova Instância */}
        <View style={styles.provisionSection}>
          <TouchableOpacity
            style={styles.provisionBtn}
            onPress={handleOpenProvisionModal}
            activeOpacity={0.85}
          >
            <Text style={styles.provisionBtnIcon}>⚡</Text>
            <Text style={styles.provisionBtnText}>+ Provisionar Instância</Text>
          </TouchableOpacity>
        </View>

        {/* 4.1 Dock de Plataformas no Dashboard: [OCI], [AWS], [GCP] */}
        <View style={styles.dockSection}>
          <Text style={styles.dockSectionLabel}>PLATAFORMAS CONECTADAS</Text>
          <View style={styles.dockContainer}>
            {(['OCI', 'AWS', 'GCP'] as CloudProvider[]).map((prov) => {
              const isSelected = selectedProvider === prov;
              const isConnected = isProviderConnected(prov);
              const theme = getProviderTheme(prov);

              return (
                <TouchableOpacity
                  key={prov}
                  style={[
                    styles.dockChip,
                    isSelected && {
                      backgroundColor: theme.primaryBg,
                      borderColor: theme.primaryColor,
                    },
                  ]}
                  onPress={() => handleSelectProvider(prov)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.dockDot,
                      { backgroundColor: theme.primaryColor },
                      !isConnected && { opacity: 0.4 },
                    ]}
                  />
                  <Text
                    style={[
                      styles.dockChipText,
                      isSelected && { color: '#FFFFFF', fontWeight: '800' },
                    ]}
                  >
                    {prov}
                  </Text>
                  {!isConnected && <Text style={styles.dockLockIcon}>🔒</Text>}
                </TouchableOpacity>
              );
            })}

            <TouchableOpacity
              style={[
                styles.dockChip,
                styles.dockChipAll,
                selectedProvider === 'ALL' && styles.dockChipAllActive,
              ]}
              onPress={() => handleSelectProvider('ALL')}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.dockChipText,
                  selectedProvider === 'ALL' && { color: '#FFFFFF', fontWeight: '800' },
                ]}
              >
                TODOS ({kpis.total})
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* KPIs de Topo */}
        <View style={styles.kpiGrid}>
          <View style={styles.kpiCard}>
            <Text style={styles.kpiLabel}>TOTAL</Text>
            <Text style={styles.kpiValue}>{kpis.total}</Text>
            <Text style={styles.kpiSub}>Recursos</Text>
          </View>

          <View style={[styles.kpiCard, { borderColor: colors.status.healthyBorder }]}>
            <Text style={[styles.kpiLabel, { color: colors.status.healthy }]}>NORMAL</Text>
            <Text style={[styles.kpiValue, { color: colors.status.healthy }]}>
              {kpis.healthy}
            </Text>
            <Text style={styles.kpiSub}>Operacional</Text>
          </View>

          <View style={[styles.kpiCard, { borderColor: colors.status.dangerBorder }]}>
            <Text style={[styles.kpiLabel, { color: colors.status.danger }]}>CRÍTICO</Text>
            <Text style={[styles.kpiValue, { color: colors.status.danger }]}>
              {kpis.critical}
            </Text>
            <Text style={styles.kpiSub}>Atenção</Text>
          </View>
        </View>

        {/* Feature B: Radar de Latência Regional por GPS */}
        <View style={styles.latencyRadarCard}>
          <View style={styles.latencyRadarHeader}>
            <View style={styles.latencyRadarTitleRow}>
              <Text style={styles.latencyRadarIcon}>📡</Text>
              <View>
                <Text style={styles.latencyRadarTitle}>Radar de Latência Global</Text>
                <Text style={styles.latencyRadarSubtitle}>Sincronizado via GPS ({gpsBadge})</Text>
              </View>
            </View>
            <View style={styles.optimalRoutingBadge}>
              <Text style={styles.optimalRoutingBadgeText}>✓ Roteamento Ótimo Definido para sa-saopaulo-1</Text>
            </View>
          </View>

          <View style={styles.latencyLinesContainer}>
            {/* Linha 1: São Paulo */}
            <View style={styles.latencyLineItem}>
              <View style={styles.latencyLineLeft}>
                <View style={[styles.latencyLineDot, { backgroundColor: '#81C995' }]} />
                <Text style={styles.latencyCityName}>São Paulo (sa-saopaulo-1):</Text>
              </View>
              <View style={styles.latencyLineRight}>
                <Text style={[styles.latencyMs, { color: '#81C995' }]}>~18ms</Text>
                <Text style={styles.latencyContext}>(Datacenter Regional Mais Próximo)</Text>
              </View>
            </View>

            {/* Linha 2: N. Virginia */}
            <View style={styles.latencyLineItem}>
              <View style={styles.latencyLineLeft}>
                <View style={[styles.latencyLineDot, { backgroundColor: '#FDD663' }]} />
                <Text style={styles.latencyCityName}>N. Virginia (us-east-1):</Text>
              </View>
              <View style={styles.latencyLineRight}>
                <Text style={[styles.latencyMs, { color: '#FDD663' }]}>~124ms</Text>
                <Text style={styles.latencyContext}>(Conexão Transcontinental)</Text>
              </View>
            </View>

            {/* Linha 3: Frankfurt */}
            <View style={styles.latencyLineItem}>
              <View style={styles.latencyLineLeft}>
                <View style={[styles.latencyLineDot, { backgroundColor: '#F28B82' }]} />
                <Text style={styles.latencyCityName}>Frankfurt (eu-central-1):</Text>
              </View>
              <View style={styles.latencyLineRight}>
                <Text style={[styles.latencyMs, { color: '#F28B82' }]}>~215ms</Text>
                <Text style={styles.latencyContext}>(Conexão Europa)</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Seção de Governança: Recursos Fixados no Início */}
        {pinnedResources.length > 0 && !searchQuery.trim() && (
          <View style={styles.pinnedSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Text style={styles.pinnedHeaderIcon}>📌</Text>
                <Text style={styles.pinnedSectionTitle}>
                  RECURSOS FIXADOS ({pinnedResources.length})
                </Text>
              </View>
              <Text style={styles.pinnedSub}>Prioridade Alta</Text>
            </View>

            <View style={styles.resourceList}>
              {pinnedResources.map((res) => renderResourceCard(res, true))}
            </View>
          </View>
        )}

        {/* Lista Geral de Recursos Monitorados */}
        <View style={styles.resourcesSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>INFRAESTRUTURA EM NUVEM</Text>
            <Text style={styles.sectionUpdated}>Atualizado: {lastUpdated}</Text>
          </View>

          {/* Barra de Busca Instantânea (Tarefa B) */}
          <View style={styles.searchContainer}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              placeholder="Filtrar por nome ou OCID..."
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCapitalize="none"
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => setSearchQuery('')}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                style={styles.searchClearBtn}
              >
                <Text style={styles.searchClearText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.resourceList}>
            {displayedResources.length > 0 ? (
              displayedResources.map((res) => renderResourceCard(res, false))
            ) : (
              <View style={styles.emptyFilterCard}>
                <Text style={styles.emptyFilterIcon}>🔎</Text>
                <Text style={styles.emptyFilterText}>
                  Nenhum recurso encontrado para este filtro
                </Text>
                <Text style={styles.emptyFilterSub}>
                  Verifique o termo digitado ou limpe a busca para visualizar os recursos
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Modal Interativo de Provisionamento Personalizado (Tarefa A) */}
      <Modal
        visible={isProvisionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isProvisioning) setIsProvisionModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.provisionModalCard}>
            {/* Modal Header */}
            <View style={styles.provisionModalHeader}>
              <View>
                <Text style={styles.provisionModalTitle}>⚡ Provisionar Instância</Text>
                <View style={styles.activeProviderTag}>
                  <Text style={styles.activeProviderTagText}>
                    Nuvem Ativa: {activeSessionProvider}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.modalCloseBtn}
                onPress={() => setIsProvisionModalVisible(false)}
                disabled={isProvisioning}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={styles.provisionFormScroll}>
              {/* 1. Nome do Servidor */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>NOME DO SERVIDOR</Text>
                <TextInput
                  style={styles.formInput}
                  placeholder="ex: api-gateway-prod-01"
                  placeholderTextColor="#64748B"
                  value={serverName}
                  onChangeText={setServerName}
                  autoCapitalize="none"
                  editable={!isProvisioning}
                />
              </View>

              {/* 2. Arquitetura / Shape */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>ARQUITETURA / SHAPE (OCI)</Text>
                <View style={styles.shapesContainer}>
                  <TouchableOpacity
                    style={[
                      styles.shapeCard,
                      selectedShape === 'VM.Standard.E4.Flex' && styles.shapeCardActive,
                    ]}
                    onPress={() => setSelectedShape('VM.Standard.E4.Flex')}
                    disabled={isProvisioning}
                  >
                    <View style={styles.shapeRadioRow}>
                      <View
                        style={[
                          styles.radioDot,
                          selectedShape === 'VM.Standard.E4.Flex' && styles.radioDotActive,
                        ]}
                      />
                      <Text
                        style={[
                          styles.shapeName,
                          selectedShape === 'VM.Standard.E4.Flex' && styles.shapeNameActive,
                        ]}
                      >
                        VM.Standard.E4.Flex
                      </Text>
                    </View>
                    <Text style={styles.shapeSubtitle}>Processador AMD EPYC™ (x86_64)</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.shapeCard,
                      selectedShape === 'VM.Standard.A1.Flex' && styles.shapeCardActive,
                    ]}
                    onPress={() => setSelectedShape('VM.Standard.A1.Flex')}
                    disabled={isProvisioning}
                  >
                    <View style={styles.shapeRadioRow}>
                      <View
                        style={[
                          styles.radioDot,
                          selectedShape === 'VM.Standard.A1.Flex' && styles.radioDotActive,
                        ]}
                      />
                      <Text
                        style={[
                          styles.shapeName,
                          selectedShape === 'VM.Standard.A1.Flex' && styles.shapeNameActive,
                        ]}
                      >
                        VM.Standard.A1.Flex
                      </Text>
                    </View>
                    <Text style={styles.shapeSubtitle}>Processador Arm Ampere® (AArch64)</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* 3. Recursos: vCPUs e Memória */}
              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>vCPUs (OCPUs)</Text>
                <View style={styles.optionsRow}>
                  {[1, 2, 4].map((ocpu) => (
                    <TouchableOpacity
                      key={`ocpu-${ocpu}`}
                      style={[
                        styles.optionChip,
                        selectedOcpu === ocpu && styles.optionChipActive,
                      ]}
                      onPress={() => setSelectedOcpu(ocpu)}
                      disabled={isProvisioning}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          selectedOcpu === ocpu && styles.optionChipTextActive,
                        ]}
                      >
                        {ocpu} {ocpu === 1 ? 'OCPU' : 'OCPUs'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.formLabel}>MEMÓRIA RAM</Text>
                <View style={styles.optionsRow}>
                  {[4, 8, 16].map((ram) => (
                    <TouchableOpacity
                      key={`ram-${ram}`}
                      style={[
                        styles.optionChip,
                        selectedMemory === ram && styles.optionChipActive,
                      ]}
                      onPress={() => setSelectedMemory(ram)}
                      disabled={isProvisioning}
                    >
                      <Text
                        style={[
                          styles.optionChipText,
                          selectedMemory === ram && styles.optionChipTextActive,
                        ]}
                      >
                        {ram} GB RAM
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Resumo da Configuração */}
              <View style={styles.provisionSummaryBox}>
                <Text style={styles.summaryLabel}>ESPECIFICAÇÃO SELECIONADA</Text>
                <Text style={styles.summaryText}>
                  {selectedShape} • {selectedOcpu} OCPU(s) • {selectedMemory} GB RAM
                </Text>
                <Text style={styles.summarySub}>
                  Região: sa-saopaulo-1 • SLA: 99.98% • Status: OPERACIONAL
                </Text>
              </View>
            </ScrollView>

            {/* Ações do Modal */}
            <View style={styles.provisionModalActions}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setIsProvisionModalVisible(false)}
                disabled={isProvisioning}
              >
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmProvisionBtn, isProvisioning && styles.confirmBtnDisabled]}
                onPress={handleConfirmProvision}
                disabled={isProvisioning}
              >
                {isProvisioning ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
                    <Text style={styles.confirmBtnText}>Provisionando recursos...</Text>
                  </>
                ) : (
                  <Text style={styles.confirmBtnText}>Confirmar Provisionamento</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal da Câmera para Escanear QR Code de Novo Provedor */}
      <Modal
        visible={isCameraActive}
        animationType="slide"
        onRequestClose={() => setIsCameraActive(false)}
      >
        <SafeAreaView style={styles.cameraModalContainer}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraTitle}>
              Conectar {targetProviderToConnect || 'Provedor'} via QR Code
            </Text>
            <TouchableOpacity
              style={styles.cameraCloseBtn}
              onPress={() => setIsCameraActive(false)}
            >
              <Text style={styles.cameraCloseText}>✕ Fechar</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.cameraWrapper}>
            {isCameraActive && (
              <Camera
                style={StyleSheet.absoluteFillObject}
                scanBarcode={true}
                onReadCode={handleBarcodeRead}
              />
            )}

            <View style={styles.cameraOverlay}>
              <View style={styles.scanFrame}>
                <View style={styles.scanLaser} />
              </View>
              <Text style={styles.cameraInstruction}>
                Aponte para o QR Code de {targetProviderToConnect || 'nuvem'}
              </Text>
            </View>
          </View>

          <View style={styles.cameraFooter}>
            <TouchableOpacity
              style={styles.cameraTestBtn}
              onPress={handleSimulateConnection}
            >
              <Text style={styles.cameraTestBtnText}>
                ⚡ Conectar Credencial Oficial ({targetProviderToConnect || 'Provedor'})
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Modal Simples de Edição de Nome da Instância */}
      <Modal
        visible={!!editingResource}
        transparent
        animationType="fade"
        onRequestClose={() => setEditingResource(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalCard}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>✏️ Editar Instância</Text>
              <TouchableOpacity
                onPress={() => setEditingResource(null)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>NOME DO SERVIDOR</Text>
              <TextInput
                style={styles.formInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Nome da instância"
                placeholderTextColor="#64748B"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.editModalActionsRow}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setEditingResource(null)}
              >
                <Text style={styles.cancelModalBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveModalBtn} onPress={handleSaveEditCard}>
                <Text style={styles.saveModalBtnText}>Salvar Alterações</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Chaos Monkey (Injetor de Incidentes ao Vivo) */}
      <Modal
        visible={isChaosModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsChaosModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.chaosModalCard}>
            <View style={styles.chaosModalHeader}>
              <View style={styles.chaosModalTitleRow}>
                <Text style={styles.chaosModalIcon}>⚡</Text>
                <View>
                  <Text style={styles.chaosModalTitle}>Chaos Monkey</Text>
                  <Text style={styles.chaosModalSubtitle}>Injetor de Incidentes em Tempo Real</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => setIsChaosModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.chaosModalDesc}>
              Demonstre a reatividade imediata da telemetria e o failover multi-cloud para a banca avaliadora com um toque:
            </Text>

            <View style={styles.chaosActionsList}>
              {/* Gatilho 1 */}
              <TouchableOpacity
                style={[styles.chaosActionCard, styles.chaosActionOverload]}
                onPress={handleChaosCpuOverload}
                activeOpacity={0.8}
              >
                <View style={styles.chaosActionHeader}>
                  <Text style={styles.chaosActionIcon}>🔥</Text>
                  <Text style={styles.chaosActionTitle}>Injetar Sobrecarga de CPU (98%)</Text>
                </View>
                <Text style={styles.chaosActionDesc}>
                  Altera a primeira instância saudável para uso de CPU em 98%, muda seu status para CRITICAL, decrementa o SLA e dispara vibração háptica dupla.
                </Text>
              </TouchableOpacity>

              {/* Gatilho 2 */}
              <TouchableOpacity
                style={[styles.chaosActionCard, styles.chaosActionCrash]}
                onPress={handleChaosCrashPrimary}
                activeOpacity={0.8}
              >
                <View style={styles.chaosActionHeader}>
                  <Text style={styles.chaosActionIcon}>🛑</Text>
                  <Text style={styles.chaosActionTitle}>Derrubar Instância Principal</Text>
                </View>
                <Text style={styles.chaosActionDesc}>
                  Altera o status para STOPPED (CPU 0%), incrementa o contador de incidentes e adiciona log de auditoria.
                </Text>
              </TouchableOpacity>

              {/* Gatilho 3 */}
              <TouchableOpacity
                style={[styles.chaosActionCard, styles.chaosActionRestore]}
                onPress={handleChaosRestore}
                activeOpacity={0.8}
              >
                <View style={styles.chaosActionHeader}>
                  <Text style={styles.chaosActionIcon}>🟢</Text>
                  <Text style={styles.chaosActionTitle}>Restaurar Infraestrutura</Text>
                </View>
                <Text style={styles.chaosActionDesc}>
                  Normaliza todos os nós para HEALTHY com métricas equilibradas e zera as anomalias.
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.chaosCloseBtn}
              onPress={() => setIsChaosModalVisible(false)}
            >
              <Text style={styles.chaosCloseBtnText}>Fechar Painel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    paddingBottom: 95,
  },
  headerCurved: {
    backgroundColor: '#1F242C',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 22,
    borderBottomLeftRadius: 36,
    borderBottomRightRadius: 36,
    borderBottomWidth: 1,
    borderBottomColor: '#282E38',
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  regionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#38BDF820',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#38BDF840',
    gap: 6,
  },
  activePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neonCyan,
  },
  regionBadgeText: {
    color: colors.neonCyan,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logoutBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  logoutText: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  uptimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  uptimeLabel: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  uptimeValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginVertical: 2,
  },
  uptimeValue: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '900',
  },
  uptimeDelta: {
    color: colors.status.healthy,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  uptimeSub: {
    color: colors.textMuted,
    fontSize: 10,
  },
  topActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chaosMonkeyBtn: {
    backgroundColor: '#7F1D1D25',
    borderWidth: 1,
    borderColor: '#EF444460',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chaosMonkeyIcon: {
    fontSize: 14,
  },
  chaosMonkeyText: {
    color: '#F87171',
    fontSize: 8,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  refreshBtn: {
    backgroundColor: '#38BDF825',
    borderWidth: 1,
    borderColor: '#38BDF850',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    alignItems: 'center',
  },
  refreshIcon: {
    fontSize: 14,
  },
  refreshText: {
    color: colors.neonCyan,
    fontSize: 8,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 2,
  },
  timeRangeSelector: {
    flexDirection: 'row',
    backgroundColor: '#12161D',
    borderRadius: 12,
    padding: 3,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#282E38',
  },
  timeRangeBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  timeRangeBtnActive: {
    backgroundColor: colors.accentBlue,
  },
  timeRangeText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  timeRangeTextActive: {
    color: '#FFFFFF',
  },
  provisionSection: {
    paddingHorizontal: 16,
    marginTop: 14,
  },
  provisionBtn: {
    backgroundColor: '#181C22',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  provisionBtnIcon: {
    fontSize: 14,
    color: '#38BDF8',
  },
  provisionBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  dockSection: {
    marginTop: 14,
    paddingHorizontal: 16,
  },
  dockSectionLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  dockContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  dockChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    backgroundColor: '#181C22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#282E38',
    gap: 5,
  },
  dockDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  dockChipText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dockLockIcon: {
    fontSize: 9,
  },
  dockChipAll: {
    flex: 1.2,
  },
  dockChipAllActive: {
    backgroundColor: '#2563EB25',
    borderColor: '#2563EB',
  },
  filterSection: {
    marginTop: 14,
  },
  filterScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  filterPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#181C22',
    borderWidth: 1,
    borderColor: '#282E38',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterPillActive: {
    backgroundColor: '#2563EB',
    borderColor: '#2563EB',
  },
  filterPillOciActive: {
    backgroundColor: colors.oci.primary,
    borderColor: colors.oci.primary,
  },
  filterPillAwsActive: {
    backgroundColor: colors.aws.primary,
    borderColor: colors.aws.primary,
  },
  filterPillGcpActive: {
    backgroundColor: colors.gcp.primary,
    borderColor: colors.gcp.primary,
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  filterPillText: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },
  kpiGrid: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 8,
    marginTop: 14,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: '#181C22',
    borderWidth: 1,
    borderColor: '#282E38',
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
  },
  kpiLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  kpiValue: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginVertical: 1,
  },
  kpiSub: {
    color: colors.textMuted,
    fontSize: 8,
  },
  latencyRadarCard: {
    backgroundColor: '#181C22',
    borderWidth: 1,
    borderColor: '#282E38',
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 14,
    padding: 14,
  },
  latencyRadarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  latencyRadarTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  latencyRadarIcon: {
    fontSize: 18,
  },
  latencyRadarTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  latencyRadarSubtitle: {
    color: '#64748B',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  optimalRoutingBadge: {
    backgroundColor: '#132B1D',
    borderWidth: 1,
    borderColor: '#1E462E',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  optimalRoutingBadgeText: {
    color: '#81C995',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  latencyLinesContainer: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#282E38',
    paddingTop: 10,
  },
  latencyLineItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 3,
  },
  latencyLineLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  latencyLineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  latencyCityName: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  latencyLineRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  latencyMs: {
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  latencyContext: {
    color: '#64748B',
    fontSize: 9,
  },
  statusBadgeM3: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 12,
    borderWidth: 1,
    gap: 4,
  },
  statusDotM3: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  statusBadgeTextM3: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  chaosModalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#181C22',
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: '#282E38',
    padding: 18,
  },
  chaosModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#282E38',
  },
  chaosModalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chaosModalIcon: {
    fontSize: 20,
  },
  chaosModalTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  chaosModalSubtitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  chaosModalDesc: {
    color: '#94A3B8',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 14,
  },
  chaosActionsList: {
    gap: 10,
    marginBottom: 16,
  },
  chaosActionCard: {
    backgroundColor: '#12161D',
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  chaosActionOverload: {
    borderColor: '#F28B8260',
    backgroundColor: '#2D151540',
  },
  chaosActionCrash: {
    borderColor: '#EF444460',
    backgroundColor: '#450A0A40',
  },
  chaosActionRestore: {
    borderColor: '#81C99560',
    backgroundColor: '#132B1D40',
  },
  chaosActionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  chaosActionIcon: {
    fontSize: 16,
  },
  chaosActionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  chaosActionDesc: {
    color: '#94A3B8',
    fontSize: 10,
    lineHeight: 14,
  },
  chaosCloseBtn: {
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: '#282E38',
    alignItems: 'center',
  },
  chaosCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  pinnedSection: {
    marginTop: 18,
    paddingHorizontal: 16,
  },
  pinnedTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  pinnedHeaderIcon: {
    fontSize: 12,
  },
  pinnedSectionTitle: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  pinnedSub: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '700',
  },
  resourceCardPinned: {
    backgroundColor: '#0F172A',
    borderColor: '#334155',
  },
  resourcesSection: {
    marginTop: 18,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  sectionUpdated: {
    color: colors.neonCyan,
    fontSize: 9,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 10 : 2,
    marginBottom: 14,
    gap: 8,
  },
  searchIcon: {
    fontSize: 14,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: 'monospace',
    paddingVertical: 6,
  },
  searchClearBtn: {
    padding: 4,
  },
  searchClearText: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  emptyFilterCard: {
    backgroundColor: '#0F172A',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  emptyFilterIcon: {
    fontSize: 24,
    marginBottom: 8,
    opacity: 0.7,
  },
  emptyFilterText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyFilterSub: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 4,
    textAlign: 'center',
  },
  resourceList: {
    gap: 10,
  },
  resourceCard: {
    backgroundColor: colors.surfaceCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  semaphoreStripe: {
    width: 5,
  },
  cardContent: {
    flex: 1,
    padding: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardHeaderLeft: {
    flex: 1,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 6,
  },
  pinBtn: {
    padding: 2,
  },
  pinIconText: {
    fontSize: 14,
    opacity: 0.5,
  },
  pinIconTextActive: {
    opacity: 1,
  },
  cardBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  providerBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 1,
  },
  providerBadgeText: {
    fontSize: 8,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  resourceName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  resourceSub: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: 'monospace',
    marginTop: 3,
    maxWidth: 220,
  },
  statusIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  metricPill: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metricPillWarning: {
    backgroundColor: '#78350F40',
    borderWidth: 1,
    borderColor: '#F59E0B60',
  },
  metricPillDanger: {
    backgroundColor: '#7F1D1D50',
    borderWidth: 1,
    borderColor: '#DC262660',
  },
  metricPillText: {
    color: colors.textSecondary,
    fontSize: 9,
    fontFamily: 'monospace',
  },
  metricPillTextWarning: {
    color: '#FBBF24',
    fontWeight: '700',
  },
  metricPillTextDanger: {
    color: '#F87171',
    fontWeight: '700',
  },
  cameraModalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  cameraHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: '#0F172A',
  },
  cameraTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cameraCloseBtn: {
    padding: 6,
  },
  cameraCloseText: {
    color: '#F87171',
    fontWeight: '700',
    fontSize: 12,
  },
  cameraWrapper: {
    flex: 1,
    position: 'relative',
    backgroundColor: '#000',
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: '#38BDF8',
    borderRadius: 16,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#00000020',
  },
  scanLaser: {
    width: '100%',
    height: 2,
    backgroundColor: '#38BDF8',
  },
  cameraInstruction: {
    color: '#E2E8F0',
    fontSize: 11,
    marginTop: 20,
    textAlign: 'center',
    paddingHorizontal: 30,
    backgroundColor: '#00000080',
    paddingVertical: 6,
    borderRadius: 8,
  },
  cameraFooter: {
    padding: 16,
    backgroundColor: '#0F172A',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  cameraTestBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cameraTestBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  provisionModalCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#1E293B',
    padding: 20,
    maxHeight: '90%',
  },
  provisionModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    marginBottom: 14,
  },
  provisionModalTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  activeProviderTag: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  activeProviderTagText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  modalCloseBtn: {
    padding: 6,
  },
  modalCloseText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
  },
  provisionFormScroll: {
    maxHeight: 380,
  },
  formGroup: {
    marginBottom: 14,
  },
  formLabel: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'monospace',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  formInput: {
    backgroundColor: '#070D1A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 13,
  },
  shapesContainer: {
    gap: 8,
  },
  shapeCard: {
    backgroundColor: '#070D1A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
  },
  shapeCardActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#0C1B33',
  },
  shapeRadioRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#475569',
  },
  radioDotActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#38BDF8',
  },
  shapeName: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  shapeNameActive: {
    color: '#38BDF8',
  },
  shapeSubtitle: {
    color: '#64748B',
    fontSize: 10,
    marginTop: 4,
    marginLeft: 20,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  optionChip: {
    flex: 1,
    backgroundColor: '#070D1A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  optionChipActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#0C1B33',
  },
  optionChipText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  optionChipTextActive: {
    color: '#38BDF8',
    fontWeight: '800',
  },
  provisionSummaryBox: {
    backgroundColor: '#070D1A',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  summaryLabel: {
    color: '#64748B',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  summaryText: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  summarySub: {
    color: '#38BDF8',
    fontSize: 10,
    marginTop: 2,
  },
  provisionModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  cancelBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '700',
  },
  confirmProvisionBtn: {
    flex: 1,
    backgroundColor: '#0284C7',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    opacity: 0.7,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '800',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 5,
    gap: 4,
  },
  cardActionBtnDisabled: {
    opacity: 0.6,
  },
  cardActionBtnDelete: {
    borderColor: '#7F1D1D',
    backgroundColor: '#450A0A33',
  },
  cardActionIcon: {
    fontSize: 11,
  },
  cardActionText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  cardActionTextRebooting: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  cardActionTextDelete: {
    color: '#F87171',
  },
  rebootingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0C1B33',
    borderColor: '#38BDF8',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  rebootingBadgeText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  editModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 18,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editModalTitle: {
    color: '#F8FAFC',
    fontSize: 16,
    fontWeight: '700',
  },
  editModalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 18,
  },
  cancelModalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  cancelModalBtnText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  saveModalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    backgroundColor: '#0284C7',
  },
  saveModalBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});
