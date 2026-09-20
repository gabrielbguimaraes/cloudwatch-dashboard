/**
 * CloudWatch Dashboard - Tela de Detalhes de Métricas & Logs (MetricsDetailScreen)
 * Gráficos em Tempo Real, Métricas de Desempenho e Cloud Logs Insights
 * Aluno: João Gabriel Barros Guimarães - FATEC 4DSM
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import { colors } from '../theme';
import { useCloud } from '../context/CloudContext';
import {
  generateTimeSeriesMetrics,
  generateSimulatedLogs,
} from '../services/simulationService';

export const MetricsDetailScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const { selectedResource } = useCloud();
  const [logFilter, setLogFilter] = useState<'ALL' | 'ERROR' | 'WARN'>('ALL');

  if (!selectedResource) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>Nenhum recurso selecionado.</Text>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.backBtnText}>Voltar ao Dashboard</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const timeSeries = useMemo(() => {
    return generateTimeSeriesMetrics(selectedResource.id);
  }, [selectedResource.id]);

  const logs = useMemo(() => {
    const raw = generateSimulatedLogs(selectedResource.id);
    if (logFilter === 'ALL') return raw;
    return raw.filter((l) => l.severity === logFilter);
  }, [selectedResource.id, logFilter]);

  const handleExportPdf = () => {
    Alert.alert(
      '📄 Relatório PDF Gerado',
      `O relatório de métricas e conformidade da instância ${selectedResource.name} foi compilado com sucesso via react-native-pdf-lib.`,
      [{ text: 'OK' }]
    );
  };

  const handlePin = () => {
    Alert.alert('📌 Fixado no Dashboard', 'Métrica adicionada ao topo do painel principal.');
  };

  const isOci = selectedResource.provider === 'OCI';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header com Navegação de Retorno */}
        <View style={styles.navHeader}>
          <TouchableOpacity style={styles.navBackBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.navBackIcon}>←</Text>
            <Text style={styles.navBackText}>Voltar</Text>
          </TouchableOpacity>

          <View
            style={[
              styles.statusBadge,
              selectedResource.status === 'CRITICAL' && styles.statusBadgeCritical,
              selectedResource.status === 'WARNING' && styles.statusBadgeWarning,
            ]}
          >
            <Text
              style={[
                styles.statusBadgeText,
                selectedResource.status === 'CRITICAL' && { color: colors.status.danger },
                selectedResource.status === 'WARNING' && { color: colors.status.warning },
              ]}
            >
              {selectedResource.status === 'CRITICAL'
                ? 'ALERTA ATIVO'
                : selectedResource.status === 'WARNING'
                ? 'ATENÇÃO'
                : 'OPERACIONAL'}
            </Text>
          </View>
        </View>

        {/* Título e Metadados do Recurso */}
        <View style={styles.metaSection}>
          <View
            style={[
              styles.providerPill,
              isOci ? { backgroundColor: colors.oci.badgeBg, borderColor: colors.oci.badgeBorder } : { backgroundColor: colors.aws.badgeBg, borderColor: colors.aws.badgeBorder },
            ]}
          >
            <Text
              style={[
                styles.providerPillText,
                isOci ? { color: colors.oci.badgeText } : { color: colors.aws.badgeText },
              ]}
            >
              {selectedResource.provider === 'OCI' ? 'ORACLE CLOUD (OCI)' : selectedResource.provider}
            </Text>
          </View>

          <Text style={styles.resourceTitle}>{selectedResource.name}</Text>
          <Text style={styles.resourceOcid} numberOfLines={1}>
            {selectedResource.ocid || selectedResource.arn || selectedResource.id}
          </Text>
        </View>

        {/* Gráfico Vetorial de Desempenho */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleRow}>
              <View style={styles.chartDot} />
              <Text style={styles.chartTitle}>Uso de CPU em Tempo Real (%)</Text>
            </View>
            <Text style={styles.chartPeak}>Pico: {selectedResource.metricsSummary.cpuPercent}%</Text>
          </View>

          {/* Renderização da Curva com Barras e Pontos Representativos */}
          <View style={styles.chartCanvas}>
            <View style={styles.thresholdLine}>
              <Text style={styles.thresholdLabel}>Limite 80%</Text>
            </View>

            <View style={styles.barsContainer}>
              {timeSeries.slice(-16).map((pt, idx) => {
                const heightPercent = Math.min(100, Math.max(10, pt.value));
                const isOverThreshold = pt.value > 80;

                return (
                  <View key={idx} style={styles.barCol}>
                    <View
                      style={[
                        styles.barFill,
                        { height: `${heightPercent}%` },
                        isOverThreshold && styles.barFillDanger,
                      ]}
                    />
                    {idx % 4 === 0 && (
                      <Text style={styles.barLabel}>{pt.timestamp}</Text>
                    )}
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        {/* 4 Métricas Chave do Recurso */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>CONSUMO ATUAL</Text>
            <Text style={[styles.metricValue, { color: colors.neonCyan }]}>
              {selectedResource.metricsSummary.cpuPercent}% CPU
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>MEMÓRIA ALOCADA</Text>
            <Text style={styles.metricValue}>
              {selectedResource.metricsSummary.memoryPercent || 48}% RAM
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>LATÊNCIA DE I/O</Text>
            <Text style={styles.metricValue}>
              {selectedResource.metricsSummary.latencyMs || 4.2} ms
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>SLA DE UPTIME</Text>
            <Text style={[styles.metricValue, { color: colors.status.healthy }]}>
              {selectedResource.availabilitySla}%
            </Text>
          </View>
        </View>

        {/* Console de Logs Insights */}
        <View style={styles.logsSection}>
          <View style={styles.logsHeader}>
            <Text style={styles.logsTitle}>CLOUD LOGS INSIGHTS</Text>
            <View style={styles.logFilters}>
              <TouchableOpacity onPress={() => setLogFilter('ALL')}>
                <Text style={[styles.filterTag, logFilter === 'ALL' && styles.filterTagActive]}>
                  TODOS
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLogFilter('ERROR')}>
                <Text style={[styles.filterTag, logFilter === 'ERROR' && styles.filterTagActive]}>
                  ERROR
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.logsTerminal}>
            {logs.map((log) => (
              <View key={log.id} style={styles.logRow}>
                <Text
                  style={[
                    styles.logSeverity,
                    log.severity === 'ERROR' && { color: '#F87171' },
                    log.severity === 'WARN' && { color: '#FBBF24' },
                  ]}
                >
                  [{log.severity}]
                </Text>
                <Text style={styles.logTime}>{log.timestamp}</Text>
                <Text style={styles.logMsg} numberOfLines={2}>
                  {log.message}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Ações: PDF & Pin */}
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.actionBtnPdf} onPress={handleExportPdf}>
            <Text style={styles.actionBtnIcon}>📄</Text>
            <Text style={styles.actionBtnPdfText}>Exportar PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionBtnPin} onPress={handlePin}>
            <Text style={styles.actionBtnIcon}>📌</Text>
            <Text style={styles.actionBtnPinText}>Fixar no Início</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: 16,
    paddingBottom: 40,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  backBtn: {
    marginTop: 12,
    backgroundColor: colors.neonBlue,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  backBtnText: {
    color: '#FFF',
    fontWeight: '700',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  navBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navBackIcon: {
    color: colors.neonCyan,
    fontSize: 16,
    fontWeight: '700',
  },
  navBackText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    backgroundColor: colors.status.healthyBg,
    borderWidth: 1,
    borderColor: colors.status.healthyBorder,
  },
  statusBadgeCritical: {
    backgroundColor: colors.status.dangerBg,
    borderColor: colors.status.dangerBorder,
  },
  statusBadgeWarning: {
    backgroundColor: colors.status.warningBg,
    borderColor: colors.status.warningBorder,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'monospace',
    color: colors.status.healthy,
  },
  metaSection: {
    marginTop: 14,
  },
  providerPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 6,
  },
  providerPillText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  resourceTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  resourceOcid: {
    color: colors.textMuted,
    fontSize: 10,
    fontFamily: 'monospace',
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 18,
    padding: 14,
    marginTop: 16,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  chartTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chartDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.neonCyan,
  },
  chartTitle: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  chartPeak: {
    color: '#F87171',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  chartCanvas: {
    height: 120,
    position: 'relative',
    justifyContent: 'flex-end',
  },
  thresholdLine: {
    position: 'absolute',
    top: 24,
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderTopColor: '#EF444480',
    borderStyle: 'dashed',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  thresholdLabel: {
    color: '#EF4444',
    fontSize: 8,
    fontFamily: 'monospace',
    marginTop: -10,
  },
  barsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: '100%',
    gap: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  barFill: {
    width: '100%',
    backgroundColor: colors.neonCyan,
    borderRadius: 4,
    minHeight: 6,
    opacity: 0.85,
  },
  barFillDanger: {
    backgroundColor: colors.status.danger,
  },
  barLabel: {
    color: colors.textMuted,
    fontSize: 7,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  metricCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 14,
    padding: 10,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  logsSection: {
    marginTop: 18,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logsTitle: {
    color: colors.textSecondary,
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  logFilters: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTag: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: 'monospace',
  },
  filterTagActive: {
    color: colors.neonCyan,
    fontWeight: '800',
  },
  logsTerminal: {
    backgroundColor: '#050811',
    borderWidth: 1,
    borderColor: '#1E293B',
    borderRadius: 14,
    padding: 10,
    gap: 8,
  },
  logRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  logSeverity: {
    color: colors.neonCyan,
    fontSize: 9,
    fontWeight: '800',
    fontFamily: 'monospace',
  },
  logTime: {
    color: colors.textMuted,
    fontSize: 9,
    fontFamily: 'monospace',
  },
  logMsg: {
    color: '#CBD5E1',
    fontSize: 9,
    fontFamily: 'monospace',
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 18,
  },
  actionBtnPdf: {
    flex: 1,
    backgroundColor: '#0066FF20',
    borderWidth: 1,
    borderColor: '#0066FF50',
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnIcon: {
    fontSize: 14,
  },
  actionBtnPdfText: {
    color: colors.neonCyan,
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnPin: {
    flex: 1,
    backgroundColor: colors.surfaceCard,
    borderWidth: 1,
    borderColor: colors.surfaceBorder,
    borderRadius: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionBtnPinText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
  },
});
