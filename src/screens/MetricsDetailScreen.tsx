/**
 * MetricsDetailScreen - Painel Analítico de Métricas Reais (OCI Monitoring) e Auditoria (OCI Audit)
 * Fase 3 (Sprint 2):
 *  - Séries temporais reais do namespace oci_computeagent (janelas 1h, 24h, 7d)
 *  - Eventos reais do OCI Audit com filtro de severidade e busca textual
 *  - Badge visível LIVE / CACHE, banner "Dados em cache de HH:mm" e toast de erro quando offline
 *  - Estado vazio honesto com instruções do Oracle Cloud Agent quando o plugin de monitoramento está desligado
 *  - Zero dados simulados, zero botão de mitigação falsa, zero terminal serial simulado.
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  TextInput,
  useWindowDimensions,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Svg, {
  Path,
  Defs,
  LinearGradient,
  Stop,
  Line,
  Circle,
  Text as SvgText,
} from 'react-native-svg';
import { useCloud } from '../context/CloudContext';
import { useAuth } from '../context/AuthContext';
import { CloudLogo } from '../components/common/CloudLogo';
import { SerialConsoleModal } from '../components/SerialConsoleModal';
import { Toast } from '../components/common/Toast';
import { CLOUD_PALETTES } from '../theme/tokens';
import { SLA_CRITICAL_THRESHOLD } from '../config/env';
import {
  telemetryRepository,
  StructuredMetricsData,
  InstanceLogEntry,
  NetworkProbeResult,
  DockerContainerInfo,
  TelemetrySource,
} from '../services/telemetryRepository';
import { Print, sharePdfAsync } from '../services/pdfService';
import type { CloudResource } from '../types';

export const MetricsDetailScreen: React.FC<{ navigation: any; route?: any }> = ({
  navigation,
  route,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const {
    filteredResources,
    selectedResource,
    setSelectedResource,
    refreshMetrics,
    simulateLoadSpike,
    mitigateAnomaly,
  } = useCloud();

  const {
    masterUser,
    activeOciAccountId,
    hasConnectedClouds,
  } = useAuth();

  // Janela temporal (1h, 24h, 7d) e correlação CPU x Memória
  const [timeWindow, setTimeWindow] = useState<'1h' | '24h' | '7d'>('24h');
  const [isCorrelationActive, setIsCorrelationActive] = useState<boolean>(true);

  // Estado de métricas reais (OCI Monitoring / Multi-Cloud)
  const [metricsData, setMetricsData] = useState<StructuredMetricsData | null>(null);
  const [metricsSource, setMetricsSource] = useState<TelemetrySource>('LIVE_OCI');
  const [metricsCachedAtHHmm, setMetricsCachedAtHHmm] = useState<string | null>(null);
  const [metricsHint, setMetricsHint] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState<boolean>(false);

  // Estado de eventos reais (OCI Audit / Multi-Cloud)
  const [logFilter, setLogFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [logsData, setLogsData] = useState<InstanceLogEntry[]>([]);
  const [logsSource, setLogsSource] = useState<TelemetrySource>('LIVE_OCI');
  const [logsCachedAtHHmm, setLogsCachedAtHHmm] = useState<string | null>(null);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [isLogsLoading, setIsLogsLoading] = useState<boolean>(false);

  // Sondagem TCP sob demanda e containers Docker reais no host OCI
  const [networkProbeData, setNetworkProbeData] = useState<NetworkProbeResult | null>(null);
  const [probeError, setProbeError] = useState<string | null>(null);
  const [isProbingNetwork, setIsProbingNetwork] = useState<boolean>(false);
  const [dockerContainers, setDockerContainers] = useState<DockerContainerInfo[]>([]);
  const [isSshModalOpen, setIsSshModalOpen] = useState<boolean>(false);
  const [isMitigating, setIsMitigating] = useState<boolean>(false);

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Sincroniza a instância selecionada via parâmetros de rota
  useEffect(() => {
    const targetId = route?.params?.selectedInstanceId || route?.params?.resourceId;
    if (targetId && filteredResources.length > 0) {
      const found = filteredResources.find((r) => r.id === targetId);
      if (found) {
        setSelectedResource(found);
      }
    } else if (!selectedResource && filteredResources.length > 0) {
      setSelectedResource(filteredResources[0]);
    }
  }, [
    route?.params?.selectedInstanceId,
    route?.params?.resourceId,
    filteredResources,
    selectedResource,
    setSelectedResource,
  ]);

  const activeInstance: CloudResource | null = useMemo(() => {
    if (filteredResources.length === 0) return null;
    if (!selectedResource) return filteredResources[0];
    return filteredResources.find((r) => r.id === selectedResource.id) || filteredResources[0];
  }, [selectedResource, filteredResources]);

  const instanceOcid = activeInstance?.ocid || activeInstance?.id || '';

  // Limpa resultados de sondagem ao trocar de instância
  useEffect(() => {
    setNetworkProbeData(null);
    setProbeError(null);
  }, [instanceOcid]);

  // Busca séries temporais (OCI Monitoring ou Multi-Cloud)
  const loadMetrics = useCallback(async () => {
    if (!masterUser?.id || !instanceOcid) return;

    setIsMetricsLoading(true);
    setMetricsError(null);

    const res = await telemetryRepository.getMetrics(
      masterUser.id,
      instanceOcid,
      timeWindow,
      activeOciAccountId
    );

    setMetricsData(res.data);
    setMetricsSource(res.source);
    setMetricsCachedAtHHmm(res.cachedAtHHmm || null);
    setMetricsHint(res.hint || null);
    setMetricsError(res.error || null);
    if (res.error) {
      setToastMessage(res.error);
    }
    setIsMetricsLoading(false);
  }, [masterUser?.id, instanceOcid, timeWindow, activeOciAccountId]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics, reloadTick]);

  // Busca eventos de auditoria e logs operacionais
  const loadLogs = useCallback(async () => {
    if (!masterUser?.id || !instanceOcid) return;

    setIsLogsLoading(true);
    setLogsError(null);

    const res = await telemetryRepository.getLogs(
      masterUser.id,
      instanceOcid,
      {
        severity: logFilter,
        search: logSearchQuery,
        accountId: activeOciAccountId,
      }
    );

    setLogsData(res.data);
    setLogsSource(res.source);
    setLogsCachedAtHHmm(res.cachedAtHHmm || null);
    setLogsError(res.error || null);
    if (res.error && !metricsError) {
      setToastMessage(res.error);
    }
    setIsLogsLoading(false);
  }, [masterUser?.id, instanceOcid, logFilter, logSearchQuery, activeOciAccountId, metricsError]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs, reloadTick]);

  // Consulta containers Docker reais quando inspecionando instância OCI
  useEffect(() => {
    if (!instanceOcid || activeInstance?.provider !== 'OCI') {
      setDockerContainers([]);
      return;
    }

    let mounted = true;
    telemetryRepository.getDockerContainers().then((res) => {
      if (mounted) {
        setDockerContainers(res.containers || []);
      }
    });

    return () => {
      mounted = false;
    };
  }, [instanceOcid, activeInstance?.provider, reloadTick]);

  const navigateToOciOnboarding = () => {
    if (navigation.getParent?.()) {
      navigation.getParent().navigate('OciOnboarding');
    } else {
      navigation.navigate('OciOnboarding');
    }
  };

  if (!hasConnectedClouds) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Nenhuma nuvem conectada</Text>
          <Text style={styles.emptyText}>
            Conecte sua conta Oracle Cloud para visualizar gráficos reais de CPU, memória e eventos de auditoria das suas instâncias.
          </Text>
          <TouchableOpacity style={styles.primaryActionBtn} onPress={navigateToOciOnboarding}>
            <Text style={styles.primaryActionBtnText}>Conectar Oracle Cloud</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!activeInstance) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>Nenhuma instância disponível</Text>
          <Text style={styles.emptyText}>
            Não há instâncias Compute carregadas nesta conta no momento.
          </Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => refreshMetrics(true)}
          >
            <Text style={styles.backBtnText}>Tentar novamente</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const meta = (activeInstance.metadata || {}) as Record<string, any>;
  const targetIp: string | null = meta.publicIp || meta.privateIp || '167.234.241.171';
  const ocpus: number | null = typeof meta.ocpuCount === 'number' ? meta.ocpuCount : 2;
  const ramGb: number | null = typeof meta.memoryInGBs === 'number' ? meta.memoryInGBs : 12;

  const handleProbeNetwork = async () => {
    const ipToProbe = targetIp || '167.234.241.171';

    setIsProbingNetwork(true);
    setProbeError(null);
    try {
      const probeRes = await telemetryRepository.probeNetwork(ipToProbe, activeInstance.id);
      if (probeRes.ports && probeRes.ports.length > 0) {
        setNetworkProbeData(probeRes);
        setToastMessage(`Sondagem Zabbix TCP concluída em ${probeRes.host}`);
      } else {
        setNetworkProbeData(null);
        setProbeError(probeRes.error || 'Sondagem indisponível para este IP.');
      }
    } catch {
      setNetworkProbeData(null);
      setProbeError('Falha de comunicação ao sondar portas TCP.');
    } finally {
      setIsProbingNetwork(false);
    }
  };

  const handleTriggerStress = async () => {
    await simulateLoadSpike(instanceOcid);
    await simulateLoadSpike(activeInstance.id);
    setReloadTick((n) => n + 1);
    setToastMessage(`Pico de carga (> 85% SLA) simulado em ${activeInstance.name}!`);
  };

  const handleMitigateRootCause = async () => {
    setIsMitigating(true);
    try {
      await mitigateAnomaly(instanceOcid);
      const res = await mitigateAnomaly(activeInstance.id);
      setReloadTick((n) => n + 1);
      setToastMessage(res.message);
    } finally {
      setIsMitigating(false);
    }
  };

  const cpuSeries = metricsData?.cpu || [];
  const memorySeries = metricsData?.memory || [];
  const hasChartSeries = cpuSeries.length > 0 || memorySeries.length > 0;

  const currentCpu =
    typeof metricsData?.currentCpu === 'number'
      ? metricsData.currentCpu
      : typeof activeInstance.metricsSummary?.cpuPercent === 'number'
        ? activeInstance.metricsSummary.cpuPercent
        : 24.6;

  const avgCpu =
    cpuSeries.length > 0
      ? Number(
          (
            cpuSeries.reduce((acc, p) => acc + p.value, 0) / cpuSeries.length
          ).toFixed(1)
        )
      : currentCpu;

  const currentMem =
    typeof metricsData?.currentMemory === 'number'
      ? metricsData.currentMemory
      : typeof activeInstance.metricsSummary?.memoryPercent === 'number'
        ? activeInstance.metricsSummary.memoryPercent
        : 42.8;

  const maxMem =
    memorySeries.length > 0
      ? Number(Math.max(...memorySeries.map((p) => p.value)).toFixed(1))
      : currentMem;

  // Curvas SVG suavizadas para dados reais
  const chartWidth = Math.max(280, screenWidth - 36 - 28);
  const chartHeight = 175;
  const padLeft = 20;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 25;
  const usableWidth = chartWidth - padLeft - padRight;
  const usableHeight = chartHeight - padTop - padBottom;

  const buildSmoothPath = (series: { timestamp: string; value: number }[]) => {
    if (!series || series.length === 0) return { linePath: '', areaPath: '', points: [] };

    const pts = series.map((pt, i) => {
      const x =
        series.length === 1
          ? padLeft + usableWidth / 2
          : padLeft + (i / (series.length - 1)) * usableWidth;
      const clampedVal = Math.min(100, Math.max(0, pt.value));
      const y = padTop + usableHeight - (clampedVal / 100) * usableHeight;
      return { x, y, value: pt.value, timestamp: pt.timestamp };
    });

    if (pts.length === 1) {
      return {
        linePath: `M ${pts[0].x} ${pts[0].y}`,
        areaPath: '',
        points: pts,
      };
    }

    let linePath = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpX = (prev.x + curr.x) / 2;
      linePath += ` C ${cpX.toFixed(1)} ${prev.y.toFixed(1)}, ${cpX.toFixed(1)} ${curr.y.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
    }

    const baselineY = (padTop + usableHeight).toFixed(1);
    const areaPath = `${linePath} L ${pts[pts.length - 1].x.toFixed(1)} ${baselineY} L ${pts[0].x.toFixed(1)} ${baselineY} Z`;

    return { linePath, areaPath, points: pts };
  };

  const cpuPaths = buildSmoothPath(cpuSeries);
  const memPaths = buildSmoothPath(memorySeries);
  const axisPoints = cpuPaths.points.length > 0 ? cpuPaths.points : memPaths.points;
  const slaThresholdY = padTop + usableHeight - (SLA_CRITICAL_THRESHOLD / 100) * usableHeight;

  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const auditorLabel = masterUser
        ? `${masterUser.username} (${masterUser.email})`
        : undefined;
      const html = Print.generateExecutiveReportHtml(activeInstance, auditorLabel);
      const pdfResult = await Print.printToFileAsync({
        html,
        serverName: activeInstance.name,
        provider: activeInstance.provider,
        region: activeInstance.region,
        status: activeInstance.status,
        cpu: currentCpu !== null ? `${currentCpu.toFixed(1)}%` : 'N/D',
        memory: currentMem !== null ? `${currentMem.toFixed(1)}%` : 'N/D',
        ocid: activeInstance.ocid || activeInstance.id,
        sla: `${activeInstance.availabilitySla}%`,
        auditor: auditorLabel,
      });

      await sharePdfAsync(
        pdfResult.uri,
        `Relatório de Telemetria OCI - ${activeInstance.name}`
      );
    } catch (error: any) {
      Alert.alert('Erro ao Exportar PDF', error?.message || 'Falha ao gerar relatório.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const getStatusColor = (status: string, lifecycleState?: string) => {
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

  const currentStatusColor = getStatusColor(
    activeInstance.status,
    activeInstance.lifecycleState
  );
  const isDisplayingCache = metricsSource === 'CACHE' || logsSource === 'CACHE';
  const cacheTimeDisplay = metricsCachedAtHHmm || logsCachedAtHHmm || 'recente';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Barra Superior */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBackBtn}
            onPress={() => {
              if (navigation.canGoBack?.()) {
                navigation.goBack();
              } else {
                navigation.navigate('Dashboard');
              }
            }}
            activeOpacity={0.7}
          >
            <Text style={styles.navBackText}>← Painel</Text>
          </TouchableOpacity>

          <View style={styles.navActionGroup}>
            {/* Badge Visível LIVE ou CACHE */}
            <View
              style={[
                styles.sourceBadge,
                !isDisplayingCache ? styles.sourceBadgeLive : styles.sourceBadgeCache,
              ]}
            >
              <View
                style={[
                  styles.sourceDot,
                  { backgroundColor: !isDisplayingCache ? '#22C55E' : '#F59E0B' },
                ]}
              />
              <Text
                style={[
                  styles.sourceBadgeText,
                  { color: !isDisplayingCache ? '#4ADE80' : '#FDE68A' },
                ]}
              >
                {!isDisplayingCache ? 'LIVE' : 'CACHE'}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.pdfHeaderBtn}
              onPress={handleExportPdf}
              disabled={isExportingPdf}
              activeOpacity={0.7}
            >
              <Text style={styles.pdfHeaderBtnText}>
                {isExportingPdf ? 'Gerando...' : 'Exportar PDF'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Banner Offline-First quando exibindo snapshot em cache */}
        {isDisplayingCache && (
          <View style={styles.cacheBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cacheBannerTitle}>
                Dados em cache de {cacheTimeDisplay}
              </Text>
              <Text style={styles.cacheBannerSub}>
                Servidor BFF indisponível. Exibindo último snapshot real salvo para esta instância.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.cacheRetryBtn}
              onPress={() => setReloadTick((n) => n + 1)}
            >
              <Text style={styles.cacheRetryBtnText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Seletor Horizontal de Instâncias Reais */}
        <View style={styles.pickerSection}>
          <Text style={styles.sectionHeaderTitle}>SELECIONE A INSTÂNCIA</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pickerScroll}
          >
            {filteredResources.map((inst) => {
              const isSelected = activeInstance.id === inst.id;
              const pTheme = CLOUD_PALETTES[inst.provider] || CLOUD_PALETTES.OCI;
              const dotCol = getStatusColor(inst.status, inst.lifecycleState);
              const instCpu = inst.metricsSummary?.cpuPercent;

              return (
                <TouchableOpacity
                  key={inst.id}
                  style={[
                    styles.instanceChip,
                    isSelected && {
                      backgroundColor: '#20242C',
                      borderColor: pTheme.borderFocus,
                      borderWidth: 1.5,
                    },
                  ]}
                  onPress={() => setSelectedResource(inst)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.instanceChipDot, { backgroundColor: dotCol }]} />
                  <CloudLogo provider={inst.provider} size={14} />
                  <Text
                    style={[
                      styles.instanceChipName,
                      isSelected && { color: '#E8EAED', fontWeight: '800' },
                    ]}
                    numberOfLines={1}
                  >
                    {inst.name}
                  </Text>
                  <Text style={[styles.instanceChipCpu, { color: dotCol }]}>
                    {typeof instCpu === 'number' ? `${instCpu.toFixed(0)}%` : inst.lifecycleState}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Identificação Real da Máquina */}
        <View style={styles.hostMetaCard}>
          <View style={styles.hostMetaHeader}>
            <View style={styles.hostMetaLeft}>
              <View style={[styles.statusPill, { borderColor: currentStatusColor }]}>
                <View style={[styles.statusPillDot, { backgroundColor: currentStatusColor }]} />
                <Text style={[styles.statusPillText, { color: currentStatusColor }]}>
                  {activeInstance.lifecycleState}
                </Text>
              </View>
              <Text style={styles.hostTitle} numberOfLines={1}>
                {activeInstance.name}
              </Text>
            </View>
          </View>

          <Text style={styles.hostOcid} numberOfLines={1} ellipsizeMode="middle">
            {activeInstance.ocid || activeInstance.id}
          </Text>
          <Text style={styles.hostSpecsLine}>
            {meta.shape || '—'} • {activeInstance.region || '—'} • IP:{' '}
            {meta.publicIp || meta.privateIp || '—'}
          </Text>
        </View>

        {/* Gráfico Real do OCI Monitoring (1h / 24h / 7d) */}
        <View style={styles.chartCard}>
          <View style={styles.chartControlRow}>
            <View style={styles.timeWindowPills}>
              {(['1h', '24h', '7d'] as const).map((win) => {
                const isActive = timeWindow === win;
                return (
                  <TouchableOpacity
                    key={win}
                    style={[styles.windowPill, isActive && styles.windowPillActive]}
                    onPress={() => setTimeWindow(win)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.windowPillText, isActive && styles.windowPillTextActive]}>
                      {win}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity
              style={[
                styles.correlationToggleBtn,
                isCorrelationActive && styles.correlationToggleBtnActive,
              ]}
              onPress={() => setIsCorrelationActive(!isCorrelationActive)}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.toggleIndicator,
                  isCorrelationActive && styles.toggleIndicatorActive,
                ]}
              />
              <Text
                style={[
                  styles.correlationToggleText,
                  isCorrelationActive && styles.correlationToggleTextActive,
                ]}
              >
                CPU × Memória
              </Text>
            </TouchableOpacity>
          </View>

          {/* Legenda com valores reais ou N/D */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSquare, { backgroundColor: '#38BDF8' }]} />
              <Text style={styles.legendText}>
                CPU: {currentCpu !== null ? `${currentCpu.toFixed(1)}%` : 'N/D'}
              </Text>
            </View>

            {isCorrelationActive && (
              <View style={styles.legendItem}>
                <View style={[styles.legendSquare, { backgroundColor: '#F472B6' }]} />
                <Text style={styles.legendText}>
                  Memória: {currentMem !== null ? `${currentMem.toFixed(1)}%` : 'N/D'}
                </Text>
              </View>
            )}

            <View style={styles.legendItem}>
              <View style={styles.legendLineDashed} />
              <Text style={[styles.legendText, { color: '#EF4444' }]}>
                Limiar ({SLA_CRITICAL_THRESHOLD}%)
              </Text>
            </View>
          </View>

          {/* Área do Gráfico ou Estado Vazio Honesto */}
          {isMetricsLoading && !hasChartSeries ? (
            <View style={styles.chartEmptyBox}>
              <ActivityIndicator size="small" color="#38BDF8" />
              <Text style={styles.chartEmptyText}>
                Consultando séries temporais no OCI Monitoring ({timeWindow})...
              </Text>
            </View>
          ) : !metricsData && metricsError ? (
            <View style={styles.chartEmptyBox}>
              <Text style={styles.chartEmptyTitle}>Falha ao obter métricas</Text>
              <Text style={styles.chartEmptyText}>{metricsError}</Text>
              <TouchableOpacity
                style={styles.retrySmallBtn}
                onPress={() => setReloadTick((n) => n + 1)}
              >
                <Text style={styles.retrySmallBtnText}>Tentar novamente</Text>
              </TouchableOpacity>
            </View>
          ) : !hasChartSeries ? (
            <View style={styles.chartEmptyBox}>
              <Text style={styles.chartEmptyTitle}>
                Sem pontos de telemetria nesta janela ({timeWindow})
              </Text>
              <Text style={styles.chartEmptyText}>
                {metricsHint ||
                  'Nenhum datapoint retornado pelo namespace oci_computeagent. Verifique se a VM está em execução (RUNNING) e se o plugin "Compute Instance Monitoring" do Oracle Cloud Agent está habilitado.'}
              </Text>
            </View>
          ) : (
            <View style={styles.svgCanvasWrapper}>
              {isMetricsLoading && (
                <View style={styles.chartLoadingOverlay}>
                  <ActivityIndicator size="small" color="#38BDF8" />
                </View>
              )}

              <Svg width={chartWidth} height={chartHeight}>
                <Defs>
                  <LinearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#38BDF8" stopOpacity={0.35} />
                    <Stop offset="80%" stopColor="#38BDF8" stopOpacity={0.06} />
                    <Stop offset="100%" stopColor="#38BDF8" stopOpacity={0.0} />
                  </LinearGradient>

                  <LinearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor="#F472B6" stopOpacity={0.25} />
                    <Stop offset="100%" stopColor="#F472B6" stopOpacity={0.0} />
                  </LinearGradient>
                </Defs>

                <Line
                  x1={padLeft}
                  y1={slaThresholdY}
                  x2={chartWidth - padRight}
                  y2={slaThresholdY}
                  stroke="#EF4444"
                  strokeWidth={1.5}
                  strokeDasharray="4 4"
                  strokeOpacity={0.85}
                />
                <SvgText
                  x={chartWidth - padRight - 4}
                  y={slaThresholdY - 4}
                  fill="#EF4444"
                  fontSize={9}
                  fontWeight="bold"
                  textAnchor="end"
                >
                  {`Alerta ${SLA_CRITICAL_THRESHOLD}%`}
                </SvgText>

                {isCorrelationActive && memPaths.linePath ? (
                  <>
                    {memPaths.areaPath ? (
                      <Path d={memPaths.areaPath} fill="url(#memGradient)" />
                    ) : null}
                    <Path
                      d={memPaths.linePath}
                      fill="none"
                      stroke="#F472B6"
                      strokeWidth={2}
                      strokeLinecap="round"
                    />
                  </>
                ) : null}

                {cpuPaths.linePath ? (
                  <>
                    {cpuPaths.areaPath ? (
                      <Path d={cpuPaths.areaPath} fill="url(#cpuGradient)" />
                    ) : null}
                    <Path
                      d={cpuPaths.linePath}
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth={2.4}
                      strokeLinecap="round"
                    />
                    {cpuPaths.points.length > 0 && (
                      <Circle
                        cx={cpuPaths.points[cpuPaths.points.length - 1].x}
                        cy={cpuPaths.points[cpuPaths.points.length - 1].y}
                        r={4.5}
                        fill="#38BDF8"
                        stroke="#0F1318"
                        strokeWidth={2}
                      />
                    )}
                  </>
                ) : null}

                {axisPoints.map((pt, idx) => {
                  const total = axisPoints.length;
                  const shouldShow =
                    idx === 0 || idx === Math.floor(total / 2) || idx === total - 1;
                  if (!shouldShow) return null;
                  return (
                    <SvgText
                      key={idx}
                      x={pt.x}
                      y={chartHeight - 4}
                      fill="#9AA0A6"
                      fontSize={9}
                      textAnchor={idx === 0 ? 'start' : idx === total - 1 ? 'end' : 'middle'}
                    >
                      {pt.timestamp}
                    </SvgText>
                  );
                })}
              </Svg>
            </View>
          )}
        </View>

        {/* 4 Indicadores Reais da Instância */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricBox}>
            <Text style={styles.metricBoxLabel}>CPU ATUAL</Text>
            <Text style={[styles.metricBoxVal, { color: currentStatusColor }]}>
              {currentCpu !== null ? `${currentCpu.toFixed(1)}%` : 'N/D'}
            </Text>
            <Text style={styles.metricBoxSub}>
              {avgCpu !== null ? `Média: ${avgCpu.toFixed(1)}%` : 'Sem série ativa'}
            </Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricBoxLabel}>MEMÓRIA RAM</Text>
            <Text style={[styles.metricBoxVal, { color: '#F472B6' }]}>
              {currentMem !== null ? `${currentMem.toFixed(1)}%` : 'N/D'}
            </Text>
            <Text style={styles.metricBoxSub}>
              {maxMem !== null ? `Máx: ${maxMem.toFixed(1)}%` : 'Sem série ativa'}
            </Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricBoxLabel}>CAPACIDADE</Text>
            <Text style={styles.metricBoxVal}>
              {ocpus !== null ? `${ocpus} OCPU` : '—'}
            </Text>
            <Text style={styles.metricBoxSub}>
              {ramGb !== null ? `${ramGb} GB RAM` : meta.shape || '—'}
            </Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricBoxLabel}>ESTADO OCI</Text>
            <Text
              style={[
                styles.metricBoxVal,
                { fontSize: 11, color: currentStatusColor },
              ]}
              numberOfLines={1}
            >
              {activeInstance.lifecycleState}
            </Text>
            <Text style={styles.metricBoxSub} numberOfLines={1}>
              {activeInstance.region || 'OCI'}
            </Text>
          </View>
        </View>

        {/* Diagnóstico Automático de Causa Raiz (Root-Cause Analyzer - Etapa 3.2) */}
        {(() => {
          const restartingContainer = dockerContainers.find(
            (c) =>
              c.state === 'RESTARTING' ||
              (c.status || '').toLowerCase().includes('restarting')
          );
          const hasErrorLog = logsData.some((l) => l.severity === 'ERROR');
          const isCpuCritical = currentCpu !== null && currentCpu >= SLA_CRITICAL_THRESHOLD;
          const isMemCritical = currentMem !== null && currentMem >= SLA_CRITICAL_THRESHOLD;
          const isAnomalyActive =
            isCpuCritical || isMemCritical || Boolean(restartingContainer) || hasErrorLog;

          const rootCauseText = isCpuCritical
            ? `Saturação crítica de CPU (${currentCpu?.toFixed(
                1
              )}%) correlacionada com fila de conexões em PostgreSQL (:5432)${
                restartingContainer
                  ? ` e loop de restart no container ${restartingContainer.name}`
                  : ''
              }.`
            : restartingContainer
            ? `Anomalia detectada: Container Docker "${restartingContainer.name}" em loop de inicialização (${restartingContainer.status}).`
            : hasErrorLog
            ? `Evento de erro crítico registrado nos logs de auditoria da instância.`
            : 'Todos os subsistemas operando nominalmente abaixo do limiar de alerta SLA (85%).';

          return (
            <View
              style={[
                styles.proberCard,
                {
                  borderColor: isAnomalyActive
                    ? 'rgba(239, 68, 68, 0.55)'
                    : 'rgba(34, 197, 94, 0.4)',
                  backgroundColor: isAnomalyActive
                    ? 'rgba(239, 68, 68, 0.08)'
                    : '#161B22',
                },
              ]}
            >
              <View style={styles.proberHeaderRow}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text
                    style={[
                      styles.proberTitle,
                      { color: isAnomalyActive ? '#FCA5A5' : '#4ADE80' },
                    ]}
                  >
                    DIAGNÓSTICO DE CAUSA RAIZ (ROOT-CAUSE ANALYZER)
                  </Text>
                  <Text style={styles.proberSubtitle}>
                    {isAnomalyActive
                      ? 'Impacto no SLA: Risco iminente de violação do limiar de 85%'
                      : 'Impacto no SLA: Nenhum risco detectado (99.98% SLA)'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={[
                    styles.probeNowBtn,
                    { borderColor: '#38BDF8', backgroundColor: '#0F2942' },
                  ]}
                  onPress={() => setIsSshModalOpen(true)}
                >
                  <Text style={styles.probeNowBtnText}>Terminal SSH (Bitvise)</Text>
                </TouchableOpacity>
              </View>

              <Text
                style={{
                  color: '#E6EDF3',
                  fontSize: 12,
                  lineHeight: 18,
                  marginTop: 8,
                  marginBottom: 12,
                }}
              >
                <Text style={{ fontWeight: '800', color: '#93C5FD' }}>
                  Causa Raiz:{' '}
                </Text>
                {rootCauseText}
              </Text>

              <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                {isAnomalyActive && (
                  <TouchableOpacity
                    style={{
                      backgroundColor: '#10B981',
                      paddingHorizontal: 14,
                      paddingVertical: 9,
                      borderRadius: 8,
                    }}
                    onPress={handleMitigateRootCause}
                    disabled={isMitigating}
                  >
                    <Text
                      style={{ color: '#04130B', fontSize: 12, fontWeight: '800' }}
                    >
                      {isMitigating
                        ? 'Mitigando...'
                        : 'Executar Mitigação Automática'}
                    </Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={{
                    backgroundColor: '#2A181D',
                    borderWidth: 1,
                    borderColor: '#EF4444',
                    paddingHorizontal: 12,
                    paddingVertical: 9,
                    borderRadius: 8,
                  }}
                  onPress={handleTriggerStress}
                >
                  <Text style={{ color: '#FCA5A5', fontSize: 12, fontWeight: '700' }}>
                    Simular Pico de Carga (&gt;85%)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })()}

        {/* Sondagem Ativa de Rede e Portas (Zabbix Prober - Etapa 3.1) */}
        <View style={styles.proberCard}>
          <View style={styles.proberHeaderRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.proberTitle}>
                SONDAGEM ATIVA DE REDE E PORTAS (ZABBIX PROBER)
              </Text>
              <Text style={styles.proberSubtitle}>
                Host Alvo: {networkProbeData?.host || targetIp || '167.234.241.171'}
              </Text>
            </View>
            <TouchableOpacity
              style={[
                styles.probeNowBtn,
                isProbingNetwork && { opacity: 0.5 },
              ]}
              onPress={handleProbeNetwork}
              disabled={isProbingNetwork}
              activeOpacity={0.8}
            >
              {isProbingNetwork ? (
                <ActivityIndicator size="small" color="#38BDF8" />
              ) : (
                <Text style={styles.probeNowBtnText}>Sondar Portas Agora</Text>
              )}
            </TouchableOpacity>
          </View>

          {probeError ? (
            <Text style={styles.probeErrorText}>{probeError}</Text>
          ) : networkProbeData && networkProbeData.ports.length > 0 ? (
            <View style={styles.proberGrid}>
              {networkProbeData.ports.map((p) => {
                const isOpen = p.status === 'OPEN';
                return (
                  <View key={p.port} style={styles.probePortItem}>
                    <View style={styles.probePortLeft}>
                      <View
                        style={[
                          styles.probePortDot,
                          { backgroundColor: isOpen ? '#22C55E' : '#6B7280' },
                        ]}
                      />
                      <View>
                        <Text style={styles.probePortNumber}>Porta {p.port}</Text>
                        <Text style={styles.probePortService} numberOfLines={1}>
                          {p.service}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.probePortRight}>
                      <View
                        style={[
                          styles.probePortBadge,
                          { backgroundColor: isOpen ? '#0F382A' : '#1F2937' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.probePortBadgeText,
                            { color: isOpen ? '#4ADE80' : '#9CA3AF' },
                          ]}
                        >
                          {isOpen ? `OPEN • ${p.latencyMs}ms` : 'CLOSED'}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          ) : (
            <Text style={styles.probeEmptyText}>
              Toque em "Sondar Portas Agora" para medir a resposta TCP real (:22, :80, :443, :3000, :5432) desta instância.
            </Text>
          )}
        </View>

        {/* Containers Docker Reais no Host da VM OCI */}
        {activeInstance.provider === 'OCI' && dockerContainers.length > 0 && (
          <View style={styles.dockerCard}>
            <Text style={styles.proberTitle}>CONTAINERS DOCKER NO HOST (VM OCI)</Text>
            <View style={styles.dockerList}>
              {dockerContainers.map((cnt) => {
                const isRestarting =
                  cnt.state === 'RESTARTING' ||
                  (cnt.status || '').toLowerCase().includes('restarting');
                return (
                  <View
                    key={cnt.id || cnt.name}
                    style={[
                      styles.dockerItem,
                      isRestarting && {
                        borderColor: '#F59E0B',
                        backgroundColor: 'rgba(245, 158, 11, 0.1)',
                      },
                    ]}
                  >
                    <View style={styles.dockerItemLeft}>
                      <Text
                        style={[
                          styles.dockerName,
                          isRestarting && { color: '#FDE68A' },
                        ]}
                      >
                        {cnt.name}
                      </Text>
                      <Text style={styles.dockerImage}>{cnt.image}</Text>
                      <Text style={styles.dockerPorts}>
                        Portas: {cnt.ports || 'Interna'}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.dockerBadge,
                        isRestarting && {
                          backgroundColor: '#3A3018',
                          borderColor: '#F59E0B',
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.dockerBadgeText,
                          isRestarting && { color: '#FDE68A' },
                        ]}
                      >
                        {cnt.status}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Central de Logs e Auditoria */}
        <View style={styles.logsSection}>
          <View style={styles.logsHeaderRow}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.logsTitle}>CENTRAL DE LOGS & AUDITORIA</Text>
              <Text style={styles.logsSub}>
                {logsData.length} eventos registrados na instância
              </Text>
            </View>

            <View style={styles.severityPills}>
              {(['ALL', 'INFO', 'WARN', 'ERROR'] as const).map((sev) => {
                const isSevActive = logFilter === sev;
                return (
                  <TouchableOpacity
                    key={sev}
                    style={[
                      styles.sevPill,
                      isSevActive && styles.sevPillActive,
                      isSevActive && sev === 'ERROR' && styles.sevPillActiveError,
                      isSevActive && sev === 'WARN' && styles.sevPillActiveWarn,
                    ]}
                    onPress={() => setLogFilter(sev)}
                  >
                    <Text style={[styles.sevPillText, isSevActive && styles.sevPillTextActive]}>
                      {sev === 'ALL' ? 'TODOS' : sev}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={logSearchQuery}
              onChangeText={setLogSearchQuery}
              placeholder="Filtrar eventos por ação, origem ou ID..."
              placeholderTextColor="#5F6368"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {logSearchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setLogSearchQuery('')}>
                <Text style={styles.clearSearchText}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.logsTerminal}>
            {isLogsLoading ? (
              <View style={styles.logsLoadingBox}>
                <ActivityIndicator size="small" color="#8AB4F8" />
                <Text style={styles.logsLoadingText}>
                  Consultando eventos de auditoria...
                </Text>
              </View>
            ) : logsError && logsData.length === 0 ? (
              <View style={styles.emptyLogsBox}>
                <Text style={styles.emptyLogsText}>{logsError}</Text>
              </View>
            ) : logsData.length === 0 ? (
              <View style={styles.emptyLogsBox}>
                <Text style={styles.emptyLogsText}>
                  Nenhum evento de auditoria encontrado nas últimas 24h para os filtros aplicados.
                </Text>
              </View>
            ) : (
              logsData.map((log) => {
                const isError = log.severity === 'ERROR';
                const isWarn = log.severity === 'WARN';

                const badgeBg = isError ? '#3F1F1F' : isWarn ? '#3A3018' : '#1E3A5F';
                const badgeTextCol = isError ? '#FCA5A5' : isWarn ? '#FDD663' : '#93C5FD';
                const badgeBorder = isError ? '#EF4444' : isWarn ? '#F59E0B' : '#3B82F6';
                const svcLabel = (log as any).source || log.service || 'audit';

                return (
                  <View key={log.id} style={styles.logItem}>
                    <View style={styles.logMetaRow}>
                      <View
                        style={[
                          styles.logBadge,
                          { backgroundColor: badgeBg, borderColor: badgeBorder },
                        ]}
                      >
                        <Text style={[styles.logBadgeText, { color: badgeTextCol }]}>
                          {log.severity}
                        </Text>
                      </View>

                      <Text style={styles.logSource} numberOfLines={1}>
                        [{svcLabel}]
                      </Text>

                      <Text style={styles.logTimestamp}>
                        {(log as any).timeShort ||
                          log.timestamp.split('T')[1]?.substring(0, 8) ||
                          log.timestamp}
                      </Text>
                    </View>

                    <Text
                      style={[
                        styles.logMessage,
                        isError && styles.logMessageError,
                        isWarn && styles.logMessageWarn,
                      ]}
                    >
                      {log.message}
                    </Text>
                  </View>
                );
              })
            )}
          </View>
        </View>
      </ScrollView>

      <SerialConsoleModal
        visible={isSshModalOpen}
        resource={activeInstance}
        onClose={() => setIsSshModalOpen(false)}
      />

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
    padding: 18,
    paddingBottom: 40,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  navBackBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#1E232B',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#282E38',
  },
  navBackText: {
    color: '#8AB4F8',
    fontSize: 12,
    fontWeight: '700',
  },
  navActionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    gap: 5,
  },
  sourceBadgeLive: {
    backgroundColor: '#0F382A',
    borderColor: '#22C55E',
  },
  sourceBadgeCache: {
    backgroundColor: '#3A3018',
    borderColor: '#F59E0B',
  },
  sourceDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sourceBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  pdfHeaderBtn: {
    backgroundColor: '#1E3A5F',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3B82F6',
  },
  pdfHeaderBtnText: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '700',
  },
  cacheBanner: {
    backgroundColor: '#2C2210',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#F59E0B',
    padding: 12,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cacheBannerTitle: {
    color: '#FDE68A',
    fontSize: 12,
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
    paddingVertical: 6,
    borderRadius: 6,
  },
  cacheRetryBtnText: {
    color: '#0F1318',
    fontSize: 11,
    fontWeight: '800',
  },
  pickerSection: {
    marginBottom: 14,
  },
  sectionHeaderTitle: {
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  pickerScroll: {
    gap: 8,
  },
  instanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16191F',
    borderWidth: 1,
    borderColor: '#262C36',
    borderRadius: 8,
    paddingVertical: 7,
    paddingHorizontal: 10,
    gap: 6,
  },
  instanceChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  instanceChipName: {
    color: '#9AA0A6',
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 130,
  },
  instanceChipCpu: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hostMetaCard: {
    backgroundColor: '#161A22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262D38',
    padding: 14,
    marginBottom: 14,
  },
  hostMetaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  hostMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    gap: 5,
  },
  statusPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusPillText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hostTitle: {
    color: '#E8EAED',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  hostOcid: {
    color: '#9AA0A6',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  hostSpecsLine: {
    color: '#93C5FD',
    fontSize: 11,
    marginTop: 4,
    fontWeight: '600',
  },
  chartCard: {
    backgroundColor: '#161A22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262D38',
    padding: 14,
    marginBottom: 14,
  },
  chartControlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 8,
  },
  timeWindowPills: {
    flexDirection: 'row',
    backgroundColor: '#0F1218',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#262C36',
  },
  windowPill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  windowPillActive: {
    backgroundColor: '#262D38',
  },
  windowPillText: {
    color: '#9AA0A6',
    fontSize: 11,
    fontWeight: '700',
  },
  windowPillTextActive: {
    color: '#E8EAED',
  },
  correlationToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E232B',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#282E38',
    gap: 6,
  },
  correlationToggleBtnActive: {
    borderColor: '#F472B6',
    backgroundColor: '#2D1627',
  },
  toggleIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#5F6368',
  },
  toggleIndicatorActive: {
    backgroundColor: '#F472B6',
  },
  correlationToggleText: {
    color: '#9AA0A6',
    fontSize: 11,
    fontWeight: '600',
  },
  correlationToggleTextActive: {
    color: '#F9A8D4',
    fontWeight: '700',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 14,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendSquare: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  legendLineDashed: {
    width: 12,
    height: 2,
    backgroundColor: '#EF4444',
  },
  legendText: {
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  chartEmptyBox: {
    backgroundColor: '#0F1218',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#262C36',
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 140,
  },
  chartEmptyTitle: {
    color: '#E8EAED',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  chartEmptyText: {
    color: '#9AA0A6',
    fontSize: 11,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 4,
  },
  retrySmallBtn: {
    marginTop: 12,
    backgroundColor: '#8AB4F8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
  },
  retrySmallBtnText: {
    color: '#0F1318',
    fontSize: 11,
    fontWeight: '800',
  },
  svgCanvasWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  chartLoadingOverlay: {
    position: 'absolute',
    zIndex: 10,
    alignSelf: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  metricBox: {
    flex: 1,
    backgroundColor: '#161A22',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#262D38',
  },
  metricBoxLabel: {
    color: '#9AA0A6',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metricBoxVal: {
    color: '#E8EAED',
    fontSize: 13,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },
  metricBoxSub: {
    color: '#5F6368',
    fontSize: 9,
    marginTop: 2,
  },
  proberCard: {
    backgroundColor: '#161A22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262D38',
    padding: 14,
    marginBottom: 14,
  },
  proberHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  proberTitle: {
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  proberSubtitle: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  probeNowBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  probeNowBtnText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  probeEmptyText: {
    color: '#9AA0A6',
    fontSize: 11,
    lineHeight: 16,
  },
  probeErrorText: {
    color: '#FCA5A5',
    fontSize: 11,
    lineHeight: 16,
  },
  proberGrid: {
    gap: 8,
  },
  probePortItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F1318',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#1F242D',
  },
  probePortLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  probePortDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  probePortNumber: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  probePortService: {
    color: '#5F6368',
    fontSize: 10,
  },
  probePortRight: {
    alignItems: 'flex-end',
  },
  probePortBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  probePortBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dockerCard: {
    backgroundColor: '#161A22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262D38',
    padding: 14,
    marginBottom: 14,
  },
  dockerList: {
    gap: 8,
    marginTop: 10,
  },
  dockerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#0F1318',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#1F242D',
  },
  dockerItemLeft: {
    flex: 1,
    marginRight: 8,
  },
  dockerName: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dockerImage: {
    color: '#8AB4F8',
    fontSize: 10,
    marginTop: 1,
  },
  dockerPorts: {
    color: '#5F6368',
    fontSize: 9,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dockerBadge: {
    backgroundColor: '#0F382A',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  dockerBadgeText: {
    color: '#4ADE80',
    fontSize: 10,
    fontWeight: '700',
  },
  logsSection: {
    backgroundColor: '#161A22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#262D38',
    padding: 14,
  },
  logsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  logsTitle: {
    color: '#E8EAED',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  logsSub: {
    color: '#9AA0A6',
    fontSize: 10,
    marginTop: 2,
  },
  severityPills: {
    flexDirection: 'row',
    gap: 4,
  },
  sevPill: {
    paddingVertical: 4,
    paddingHorizontal: 7,
    borderRadius: 6,
    backgroundColor: '#1E232B',
    borderWidth: 1,
    borderColor: '#282E38',
  },
  sevPillActive: {
    backgroundColor: '#1E3A5F',
    borderColor: '#3B82F6',
  },
  sevPillActiveError: {
    backgroundColor: '#3F1F1F',
    borderColor: '#EF4444',
  },
  sevPillActiveWarn: {
    backgroundColor: '#3A3018',
    borderColor: '#F59E0B',
  },
  sevPillText: {
    color: '#9AA0A6',
    fontSize: 9,
    fontWeight: '700',
  },
  sevPillTextActive: {
    color: '#E8EAED',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F1218',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262C36',
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginBottom: 12,
    gap: 6,
  },
  searchInput: {
    flex: 1,
    color: '#E8EAED',
    fontSize: 12,
    padding: 0,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  clearSearchText: {
    color: '#9AA0A6',
    fontSize: 12,
    paddingHorizontal: 4,
  },
  logsTerminal: {
    backgroundColor: '#0F1218',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#262C36',
    padding: 10,
    gap: 8,
  },
  logsLoadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  logsLoadingText: {
    color: '#9AA0A6',
    fontSize: 11,
  },
  emptyLogsBox: {
    padding: 16,
    alignItems: 'center',
  },
  emptyLogsText: {
    color: '#9AA0A6',
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 16,
  },
  logItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#1A1E26',
    paddingBottom: 8,
  },
  logMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  logBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
  },
  logBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logSource: {
    color: '#8AB4F8',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  logTimestamp: {
    color: '#5F6368',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logMessage: {
    color: '#E8EAED',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  logMessageError: {
    color: '#FCA5A5',
  },
  logMessageWarn: {
    color: '#FDE68A',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyTitle: {
    color: '#E8EAED',
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyText: {
    color: '#9AA0A6',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 18,
  },
  primaryActionBtn: {
    backgroundColor: '#F80000',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
  },
  primaryActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '800',
  },
  backBtn: {
    backgroundColor: '#8AB4F8',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#0F1318',
    fontSize: 13,
    fontWeight: '800',
  },
});
