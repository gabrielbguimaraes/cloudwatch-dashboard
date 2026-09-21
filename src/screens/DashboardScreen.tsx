

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
} from 'react-native';
import { Camera } from 'react-native-camera-kit';
import { colors } from '../theme';
import { useCloud } from '../context/CloudContext';
import { useAuth } from '../context/AuthContext';
import type { CloudResource, CloudProvider } from '../types';
import { detectNearestDatacenter } from '../services/locationService';

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    filteredResources,
    pinnedResources,
    selectedProvider,
    connectedProviders,
    setProviderFilter,
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
  } = useCloud();

  const { logout, loginWithQrCodePayload } = useAuth();

  // Estados de Hardware: Localização GPS e Câmera de Provedor
  const [gpsBadge, setGpsBadge] = useState<string>('📍 Detectando GPS...');
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [targetProviderToConnect, setTargetProviderToConnect] = useState<CloudProvider | null>(null);
  const [isProcessingQr, setIsProcessingQr] = useState<boolean>(false);

  // Contextualização Regional por GPS (expo-location)
  useEffect(() => {
    let isMounted = true;
    detectNearestDatacenter()
      .then((res) => {
        if (isMounted && res.badge) {
          setGpsBadge(res.badge);
        }
      })
      .catch((err) => {
        console.warn('Erro ao obter localização por GPS:', err);
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const handleResourcePress = (resource: CloudResource) => {
    setSelectedResource(resource);
    navigation.navigate('MetricsDetail', { resourceId: resource.id });
  };

  const handleLogout = () => {
    logout();
    navigation.replace('Login');
  };

  /**
   * Provisiona sob demanda uma nova instância computacional
   */
  const handleProvisionInstance = () => {
    const targetProvider = selectedProvider === 'ALL' ? undefined : selectedProvider;
    const newResource = provisionInstance(targetProvider);

    Alert.alert(
      '⚡ Nova Instância Provisionada',
      `Recurso provisionado com sucesso:\n\n• Nome: ${newResource.name}\n• Provedor: ${newResource.provider}\n• Status: ${newResource.status}\n• CPU: ${newResource.metricsSummary.cpuPercent}% | RAM: ${newResource.metricsSummary.memoryPercent}%`,
      [{ text: 'OK' }]
    );
  };

  /**
   * Lógica de Provedor Ativo vs. Outras Nuvens no Dashboard:
   * Se clicar em nuvem não conectada, solicita escaneamento de QR Code
   */
  const handleSelectProvider = (prov: CloudProvider | 'ALL') => {
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
            onPress: () => {
              setTargetProviderToConnect(prov);
              setIsCameraActive(true);
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

  const getStatusColor = (status: CloudResource['status']) => {
    if (status === 'CRITICAL') return colors.status.danger;
    if (status === 'WARNING') return colors.status.warning;
    return colors.status.healthy;
  };

  const STANDARD_BADGE_STYLE = {
    bg: '#1E293B',
    border: '#334155',
    text: '#94A3B8',
  };

  const PROVIDER_DISPLAY_NAMES: Record<string, string> = {
    OCI: 'ORACLE OCI',
    AWS: 'AWS',
    GCP: 'GOOGLE CLOUD',
    ALL: 'MULTI-CLOUD',
  };

  const getProviderBadge = (provider: CloudProvider) => {
    return {
      name: PROVIDER_DISPLAY_NAMES[provider] || String(provider),
      bg: STANDARD_BADGE_STYLE.bg,
      text: STANDARD_BADGE_STYLE.text,
      border: STANDARD_BADGE_STYLE.border,
    };
  };

  /**
   * Renderizador reutilizável de Card de Recurso com Semáforo e Botão de Fixar
   */
  const renderResourceCard = (res: CloudResource, isPinnedSection = false) => {
    const statusColor = getStatusColor(res.status);
    const badge = getProviderBadge(res.provider);
    const isPinned = isResourcePinned(res.id);

    return (
      <TouchableOpacity
        key={`${isPinnedSection ? 'pinned-' : 'all-'}${res.id}`}
        style={[styles.resourceCard, isPinnedSection && styles.resourceCardPinned]}
        onPress={() => handleResourcePress(res)}
        activeOpacity={0.7}
      >
        {/* Tarja Lateral do Semáforo Rigoroso */}
        <View style={[styles.semaphoreStripe, { backgroundColor: statusColor }]} />

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

            {/* Ações do Card: Indicador de Saúde e Botão de Fixar */}
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

              <View style={[styles.statusIndicator, { backgroundColor: statusColor }]} />
            </View>
          </View>

          {/* Resumo de Métricas */}
          <View style={styles.metricsRow}>
            {res.metricsSummary.cpuPercent !== undefined && (
              <View
                style={[
                  styles.metricPill,
                  res.status === 'CRITICAL' && styles.metricPillDanger,
                  res.status === 'WARNING' && styles.metricPillWarning,
                ]}
              >
                <Text
                  style={[
                    styles.metricPillText,
                    res.status === 'CRITICAL' && styles.metricPillTextDanger,
                    res.status === 'WARNING' && styles.metricPillTextWarning,
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
            refreshing={isLoading}
            onRefresh={refreshMetrics}
            tintColor={colors.neonCyan}
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
            onPress={handleProvisionInstance}
            activeOpacity={0.85}
          >
            <Text style={styles.provisionBtnIcon}>⚡</Text>
            <Text style={styles.provisionBtnText}>+ Provisionar Instância</Text>
          </TouchableOpacity>
        </View>

        {/* Filtro por Provedor com Suporte a Conexão Dinâmica */}
        <View style={styles.filterSection}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            <TouchableOpacity
              style={[styles.filterPill, selectedProvider === 'ALL' && styles.filterPillActive]}
              onPress={() => handleSelectProvider('ALL')}
            >
              <Text
                style={[
                  styles.filterPillText,
                  selectedProvider === 'ALL' && styles.filterPillTextActive,
                ]}
              >
                Todos ({kpis.total})
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, selectedProvider === 'OCI' && styles.filterPillOciActive]}
              onPress={() => handleSelectProvider('OCI')}
            >
              <View style={[styles.filterDot, { backgroundColor: '#EF4444' }]} />
              <Text
                style={[
                  styles.filterPillText,
                  selectedProvider === 'OCI' && styles.filterPillTextActive,
                ]}
              >
                Oracle OCI {!isProviderConnected('OCI') ? '🔒' : ''}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, selectedProvider === 'AWS' && styles.filterPillAwsActive]}
              onPress={() => handleSelectProvider('AWS')}
            >
              <View style={[styles.filterDot, { backgroundColor: '#F59E0B' }]} />
              <Text
                style={[
                  styles.filterPillText,
                  selectedProvider === 'AWS' && styles.filterPillTextActive,
                ]}
              >
                AWS {!isProviderConnected('AWS') ? '🔒' : ''}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.filterPill, selectedProvider === 'GCP' && styles.filterPillGcpActive]}
              onPress={() => handleSelectProvider('GCP')}
            >
              <View style={[styles.filterDot, { backgroundColor: '#3B82F6' }]} />
              <Text
                style={[
                  styles.filterPillText,
                  selectedProvider === 'GCP' && styles.filterPillTextActive,
                ]}
              >
                GCP {!isProviderConnected('GCP') ? '🔒' : ''}
              </Text>
            </TouchableOpacity>
          </ScrollView>
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

        {/* Seção de Governança: Recursos Fixados no Início */}
        {pinnedResources.length > 0 && (
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

          <View style={styles.resourceList}>
            {filteredResources.map((res) => renderResourceCard(res, false))}
          </View>
        </View>
      </ScrollView>

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
            <Camera
              style={StyleSheet.absoluteFillObject}
              scanBarcode={true}
              onReadCode={handleBarcodeRead}
            />

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
    backgroundColor: '#091122',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    borderBottomWidth: 1,
    borderBottomColor: '#172554',
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
    backgroundColor: '#0066FF20',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#0066FF40',
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
    fontFamily: 'monospace',
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
    fontFamily: 'monospace',
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
    fontFamily: 'monospace',
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
  refreshBtn: {
    backgroundColor: '#0066FF25',
    borderWidth: 1,
    borderColor: '#0066FF50',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
    alignItems: 'center',
  },
  refreshIcon: {
    fontSize: 16,
  },
  refreshText: {
    color: colors.neonCyan,
    fontSize: 8,
    fontWeight: '900',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  timeRangeSelector: {
    flexDirection: 'row',
    backgroundColor: '#0C152B',
    borderRadius: 12,
    padding: 3,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  timeRangeBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    borderRadius: 8,
  },
  timeRangeBtnActive: {
    backgroundColor: colors.neonBlue,
  },
  timeRangeText: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  timeRangeTextActive: {
    color: '#FFFFFF',
  },
  provisionSection: {
    paddingHorizontal: 16,
    marginTop: 14,
  },
  provisionBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1.5,
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
    backgroundColor: '#0D1527',
    borderWidth: 1,
    borderColor: '#1E293B',
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
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 16,
    padding: 10,
    alignItems: 'center',
  },
  kpiLabel: {
    color: colors.textSecondary,
    fontSize: 9,
    fontWeight: '700',
    fontFamily: 'monospace',
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
});
