/**
 * MetricsDetailScreen - Painel de Telemetria Analitica e Logs Insights
 * Progressive Disclosure Nivel 3: Graficos Vetoriais Suavizados (SVG),
 * Analise de Correlacao CPU x Memoria, Limiar Critico de SLA (85%)
 * e Central de Logs com Busca Instantanea e Filtros por Severidade.
 */

import React, { useState, useMemo, useEffect } from 'react';
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
import { CloudLogo } from '../components/common/CloudLogo';
import { CLOUD_PALETTES, NEUTRAL_THEME } from '../theme/tokens';
import { SLA_CRITICAL_THRESHOLD } from '../config/env';
import {
  telemetryRepository,
  StructuredMetricsData,
  InstanceLogEntry,
} from '../services/telemetryRepository';
import { Print, sharePdfAsync } from '../services/pdfService';
import { SerialConsoleModal } from '../components/SerialConsoleModal';
import type { CloudResource } from '../types';

export const MetricsDetailScreen: React.FC<{ navigation: any; route?: any }> = ({
  navigation,
  route,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const {
    resources,
    selectedResource,
    setSelectedResource,
    restartInstance,
    deleteInstance,
    editInstance,
  } = useCloud();

  // Estados de Janela Temporal e Correlacao (Sprint 2)
  const [timeWindow, setTimeWindow] = useState<'1h' | '24h' | '7d'>('24h');
  const [isCorrelationActive, setIsCorrelationActive] = useState<boolean>(true);

  // Estados da Central de Logs (Sprint 2)
  const [logFilter, setLogFilter] = useState<'ALL' | 'INFO' | 'WARN' | 'ERROR'>('ALL');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');
  const [logsData, setLogsData] = useState<InstanceLogEntry[]>([]);
  const [isLogsLoading, setIsLogsLoading] = useState<boolean>(false);

  // Estados de Metricas Estruturadas
  const [metricsData, setMetricsData] = useState<StructuredMetricsData | null>(null);
  const [isMetricsLoading, setIsMetricsLoading] = useState<boolean>(false);

  // Modais de Acao
  const [isSerialConsoleOpen, setIsSerialConsoleOpen] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  // Sincronizacao de recurso selecionado via rotas
  useEffect(() => {
    const targetId = route?.params?.selectedInstanceId || route?.params?.resourceId;
    if (targetId && resources.length > 0) {
      const found = resources.find((r) => r.id === targetId);
      if (found) {
        setSelectedResource(found);
      }
    } else if (!selectedResource && resources.length > 0) {
      setSelectedResource(resources[0]);
    }
  }, [route?.params?.selectedInstanceId, route?.params?.resourceId, resources]);

  const activeInstance: CloudResource | null = useMemo(() => {
    if (!selectedResource) {
      return resources.length > 0 ? resources[0] : null;
    }
    return resources.find((r) => r.id === selectedResource.id) || selectedResource;
  }, [selectedResource, resources]);

  // Carrega Telemetria Estruturada ao mudar instancia ou janela temporal
  useEffect(() => {
    if (!activeInstance) return;

    let isMounted = true;
    const fetchTelemetry = async () => {
      setIsMetricsLoading(true);
      const res = await telemetryRepository.getMetrics(
        activeInstance.id,
        timeWindow,
        activeInstance.metricsSummary?.cpuPercent ?? 24,
        activeInstance.metricsSummary?.memoryPercent ?? 48
      );
      if (isMounted) {
        setMetricsData(res.data);
        setIsMetricsLoading(false);
      }
    };

    fetchTelemetry();
    return () => {
      isMounted = false;
    };
  }, [activeInstance?.id, timeWindow]);

  // Carrega Logs Operacionais ao mudar instancia, filtro ou busca
  useEffect(() => {
    if (!activeInstance) return;

    let isMounted = true;
    const fetchLogs = async () => {
      setIsLogsLoading(true);
      const res = await telemetryRepository.getLogs(
        activeInstance.id,
        logFilter,
        logSearchQuery
      );
      if (isMounted) {
        setLogsData(res.data);
        setIsLogsLoading(false);
      }
    };

    fetchLogs();
    return () => {
      isMounted = false;
    };
  }, [activeInstance?.id, logFilter, logSearchQuery]);

  if (!activeInstance) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Nenhum servidor selecionado.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Voltar ao Console</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const activePalette = CLOUD_PALETTES[activeInstance.provider] || CLOUD_PALETTES.OCI;
  const cpuSeries = metricsData?.cpuSeries || [];
  const memorySeries = metricsData?.memorySeries || [];

  // ==========================================================================
  // GERADOR DE CURVAS SUAVIZADAS (CUBIC BEZIER SVG PATH)
  // ==========================================================================
  const chartWidth = Math.max(300, screenWidth - 36 - 28);
  const chartHeight = 170;
  const padLeft = 20;
  const padRight = 20;
  const padTop = 15;
  const padBottom = 25;
  const usableWidth = chartWidth - padLeft - padRight;
  const usableHeight = chartHeight - padTop - padBottom;

  const buildSmoothPath = (series: { timestamp: string; value: number }[]) => {
    if (!series || series.length === 0) return { linePath: '', areaPath: '', points: [] };

    const pts = series.map((pt, i) => {
      const x = padLeft + (i / Math.max(1, series.length - 1)) * usableWidth;
      const clampedVal = Math.min(100, Math.max(0, pt.value));
      const y = padTop + usableHeight - (clampedVal / 100) * usableHeight;
      return { x, y, value: pt.value, timestamp: pt.timestamp };
    });

    if (pts.length === 1) {
      return {
        linePath: `M ${pts[0].x} ${pts[0].y}`,
        areaPath: `M ${pts[0].x} ${chartHeight - padBottom} L ${pts[0].x} ${pts[0].y} L ${pts[0].x} ${chartHeight - padBottom} Z`,
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

  // Posicao vertical do limite critico de 85%
  const slaThresholdY = padTop + usableHeight - (SLA_CRITICAL_THRESHOLD / 100) * usableHeight;

  const handleExportPdf = async () => {
    if (isExportingPdf) return;
    setIsExportingPdf(true);
    try {
      const html = Print.generateExecutiveReportHtml(activeInstance);
      const pdfResult = await Print.printToFileAsync({
        html,
        serverName: activeInstance.name,
        provider: activeInstance.provider,
        region: activeInstance.region,
        status: activeInstance.status,
        cpu: `${activeInstance.metricsSummary?.cpuPercent ?? 0}%`,
        memory: `${activeInstance.metricsSummary?.memoryPercent || 48}%`,
        ocid: activeInstance.ocid || activeInstance.arn || activeInstance.id,
        sla: `${activeInstance.availabilitySla}%`,
        auditor: 'Joao Gabriel Barros Guimaraes - FATEC 4DSM',
      });

      await sharePdfAsync(pdfResult.uri, `Relatorio de Telemetria e SLA - ${activeInstance.name}`);
    } catch (error: any) {
      Alert.alert('Erro ao Exportar PDF', error?.message || 'Falha ao gerar relatorio.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'RUNNING':
      case 'HEALTHY':
        return '#22C55E';
      case 'REBOOTING':
      case 'WARNING':
      case 'DEGRADED':
        return '#F59E0B';
      case 'STOPPED':
      case 'CRITICAL':
      default:
        return '#EF4444';
    }
  };

  const currentStatusColor = getStatusColor(activeInstance.status);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Barra Superior de Navegacao */}
        <View style={styles.navBar}>
          <TouchableOpacity
            style={styles.navBackBtn}
            onPress={() => navigation.goBack()}
            activeOpacity={0.7}
          >
            <Text style={styles.navBackText}>← Voltar</Text>
          </TouchableOpacity>

          <View style={styles.navActionGroup}>
            <TouchableOpacity
              style={styles.pdfHeaderBtn}
              onPress={handleExportPdf}
              disabled={isExportingPdf}
              activeOpacity={0.7}
            >
              <Text style={styles.pdfHeaderBtnText}>
                {isExportingPdf ? 'Exportando...' : 'Exportar PDF'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Nivel 3.1: Seletor de Instancia no Topo */}
        <View style={styles.pickerSection}>
          <Text style={styles.sectionHeaderTitle}>SELETOR DE SERVIDORES</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pickerScroll}
          >
            {resources.map((inst) => {
              const isSelected = activeInstance.id === inst.id;
              const pTheme = CLOUD_PALETTES[inst.provider] || CLOUD_PALETTES.OCI;
              const dotCol = getStatusColor(inst.status);

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
                    {inst.metricsSummary?.cpuPercent ?? 0}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Cabecalho da Maquina Ativa */}
        <View style={styles.hostMetaCard}>
          <View style={styles.hostMetaHeader}>
            <View style={styles.hostMetaLeft}>
              <View style={[styles.statusPill, { borderColor: currentStatusColor }]}>
                <View style={[styles.statusPillDot, { backgroundColor: currentStatusColor }]} />
                <Text style={[styles.statusPillText, { color: currentStatusColor }]}>
                  {activeInstance.status}
                </Text>
              </View>
              <Text style={styles.hostTitle}>{activeInstance.name}</Text>
            </View>
            <View style={styles.sourceBadge}>
              <Text style={styles.sourceBadgeText}>
                {metricsData ? 'TELEMETRIA ATIVA' : 'LOCAL'}
              </Text>
            </View>
          </View>

          <Text style={styles.hostOcid} numberOfLines={1} ellipsizeMode="middle">
            {activeInstance.ocid || activeInstance.arn || activeInstance.id}
          </Text>
        </View>

        {/* Nivel 3.2: Card do Grafico Vetorial SVG com Analise de Correlacao */}
        <View style={styles.chartCard}>
          {/* Barra de Controles: Janela Temporal + Toggle de Correlacao */}
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

            {/* Botao de Toggle: Correlacionar CPU x Memoria */}
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
                Correlacionar CPU × Memória
              </Text>
            </TouchableOpacity>
          </View>

          {/* Legenda das Curvas e Limites */}
          <View style={styles.legendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendSquare, { backgroundColor: '#38BDF8' }]} />
              <Text style={styles.legendText}>
                CPU: {metricsData?.metrics.currentCpu ?? activeInstance.metricsSummary?.cpuPercent ?? 0}%
              </Text>
            </View>

            {isCorrelationActive && (
              <View style={styles.legendItem}>
                <View style={[styles.legendSquare, { backgroundColor: '#F472B6' }]} />
                <Text style={styles.legendText}>
                  Memória: {metricsData?.metrics.currentMemory ?? activeInstance.metricsSummary?.memoryPercent ?? 45}%
                </Text>
              </View>
            )}

            <View style={styles.legendItem}>
              <View style={[styles.legendLineDashed]} />
              <Text style={[styles.legendText, { color: '#EF4444' }]}>
                Limite SLA (85%)
              </Text>
            </View>
          </View>

          {/* Canvas SVG com Curvas Suavizadas */}
          <View style={styles.svgCanvasWrapper}>
            {isMetricsLoading && (
              <View style={styles.chartLoadingOverlay}>
                <ActivityIndicator size="small" color="#38BDF8" />
              </View>
            )}

            <Svg width={chartWidth} height={chartHeight}>
              <Defs>
                {/* Gradiente sutil translucido da CPU */}
                <LinearGradient id="cpuGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#38BDF8" stopOpacity={0.35} />
                  <Stop offset="80%" stopColor="#38BDF8" stopOpacity={0.06} />
                  <Stop offset="100%" stopColor="#38BDF8" stopOpacity={0.0} />
                </LinearGradient>

                {/* Gradiente sutil translucido da Memoria */}
                <LinearGradient id="memGradient" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0%" stopColor="#F472B6" stopOpacity={0.25} />
                  <Stop offset="100%" stopColor="#F472B6" stopOpacity={0.0} />
                </LinearGradient>
              </Defs>

              {/* Linha Tracejada Horizontal em 85% (Limite Critico SLA) */}
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
                Limite SLA 85%
              </SvgText>

              {/* Area e Curva de Memoria (quando Correlacao ativada) */}
              {isCorrelationActive && memPaths.areaPath ? (
                <>
                  <Path d={memPaths.areaPath} fill="url(#memGradient)" />
                  <Path
                    d={memPaths.linePath}
                    fill="none"
                    stroke="#F472B6"
                    strokeWidth={2}
                    strokeLinecap="round"
                  />
                </>
              ) : null}

              {/* Area e Curva Principal de CPU */}
              {cpuPaths.areaPath ? (
                <>
                  <Path d={cpuPaths.areaPath} fill="url(#cpuGradient)" />
                  <Path
                    d={cpuPaths.linePath}
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth={2.4}
                    strokeLinecap="round"
                  />
                  {/* Ponto atual ativo no final da curva */}
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

              {/* Rotulos Temporais no Rodape do Eixo X */}
              {cpuPaths.points.map((pt, idx) => {
                const total = cpuPaths.points.length;
                const shouldShow =
                  idx === 0 ||
                  idx === Math.floor(total / 2) ||
                  idx === total - 1;

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
        </View>

        {/* 4 Indicadores Chave de Desempenho */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricBox}>
            <Text style={styles.metricBoxLabel}>CONSUMO CPU</Text>
            <Text style={[styles.metricBoxVal, { color: currentStatusColor }]}>
              {metricsData?.metrics.currentCpu ?? activeInstance.metricsSummary?.cpuPercent ?? 0}%
            </Text>
            <Text style={styles.metricBoxSub}>
              Média: {metricsData?.metrics.avgCpu ?? 22}%
            </Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricBoxLabel}>MEMÓRIA RAM</Text>
            <Text style={[styles.metricBoxVal, { color: '#F472B6' }]}>
              {metricsData?.metrics.currentMemory ?? activeInstance.metricsSummary?.memoryPercent ?? 45}%
            </Text>
            <Text style={styles.metricBoxSub}>
              Pico: {metricsData?.metrics.maxMemory ?? 52}%
            </Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricBoxLabel}>LATÊNCIA I/O</Text>
            <Text style={styles.metricBoxVal}>
              {metricsData?.metrics.currentLatency ?? 3.4} ms
            </Text>
            <Text style={styles.metricBoxSub}>Sub-milissegundo</Text>
          </View>

          <View style={styles.metricBox}>
            <Text style={styles.metricBoxLabel}>DISPONIBILIDADE</Text>
            <Text
              style={[
                styles.metricBoxVal,
                activeInstance.availabilitySla < 99.5
                  ? { color: '#F59E0B' }
                  : { color: '#22C55E' },
              ]}
            >
              {activeInstance.availabilitySla}%
            </Text>
            <Text style={styles.metricBoxSub}>SLA Mensal</Text>
          </View>
        </View>

        {/* Botao de Abertura do Terminal Linux */}
        <TouchableOpacity
          style={styles.terminalButton}
          onPress={() => setIsSerialConsoleOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.terminalButtonIcon}>{'>_'}</Text>
          <Text style={styles.terminalButtonText}>Abrir Console Terminal Linux (SSH)</Text>
        </TouchableOpacity>

        {/* Nivel 3.3: Central de Logs (Logs Insights — Requisito Sprint 2) */}
        <View style={styles.logsSection}>
          <View style={styles.logsHeaderRow}>
            <View>
              <Text style={styles.logsTitle}>LOGS INSIGHTS (CENTRALIZADO)</Text>
              <Text style={styles.logsSub}>
                {logsData.length} eventos operacionais registrados
              </Text>
            </View>

            {/* Pilulas de Filtro Rapido de Severidade */}
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
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.sevPillText,
                        isSevActive && styles.sevPillTextActive,
                      ]}
                    >
                      {sev === 'ALL' ? 'Todos' : sev}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Campo de Busca Rapida por Texto */}
          <View style={styles.searchBar}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              style={styles.searchInput}
              value={logSearchQuery}
              onChangeText={setLogSearchQuery}
              placeholder="Buscar em mensagens, serviços ou IDs..."
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

          {/* Lista de Registros de Log com Fonte Monoespacada */}
          <View style={styles.logsTerminal}>
            {isLogsLoading ? (
              <View style={styles.logsLoadingBox}>
                <ActivityIndicator size="small" color="#8AB4F8" />
                <Text style={styles.logsLoadingText}>Filtrando logs em tempo real...</Text>
              </View>
            ) : logsData.length === 0 ? (
              <View style={styles.emptyLogsBox}>
                <Text style={styles.emptyLogsText}>
                  Nenhum log encontrado para os critérios selecionados.
                </Text>
              </View>
            ) : (
              logsData.map((log) => {
                const isError = log.severity === 'ERROR';
                const isWarn = log.severity === 'WARN';

                const badgeBg = isError ? '#3F1F1F' : isWarn ? '#3A3018' : '#1E3A5F';
                const badgeTextCol = isError ? '#FCA5A5' : isWarn ? '#FDD663' : '#93C5FD';
                const badgeBorder = isError ? '#EF4444' : isWarn ? '#F59E0B' : '#3B82F6';

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

                      <Text style={styles.logSource}>[{log.source}]</Text>

                      <Text style={styles.logTimestamp}>
                        {log.timeShort || log.timestamp.split('T')[1]?.substr(0, 8) || log.timestamp}
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

      {/* Console Serial Linux Emulado */}
      <SerialConsoleModal
        visible={isSerialConsoleOpen}
        onClose={() => setIsSerialConsoleOpen(false)}
        instance={activeInstance}
        onRestartInstance={(id) => restartInstance(id)}
      />
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
    marginBottom: 16,
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
    gap: 8,
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
    fontSize: 11,
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
  sourceBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sourceBadgeText: {
    color: '#38BDF8',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  hostOcid: {
    color: '#9AA0A6',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    fontSize: 14,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },
  metricBoxSub: {
    color: '#5F6368',
    fontSize: 9,
    marginTop: 2,
  },
  terminalButton: {
    backgroundColor: '#1A1D24',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D3139',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  terminalButtonIcon: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  terminalButtonText: {
    color: '#E8EAED',
    fontSize: 13,
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
    fontSize: 12,
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
    paddingHorizontal: 8,
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
    fontSize: 10,
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
  searchIcon: {
    fontSize: 12,
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
  },
  logTimestamp: {
    color: '#5F6368',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginLeft: 'auto',
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
  emptyText: {
    color: '#9AA0A6',
    fontSize: 14,
    marginBottom: 16,
  },
  backBtn: {
    backgroundColor: '#8AB4F8',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#0F1318',
    fontSize: 12,
    fontWeight: '700',
  },
});
