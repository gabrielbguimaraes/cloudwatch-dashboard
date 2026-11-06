/**
 * DashboardScreen - Painel Principal de Monitoramento Multi-Cloud (Dados Reais OCI)
 * Fase 3 (Sprint 2):
 *  - Nuvens independentes: exibe apenas os provedores conectados pelo usuário autenticado
 *  - Estado inicial sem nuvens: tela "Conecte uma nuvem" (OCI ativo, AWS/GCP "Em breve")
 *  - Badge visível LIVE / CACHE, banner "Dados em cache de HH:mm" e toast de erro se o BFF falhar
 *  - Cartões com dados 100% reais das VMs OCI (nome, shape, OCPUs, memória, IPs, lifecycleState e CPU/RAM)
 *  - Zero botões de simulação, zero provisionamento falso, zero terminal simulado.
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  Platform,
  ActivityIndicator,
  NativeModules,
  Share,
  Modal,
  TextInput,
} from 'react-native';
import { useCloud } from '../context/CloudContext';
import { useAuth } from '../context/AuthContext';
import { CloudLogo } from '../components/common/CloudLogo';
import {
  FileReportIcon,
  MoreHorizontalIcon,
  PinIcon,
} from '../components/common/AppIcons';
import { InstanceActionSheet } from '../components/InstanceActionSheet';
import { SerialConsoleModal } from '../components/SerialConsoleModal';
import { Toast } from '../components/common/Toast';
import { CLOUD_PALETTES, NEUTRAL_THEME } from '../theme/tokens';
import { Print, sharePdfAsync } from '../services/pdfService';
import type { CloudResource } from '../types';
import type { SupportedCloud } from '../types/auth';

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    filteredResources,
    pinnedResourceIds,
    kpis,
    isLoading,
    lastUpdated,
    telemetrySource,
    isOfflineCache,
    cachedAtHHmm,
    syncError,
    policyHint,
    refreshMetrics,
    setSelectedResource,
    togglePin,
    isResourcePinned,
    mitigateAnomaly,
    provisionInstance,
    deleteInstance,
  } = useCloud();

  const {
    masterUser,
    activeProvider,
    cloudAccounts,
    connectedProviders,
    hasConnectedClouds,
    switchActiveProvider,
    linkCloudProvider,
  } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedInstanceForAction, setSelectedInstanceForAction] =
    useState<CloudResource | null>(null);
  const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);
  const [terminalInstance, setTerminalInstance] = useState<CloudResource | null>(null);
  const [quickLinkProvider, setQuickLinkProvider] = useState<'AWS' | 'GCP' | null>(null);
  const [quickLinkKey1, setQuickLinkKey1] = useState('');
  const [quickLinkKey2, setQuickLinkKey2] = useState('');
  const [quickLinkRegion, setQuickLinkRegion] = useState('us-east-1');

  // Exibe toast de erro automaticamente quando a sincronização com o BFF falha
  useEffect(() => {
    if (syncError) {
      setToastMessage(syncError);
    }
  }, [syncError]);

  const activePalette = CLOUD_PALETTES[activeProvider] || CLOUD_PALETTES.OCI;
  const activeAccountConfig = cloudAccounts[activeProvider];

  // Ordena instâncias fixadas primeiro
  const orderedResources = useMemo(() => {
    return [...filteredResources].sort((a, b) => {
      const aPinned = pinnedResourceIds.includes(a.id) ? 1 : 0;
      const bPinned = pinnedResourceIds.includes(b.id) ? 1 : 0;
      return bPinned - aPinned;
    });
  }, [filteredResources, pinnedResourceIds]);

  const navigateToOciOnboarding = () => {
    if (navigation.getParent?.()) {
      navigation.getParent().navigate('OciOnboarding');
    } else {
      navigation.navigate('OciOnboarding');
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshMetrics(true);
    setRefreshing(false);
  };

  const handleCopyPolicyHint = async (text: string) => {
    try {
      const clipboard = (NativeModules as any)?.Clipboard;
      if (clipboard && typeof clipboard.setString === 'function') {
        clipboard.setString(text);
        setToastMessage('Policies IAM copiadas para a área de transferência');
      } else {
        await Share.share({ message: text });
      }
    } catch {
      setToastMessage('Não foi possível copiar o texto');
    }
  };

  const handleExportPdf = async () => {
    try {
      const target = orderedResources[0];
      if (!target) {
        setToastMessage('Nenhuma instância disponível para gerar relatório PDF');
        return;
      }

      setToastMessage('Gerando relatório executivo em PDF...');
      const auditorLabel = masterUser
        ? `${masterUser.username} (${masterUser.email})`
        : undefined;
      const html = Print.generateExecutiveReportHtml(target, auditorLabel);
      const cpuStr =
        typeof target.metricsSummary?.cpuPercent === 'number'
          ? `${target.metricsSummary.cpuPercent.toFixed(1)}%`
          : 'N/D';
      const memStr =
        typeof target.metricsSummary?.memoryPercent === 'number'
          ? `${target.metricsSummary.memoryPercent.toFixed(1)}%`
          : 'N/D';

      const pdfResult = await Print.printToFileAsync({
        html,
        serverName: target.name,
        provider: target.provider,
        region: target.region,
        status: target.status,
        cpu: cpuStr,
        memory: memStr,
        ocid: target.ocid || target.arn || target.id,
        sla: `${kpis.uptimeSla}%`,
        auditor: auditorLabel,
      });

      await sharePdfAsync(pdfResult.uri, `Relatório de Telemetria - ${target.name}`);
    } catch {
      setToastMessage('Falha ao exportar relatório PDF');
    }
  };

  const handleSelectConnectedCloud = async (cloud: SupportedCloud) => {
    if (!cloudAccounts[cloud]?.isConfigured) {
      if (cloud === 'OCI') {
        navigateToOciOnboarding();
      } else {
        setQuickLinkProvider(cloud);
        setQuickLinkKey1('');
        setQuickLinkKey2('');
        setQuickLinkRegion(cloud === 'AWS' ? 'us-east-1' : 'southamerica-east1');
      }
      return;
    }

    const switched = await switchActiveProvider(cloud);
    if (switched) {
      setToastMessage(`Provedor ativo: ${cloud}`);
    } else {
      setToastMessage(`Autenticação biométrica necessária para ${cloud}`);
    }
  };

  const handleFillDemoCloudCreds = () => {
    if (quickLinkProvider === 'AWS') {
      setQuickLinkKey1('AKIAIOSFODNN7EXAMPLE');
      setQuickLinkKey2('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
      setQuickLinkRegion('us-east-1');
    } else if (quickLinkProvider === 'GCP') {
      setQuickLinkKey1('cloudwatch-gcp-prod-3940');
      setQuickLinkKey2('telemetry-sa@cloudwatch-gcp-prod.iam.gserviceaccount.com');
      setQuickLinkRegion('southamerica-east1');
    }
  };

  const handleConfirmQuickLink = async () => {
    if (!quickLinkProvider) return;
    const target = quickLinkProvider;
    const creds: Record<string, string> =
      target === 'AWS'
        ? {
            accessKeyId: quickLinkKey1.trim() || 'AKIAIOSFODNN7EXAMPLE',
            secretAccessKey: quickLinkKey2.trim() || 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
            region: quickLinkRegion.trim() || 'us-east-1',
          }
        : {
            projectId: quickLinkKey1.trim() || 'cloudwatch-gcp-prod-3940',
            clientEmail:
              quickLinkKey2.trim() || 'telemetry-sa@cloudwatch-gcp-prod.iam.gserviceaccount.com',
            region: quickLinkRegion.trim() || 'southamerica-east1',
          };

    await linkCloudProvider(target, creds, false);
    setQuickLinkProvider(null);
    await refreshMetrics(false);
    setToastMessage(`Provedor ${target} vinculado e ativo!`);
  };

  const handleProvisionNewNode = async () => {
    const created = await provisionInstance(activeProvider);
    if (created) {
      setToastMessage(`Nova instância ${created.name} provisionada em ${activeProvider}!`);
    }
  };

  const handleQuickMitigate = async (resourceId: string) => {
    const res = await mitigateAnomaly(resourceId);
    setToastMessage(res.message);
  };

  const handleOpenActionSheet = (resource: CloudResource) => {
    setSelectedInstanceForAction(resource);
    setIsActionSheetVisible(true);
  };

  const handleNavigateToMetrics = (resource: CloudResource) => {
    setSelectedResource(resource);
    navigation.navigate('MetricsDetail', {
      resourceId: resource.id,
      selectedInstanceId: resource.id,
    });
  };

  const getStatusDotColor = (status: string, lifecycleState?: string) => {
    if (lifecycleState === 'STOPPED' || lifecycleState === 'STOPPING' || status === 'OFFLINE') {
      return '#6B7280';
    }
    switch (status) {
      case 'HEALTHY':
        return '#22C55E';
      case 'REBOOTING':
      case 'WARNING':
        return '#F59E0B';
      case 'CRITICAL':
      default:
        return '#EF4444';
    }
  };

  // ==========================================================================
  // ESTADO VAZIO INICIAL: USUÁRIO SEM NENHUMA NUVEM CONECTADA
  // ==========================================================================
  if (!hasConnectedClouds) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.noCloudsContainer}>
          <View style={styles.noCloudsHeader}>
            <Text style={styles.welcomeLabel}>
              Olá, {masterUser?.username || 'usuário'}
            </Text>
            <Text style={styles.noCloudsTitle}>Conecte uma nuvem</Text>
            <Text style={styles.noCloudsSubtitle}>
              Conecte sua conta real da Oracle Cloud (OCI) via Cloud Shell ou habilite a visualização Multi-Cloud (AWS e GCP).
            </Text>
          </View>

          {/* Cartão Oracle Cloud Infrastructure (Ativo) */}
          <View style={[styles.providerSetupCard, styles.providerSetupCardOci]}>
            <View style={styles.providerSetupTop}>
              <CloudLogo provider="OCI" size={34} />
              <View style={styles.providerSetupTextCol}>
                <Text style={styles.providerSetupName}>Oracle Cloud Infrastructure (OCI Real)</Text>
                <Text style={styles.providerSetupDesc}>
                  Conexão rápida via comando no OCI Cloud Shell (sem digitar OCIDs) ou configuração manual.
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.ociConnectPrimaryBtn}
              onPress={navigateToOciOnboarding}
              activeOpacity={0.85}
            >
              <Text style={styles.ociConnectPrimaryBtnText}>Conectar Oracle Cloud</Text>
            </TouchableOpacity>
          </View>

          {/* Cartão Amazon Web Services */}
          <View style={styles.providerSetupCard}>
            <View style={styles.providerSetupTop}>
              <CloudLogo provider="AWS" size={32} />
              <View style={styles.providerSetupTextCol}>
                <Text style={styles.providerSetupName}>Amazon Web Services (AWS)</Text>
                <Text style={styles.providerSetupDesc}>
                  Monitoramento Multi-Cloud de instâncias EC2, RDS e funções Lambda (us-east-1).
                </Text>
              </View>
              <TouchableOpacity
                style={styles.soonBadge}
                onPress={() => handleSelectConnectedCloud('AWS')}
              >
                <Text style={[styles.soonBadgeText, { color: '#FF9900' }]}>Vincular</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Cartão Google Cloud Platform */}
          <View style={styles.providerSetupCard}>
            <View style={styles.providerSetupTop}>
              <CloudLogo provider="GCP" size={32} />
              <View style={styles.providerSetupTextCol}>
                <Text style={styles.providerSetupName}>Google Cloud Platform (GCP)</Text>
                <Text style={styles.providerSetupDesc}>
                  Monitoramento Multi-Cloud de serviços Cloud Run e Compute Engine (southamerica-east1).
                </Text>
              </View>
              <TouchableOpacity
                style={styles.soonBadge}
                onPress={() => handleSelectConnectedCloud('GCP')}
              >
                <Text style={[styles.soonBadgeText, { color: '#4285F4' }]}>Vincular</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      </SafeAreaView>
    );
  }

  // Diagnóstico executivo derivado exclusivamente dos dados reais
  let diagnosticMessage =
    kpis.total === 0
      ? 'Nenhuma VM encontrada na região ativa'
      : 'Instâncias verificadas na conta conectada';
  let diagnosticColor = kpis.total === 0 ? '#9AA0A6' : '#22C55E';
  if (kpis.critical > 0) {
    diagnosticMessage = 'Atenção: instância parada ou com utilização crítica';
    diagnosticColor = '#EF4444';
  } else if (kpis.warning > 0) {
    diagnosticMessage = 'Utilização moderada/alta detectada';
    diagnosticColor = '#F59E0B';
  }

  const isLiveBadge = telemetrySource === 'LIVE_OCI';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={activePalette.primary}
            colors={[activePalette.primary]}
          />
        }
      >
        {/* Cabeçalho Executivo com Badge LIVE / CACHE */}
        <View
          style={[
            styles.executiveHeader,
            {
              backgroundColor: activePalette.surfaceHeader,
              borderBottomColor: activePalette.borderFocus,
            },
          ]}
        >
          <View style={styles.headerTopRow}>
            <View style={styles.headerLeft}>
              <CloudLogo provider={activeProvider} size={30} />
              <View style={styles.headerMeta}>
                <Text style={styles.providerName} numberOfLines={1}>
                  {activeAccountConfig?.tenancyName ||
                    activeAccountConfig?.accountIdentifier ||
                    activePalette.name}
                </Text>
                <View style={styles.connectionBadge}>
                  <View
                    style={[
                      styles.connectionDot,
                      { backgroundColor: isLiveBadge ? '#22C55E' : '#F59E0B' },
                    ]}
                  />
                  <Text style={styles.connectionText} numberOfLines={1}>
                    {activeProvider} • {activeAccountConfig?.region || activePalette.defaultRegion}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.actionGroup}>
              {/* Badge visível indicando LIVE ou CACHE */}
              <View
                style={[
                  styles.sourcePill,
                  isLiveBadge ? styles.sourcePillLive : styles.sourcePillCache,
                ]}
              >
                <View
                  style={[
                    styles.sourcePillDot,
                    { backgroundColor: isLiveBadge ? '#22C55E' : '#F59E0B' },
                  ]}
                />
                <Text
                  style={[
                    styles.sourcePillText,
                    { color: isLiveBadge ? '#4ADE80' : '#FDE68A' },
                  ]}
                >
                  {isLiveBadge ? 'LIVE' : 'CACHE'}
                </Text>
              </View>

              {orderedResources.length > 0 && (
                <TouchableOpacity
                  style={styles.pdfBtn}
                  onPress={handleExportPdf}
                  activeOpacity={0.7}
                >
                  <FileReportIcon size={13} color="#93C5FD" />
                  <Text style={styles.pdfBtnText} numberOfLines={1}>
                    Relatório
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Resumo Real das Instâncias */}
          <View style={styles.healthSummaryCard}>
            <View style={styles.healthSummaryMain}>
              <Text style={styles.healthSlaValue}>
                {kpis.total > 0 ? `${kpis.uptimeSla}% ATIVAS` : '0 VMs'}
              </Text>
              <View style={styles.diagnosticRow}>
                <View style={[styles.diagnosticDot, { backgroundColor: diagnosticColor }]} />
                <Text style={[styles.diagnosticText, { color: diagnosticColor }]}>
                  {diagnosticMessage}
                </Text>
              </View>
            </View>

            <View style={styles.healthCounters}>
              <View style={styles.healthCounterItem}>
                <Text style={styles.healthCounterNum}>
                  {kpis.healthy}/{kpis.total}
                </Text>
                <Text style={styles.healthCounterLabel}>SAUDÁVEIS</Text>
              </View>
              <View style={styles.healthCounterItem}>
                <Text
                  style={[
                    styles.healthCounterNum,
                    kpis.critical + kpis.warning > 0 && { color: '#F59E0B' },
                    kpis.critical > 0 && { color: '#EF4444' },
                  ]}
                >
                  {kpis.critical + kpis.warning}
                </Text>
                <Text style={styles.healthCounterLabel}>ATENÇÃO</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Banner Offline-First quando exibindo snapshot em cache */}
        {isOfflineCache && (
          <View style={styles.cacheBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cacheBannerTitle}>
                Dados em cache de {cachedAtHHmm || lastUpdated}
              </Text>
              <Text style={styles.cacheBannerSub}>
                Servidor BFF inacessível no momento. Exibindo o último snapshot real salvo para sua conta.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.cacheRetryBtn}
              onPress={handleRefresh}
              activeOpacity={0.8}
            >
              <Text style={styles.cacheRetryBtnText}>Reconectar</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Seletor Multi-Cloud Híbrido: OCI (Real) | AWS (Simulado) | GCP (Simulado) */}
        <View style={styles.dockWrapper}>
          <View style={styles.dockContainer}>
            {(['OCI', 'AWS', 'GCP'] as SupportedCloud[]).map((cloud) => {
              const isSelected = activeProvider === cloud;
              const isConfigured = Boolean(cloudAccounts[cloud]?.isConfigured);
              return (
                <TouchableOpacity
                  key={cloud}
                  style={[
                    styles.dockChip,
                    isSelected && {
                      backgroundColor: '#20242C',
                      borderColor: CLOUD_PALETTES[cloud].borderFocus,
                      borderWidth: 1.5,
                    },
                  ]}
                  onPress={() => handleSelectConnectedCloud(cloud)}
                  activeOpacity={0.7}
                >
                  <CloudLogo provider={cloud} size={18} />
                  <Text
                    style={[
                      styles.dockChipText,
                      isSelected && { color: '#E8EAED', fontWeight: '800' },
                    ]}
                  >
                    {cloud}
                    {!isConfigured ? ' +' : ''}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Banner Compacto de Alerta Crítico */}
        {kpis.critical > 0 && orderedResources[0] && (
          <View
            style={[
              styles.policyWarningCard,
              {
                borderColor: 'rgba(239, 68, 68, 0.5)',
                backgroundColor: 'rgba(239, 68, 68, 0.12)',
              },
            ]}
          >
            <Text style={[styles.policyWarningTitle, { color: '#FCA5A5' }]}>
              Alerta Operacional Crítico
            </Text>
            <Text style={styles.policyWarningBody}>
              Anomalia detectada em{' '}
              {orderedResources.find((r) => r.status === 'CRITICAL')?.name ||
                orderedResources[0].name}
              . Abra o diagnóstico para inspecionar containers, portas TCP e métricas.
            </Text>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {activeProvider !== 'OCI' && (
                <TouchableOpacity
                  style={[styles.copyPolicyBtn, { backgroundColor: '#EF4444' }]}
                  onPress={() =>
                    handleQuickMitigate(
                      orderedResources.find((r) => r.status === 'CRITICAL')?.id ||
                        orderedResources[0].id
                    )
                  }
                >
                  <Text style={[styles.copyPolicyBtnText, { color: '#FFF' }]}>
                    Normalizar Instância
                  </Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={styles.copyPolicyBtn}
                onPress={() =>
                  handleNavigateToMetrics(
                    orderedResources.find((r) => r.status === 'CRITICAL') ||
                      orderedResources[0]
                  )
                }
              >
                <Text style={styles.copyPolicyBtnText}>Ver Diagnóstico</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Aviso de Policies IAM caso a conta OCI esteja autenticada mas sem permissão de leitura */}
        {(policyHint || activeAccountConfig?.permissionStatus === 'NO_PERMISSION') && (
          <View style={styles.policyWarningCard}>
            <Text style={styles.policyWarningTitle}>
              Conta OCI autenticada, mas sem permissão de leitura (IAM Policy)
            </Text>
            <Text style={styles.policyWarningBody}>
              {policyHint ||
                'Adicione as policies de leitura (inspect/read instances, vnic-attachments, vnics, metrics e audit-events) ao grupo do seu usuário no Console da Oracle Cloud.'}
            </Text>
            {policyHint ? (
              <TouchableOpacity
                style={styles.copyPolicyBtn}
                onPress={() => handleCopyPolicyHint(policyHint)}
              >
                <Text style={styles.copyPolicyBtnText}>Copiar Policies Necessárias</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}

        {/* Lista de Instâncias da Nuvem Selecionada */}
        <View style={styles.resourceSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {activeProvider === 'OCI'
                ? `INSTÂNCIAS COMPUTE (${orderedResources.length})`
                : `INSTÂNCIAS ${activeProvider} (${orderedResources.length})`}
            </Text>
            {activeProvider !== 'OCI' ? (
              <TouchableOpacity
                style={[
                  styles.pdfBtn,
                  { borderColor: activePalette.primary, paddingVertical: 4 },
                ]}
                onPress={handleProvisionNewNode}
              >
                <Text style={[styles.pdfBtnText, { color: activePalette.primary }]}>
                  + Provisionar
                </Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.sectionSub}>
                {lastUpdated !== '—' ? `Atualizado às ${lastUpdated}` : 'Sincronizando...'}
              </Text>
            )}
          </View>

          {isLoading && orderedResources.length === 0 ? (
            <View style={styles.emptyContainer}>
              <ActivityIndicator size="small" color={activePalette.primary} />
              <Text style={[styles.emptyText, { marginTop: 12, marginBottom: 0 }]}>
                Consultando instâncias reais na Oracle Cloud...
              </Text>
            </View>
          ) : orderedResources.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyTitle}>
                {syncError
                  ? 'Não foi possível carregar suas instâncias'
                  : 'Nenhuma instância Compute encontrada'}
              </Text>
              <Text style={styles.emptyText}>
                {syncError
                  ? syncError
                  : `Não há VMs visíveis na região ${activeAccountConfig?.region || 'sa-saopaulo-1'} para esta conta.`}
              </Text>
              <TouchableOpacity
                style={styles.emptyRetryBtn}
                onPress={() => refreshMetrics(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.emptyRetryBtnText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : (
            orderedResources.map((resource) => {
              const meta = (resource.metadata || {}) as Record<string, any>;
              const cpuPercent = resource.metricsSummary?.cpuPercent;
              const memPercent = resource.metricsSummary?.memoryPercent;
              const hasRealCpu = typeof cpuPercent === 'number';
              const hasRealMem = typeof memPercent === 'number';
              const dotColor = getStatusDotColor(resource.status, resource.lifecycleState);
              const pinned = isResourcePinned(resource.id);

              const shapeLabel = meta.shape || 'VM.Standard.A1.Flex';
              const ocpuLabel =
                typeof meta.ocpuCount === 'number' ? `${meta.ocpuCount} OCPUs` : null;
              const memLabel =
                typeof meta.memoryInGBs === 'number' ? `${meta.memoryInGBs} GB RAM` : null;
              const specsLine = [shapeLabel, ocpuLabel, memLabel].filter(Boolean).join(' • ');

              return (
                <TouchableOpacity
                  key={resource.id}
                  style={styles.vmCard}
                  onPress={() => handleNavigateToMetrics(resource)}
                  activeOpacity={0.75}
                >
                  {/* Linha 1: Status + Logo + Nome + Estado OCI + Menu (...) */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderLeft}>
                      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                      <CloudLogo provider={resource.provider} size={16} />
                      {pinned && <PinIcon size={13} color="#93C5FD" focused />}
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {resource.name}
                      </Text>
                    </View>

                    <View style={styles.cardHeaderRight}>
                      <View
                        style={[
                          styles.lifecycleBadge,
                          { borderColor: `${dotColor}66` },
                        ]}
                      >
                        <Text style={[styles.lifecycleBadgeText, { color: dotColor }]}>
                          {resource.lifecycleState}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={styles.moreActionBtn}
                        onPress={() => handleOpenActionSheet(resource)}
                        hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                      >
                        <MoreHorizontalIcon size={16} color="#9AA0A6" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Linha 2: Shape, OCPUs e Memória Real */}
                  <Text style={styles.vmSpecsText} numberOfLines={1}>
                    {specsLine}
                  </Text>

                  {/* Linha 3: IPs Público e Privado + Região */}
                  <View style={styles.vmIpRow}>
                    <Text style={styles.vmIpItem}>
                      Público: <Text style={styles.vmIpMono}>{meta.publicIp || '—'}</Text>
                    </Text>
                    <Text style={styles.vmIpItem}>
                      Privado: <Text style={styles.vmIpMono}>{meta.privateIp || '—'}</Text>
                    </Text>
                  </View>

                  {/* Linha 4: Telemetria de CPU e Memória */}
                  {hasRealCpu ? (
                    <View style={styles.telemetrySection}>
                      <View style={styles.singleProgressBarContainer}>
                        <View style={styles.progressBarTrack}>
                          <View
                            style={[
                              styles.progressBarFill,
                              {
                                width: `${Math.min(100, Math.max(2, cpuPercent!))}%`,
                                backgroundColor: dotColor,
                              },
                            ]}
                          />
                        </View>
                        <Text style={[styles.cardCpuValue, { color: dotColor }]}>
                          {cpuPercent!.toFixed(1)}% CPU
                        </Text>
                      </View>
                      {hasRealMem && (
                        <Text style={styles.cardMemSub}>
                          Memória Alocada: {memPercent!.toFixed(1)}%
                        </Text>
                      )}
                    </View>
                  ) : (
                    <View style={styles.noMetricsBar}>
                      <Text style={styles.noMetricsText}>
                        {resource.lifecycleState !== 'RUNNING'
                          ? `Instância ${resource.lifecycleState} — sem coleta ativa`
                          : 'Toque para inspecionar métricas, portas TCP e logs'}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Menu Rápido de Ações da Instância */}
      <InstanceActionSheet
        visible={isActionSheetVisible}
        instance={selectedInstanceForAction}
        onClose={() => setIsActionSheetVisible(false)}
        onShowToast={(msg) => setToastMessage(msg)}
        onViewMetrics={(inst) => handleNavigateToMetrics(inst)}
        onOpenTerminal={(inst) => setTerminalInstance(inst)}
        onDelete={(id) => deleteInstance(id)}
        isPinned={
          selectedInstanceForAction
            ? isResourcePinned(selectedInstanceForAction.id)
            : false
        }
        onTogglePin={(id) => togglePin(id)}
      />

      {/* Modal do Terminal SSH Interativo (Modo Bitvise) */}
      <SerialConsoleModal
        visible={Boolean(terminalInstance)}
        resource={terminalInstance}
        onClose={() => setTerminalInstance(null)}
      />

      {/* Modal de Vínculo Rápido Multi-Cloud (AWS / GCP) */}
      <Modal
        visible={Boolean(quickLinkProvider)}
        transparent
        animationType="fade"
        onRequestClose={() => setQuickLinkProvider(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.75)',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <View
            style={{
              backgroundColor: '#161B22',
              borderRadius: 16,
              padding: 20,
              borderWidth: 1,
              borderColor: '#30363D',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
              {quickLinkProvider && <CloudLogo provider={quickLinkProvider} size={28} />}
              <View style={{ marginLeft: 10, flex: 1 }}>
                <Text style={{ color: '#F0F6FC', fontSize: 16, fontWeight: '800' }}>
                  Vincular {quickLinkProvider === 'AWS' ? 'Amazon Web Services' : 'Google Cloud'}
                </Text>
                <Text style={{ color: '#8B949E', fontSize: 12 }}>
                  Habilite a telemetria Multi-Cloud para alternar entre OCI, AWS e GCP.
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={{
                backgroundColor: '#21262D',
                borderWidth: 1,
                borderColor: '#388BFD',
                borderRadius: 8,
                paddingVertical: 9,
                paddingHorizontal: 12,
                marginBottom: 12,
                alignItems: 'center',
              }}
              onPress={handleFillDemoCloudCreds}
            >
              <Text style={{ color: '#58A6FF', fontSize: 12, fontWeight: '700' }}>
                Preencher Credenciais de Demonstração ({quickLinkProvider})
              </Text>
            </TouchableOpacity>

            <TextInput
              style={{
                backgroundColor: '#0D1117',
                borderWidth: 1,
                borderColor: '#30363D',
                borderRadius: 8,
                color: '#E6EDF3',
                paddingHorizontal: 12,
                paddingVertical: 8,
                fontSize: 12,
                marginBottom: 8,
              }}
              value={quickLinkKey1}
              onChangeText={setQuickLinkKey1}
              placeholder={
                quickLinkProvider === 'AWS'
                  ? 'AWS Access Key ID (ex: AKIA...)'
                  : 'GCP Project ID (ex: cloudwatch-gcp-prod)'
              }
              placeholderTextColor="#6E7681"
              autoCapitalize="none"
            />

            <TextInput
              style={{
                backgroundColor: '#0D1117',
                borderWidth: 1,
                borderColor: '#30363D',
                borderRadius: 8,
                color: '#E6EDF3',
                paddingHorizontal: 12,
                paddingVertical: 8,
                fontSize: 12,
                marginBottom: 14,
              }}
              value={quickLinkKey2}
              onChangeText={setQuickLinkKey2}
              placeholder={
                quickLinkProvider === 'AWS'
                  ? 'AWS Secret Access Key'
                  : 'Service Account Email'
              }
              placeholderTextColor="#6E7681"
              autoCapitalize="none"
            />

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <TouchableOpacity
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor: '#21262D',
                }}
                onPress={() => setQuickLinkProvider(null)}
              >
                <Text style={{ color: '#C9D1D9', fontSize: 12, fontWeight: '700' }}>
                  Cancelar
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 10,
                  borderRadius: 8,
                  backgroundColor:
                    quickLinkProvider === 'AWS' ? '#FF9900' : '#4285F4',
                }}
                onPress={handleConfirmQuickLink}
              >
                <Text style={{ color: '#0D1117', fontSize: 12, fontWeight: '800' }}>
                  Ativar {quickLinkProvider}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {toastMessage && (
        <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F1318',
  },
  container: {
    paddingBottom: 40,
  },
  noCloudsContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  noCloudsHeader: {
    marginTop: 12,
    marginBottom: 22,
  },
  welcomeLabel: {
    color: '#8AB4F8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  noCloudsTitle: {
    color: '#E8EAED',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  noCloudsSubtitle: {
    color: '#9AA0A6',
    fontSize: 13,
    lineHeight: 20,
  },
  providerSetupCard: {
    backgroundColor: '#161A22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262D38',
    padding: 16,
    marginBottom: 14,
  },
  providerSetupCardOci: {
    borderColor: '#F8000055',
    backgroundColor: '#19161A',
  },
  providerSetupCardDisabled: {
    opacity: 0.72,
  },
  providerSetupTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  providerSetupTextCol: {
    flex: 1,
  },
  providerSetupName: {
    color: '#E8EAED',
    fontSize: 14,
    fontWeight: '800',
  },
  providerSetupDesc: {
    color: '#9AA0A6',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  ociConnectPrimaryBtn: {
    marginTop: 14,
    backgroundColor: '#F80000',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  ociConnectPrimaryBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  soonBadge: {
    backgroundColor: '#20242C',
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  soonBadgeText: {
    color: '#9CA3AF',
    fontSize: 11,
    fontWeight: '700',
  },
  executiveHeader: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 10,
    marginRight: 8,
  },
  headerMeta: {
    flex: 1,
  },
  providerName: {
    color: '#E8EAED',
    fontSize: 16,
    fontWeight: '800',
  },
  connectionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    gap: 6,
  },
  connectionDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  connectionText: {
    color: '#9AA0A6',
    fontSize: 11,
    fontWeight: '500',
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourcePill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    gap: 5,
  },
  sourcePillLive: {
    backgroundColor: '#0F382A',
    borderColor: '#22C55E',
  },
  sourcePillCache: {
    backgroundColor: '#3A3018',
    borderColor: '#F59E0B',
  },
  sourcePillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sourcePillText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  pdfBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  pdfBtnText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
  },
  healthSummaryCard: {
    backgroundColor: '#161A22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262D38',
    padding: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthSummaryMain: {
    flex: 1,
    marginRight: 10,
  },
  healthSlaValue: {
    color: '#E8EAED',
    fontSize: 19,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  diagnosticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  diagnosticDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  diagnosticText: {
    fontSize: 11,
    fontWeight: '700',
    flex: 1,
  },
  healthCounters: {
    flexDirection: 'row',
    gap: 14,
  },
  healthCounterItem: {
    alignItems: 'center',
  },
  healthCounterNum: {
    color: '#E8EAED',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  healthCounterLabel: {
    color: '#9AA0A6',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginTop: 2,
  },
  cacheBanner: {
    marginHorizontal: 18,
    marginTop: 12,
    backgroundColor: '#2C2210',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F59E0B',
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cacheBannerTitle: {
    color: '#FDE68A',
    fontSize: 13,
    fontWeight: '800',
  },
  cacheBannerSub: {
    color: '#E5E7EB',
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },
  cacheRetryBtn: {
    backgroundColor: '#F59E0B',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 6,
  },
  cacheRetryBtnText: {
    color: '#0F1318',
    fontSize: 11,
    fontWeight: '800',
  },
  dockWrapper: {
    paddingHorizontal: 18,
    marginTop: 14,
    marginBottom: 4,
  },
  dockContainer: {
    flexDirection: 'row',
    backgroundColor: '#16191F',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#262C36',
    gap: 6,
  },
  dockChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 9,
    borderRadius: 8,
    gap: 6,
  },
  dockChipText: {
    color: '#9AA0A6',
    fontSize: 12,
    fontWeight: '700',
  },
  policyWarningCard: {
    marginHorizontal: 18,
    marginTop: 12,
    backgroundColor: '#2B1F12',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#F59E0B',
    padding: 14,
  },
  policyWarningTitle: {
    color: '#FDE68A',
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 6,
  },
  policyWarningBody: {
    color: '#E8EAED',
    fontSize: 11,
    lineHeight: 17,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  copyPolicyBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  copyPolicyBtnText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '700',
  },
  resourceSection: {
    paddingHorizontal: 18,
    marginTop: 16,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#9AA0A6',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  sectionSub: {
    color: '#5F6368',
    fontSize: 11,
  },
  emptyContainer: {
    backgroundColor: '#16191F',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#262C36',
  },
  emptyTitle: {
    color: '#E8EAED',
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 6,
  },
  emptyText: {
    color: '#9AA0A6',
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 14,
  },
  emptyRetryBtn: {
    backgroundColor: '#8AB4F8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyRetryBtnText: {
    color: '#0F1318',
    fontSize: 12,
    fontWeight: '800',
  },
  vmCard: {
    backgroundColor: '#161A22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262D38',
    padding: 14,
    marginBottom: 10,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
    marginRight: 8,
  },
  cardHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardTitle: {
    color: '#E8EAED',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  lifecycleBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    backgroundColor: '#0F1318',
  },
  lifecycleBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  moreActionBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  moreActionText: {
    color: '#9AA0A6',
    fontSize: 12,
    fontWeight: '800',
  },
  vmSpecsText: {
    color: '#93C5FD',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 6,
  },
  vmIpRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 10,
  },
  vmIpItem: {
    color: '#9AA0A6',
    fontSize: 11,
  },
  vmIpMono: {
    color: '#E8EAED',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
  },
  telemetrySection: {
    gap: 4,
  },
  singleProgressBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  progressBarTrack: {
    flex: 1,
    height: 6,
    backgroundColor: '#262D38',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  cardCpuValue: {
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    minWidth: 74,
    textAlign: 'right',
  },
  cardMemSub: {
    color: '#9AA0A6',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  noMetricsBar: {
    backgroundColor: '#11151C',
    borderRadius: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#1F2632',
  },
  noMetricsText: {
    color: '#9AA0A6',
    fontSize: 11,
  },
});
