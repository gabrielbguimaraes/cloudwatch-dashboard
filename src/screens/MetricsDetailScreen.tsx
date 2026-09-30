import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
  Vibration,
  Platform,
} from 'react-native';
import { colors, fonts } from '../theme';
import { getProviderTheme } from '../theme/providerConfig';
import { useCloud } from '../context/CloudContext';
import {
  generateTimeSeriesMetrics,
  generateSimulatedLogs,
} from '../services/simulationService';
import { Print, sharePdfAsync } from '../services/pdfService';
import type { CloudResource } from '../types';

export const MetricsDetailScreen: React.FC<{ navigation: any; route?: any }> = ({
  navigation,
  route,
}) => {
  const {
    resources,
    selectedResource,
    setSelectedResource,
    togglePin,
    isResourcePinned,
    restartInstance,
    deleteInstance,
    editInstance,
  } = useCloud();

  const [logFilter, setLogFilter] = useState<'ALL' | 'ERROR' | 'WARN'>('ALL');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isSerialConsoleOpen, setIsSerialConsoleOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editShape, setEditShape] = useState('');

  // Sincronização inteligente com route.params?.selectedInstanceId
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

  // Instância ativa viva referenciada diretamente do array de recursos do contexto
  const activeInstance: CloudResource | null = useMemo(() => {
    if (!selectedResource) {
      return resources.length > 0 ? resources[0] : null;
    }
    return resources.find((r) => r.id === selectedResource.id) || selectedResource;
  }, [selectedResource, resources]);

  if (!activeInstance) {
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

  const isPinned = isResourcePinned(activeInstance.id);
  const providerTheme = getProviderTheme(activeInstance.provider);

  // Gráfico vetorial de CPU proporcional à carga em tempo real da máquina
  const timeSeries = useMemo(() => {
    const points = generateTimeSeriesMetrics(activeInstance.id);
    const targetCpu = activeInstance.metricsSummary?.cpuPercent ?? 10;
    return points.map((pt, idx) => {
      if (idx === points.length - 1) {
        return { ...pt, value: targetCpu };
      }
      const ratio = targetCpu > 0 ? targetCpu / 85 : 0.05;
      const ptVal = pt.value ?? 10;
      const scaledVal = Math.min(
        100,
        Math.max(targetCpu > 0 ? 5 : 0, Math.round(ptVal * ratio * 10) / 10)
      );
      return { ...pt, value: scaledVal };
    });
  }, [activeInstance.id, activeInstance.metricsSummary?.cpuPercent]);

  // Console de auditoria filtrado rigorosamente para a máquina ativa
  const logs = useMemo(() => {
    const raw = generateSimulatedLogs(activeInstance.id);
    if (logFilter === 'ALL') return raw;
    return raw.filter((l) => l.severity === logFilter);
  }, [activeInstance.id, logFilter]);

  // Status semáforo sóbrio Google Cloud Monitoring M3
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CRITICAL':
      case 'STOPPED':
        return {
          bg: '#2D1515',
          border: '#4D1F1F',
          text: '#F28B82',
          label: status === 'STOPPED' ? 'PARADO (0% CPU)' : 'ALERTA CRÍTICO',
        };
      case 'WARNING':
        return {
          bg: '#2E230B',
          border: '#4D3A12',
          text: '#FDD663',
          label: 'ATENÇÃO',
        };
      case 'REBOOTING':
        return {
          bg: '#0B2538',
          border: '#164E63',
          text: '#38BDF8',
          label: 'REINICIANDO...',
        };
      case 'HEALTHY':
      case 'RUNNING':
      default:
        return {
          bg: '#132B1D',
          border: '#1E462E',
          text: '#81C995',
          label: 'OPERACIONAL',
        };
    }
  };

  const statusBadge = getStatusBadge(activeInstance.status);

  /**
   * Exporta Relatório Executivo em PDF
   */
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
        auditor: 'João Gabriel Barros Guimarães - FATEC 4DSM',
      });

      await sharePdfAsync(
        pdfResult.uri,
        `Relatório de Telemetria e SLA - ${activeInstance.name}`
      );
    } catch (error: any) {
      console.warn('Erro ao exportar PDF:', error);
      Alert.alert(
        'Erro ao Exportar PDF',
        error?.message || 'Falha ao gerar ou compartilhar arquivo PDF.'
      );
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePin = () => {
    togglePin(activeInstance.id);
    Alert.alert(
      isPinned ? 'Desafixado do Topo' : '📌 Fixado no Topo',
      isPinned
        ? `${activeInstance.name} foi removido dos destaques.`
        : `${activeInstance.name} foi fixado na seção prioritária do Dashboard.`
    );
  };

  const handleRestart = () => {
    if (activeInstance.status === 'REBOOTING') return;
    Vibration.vibrate(30);
    restartInstance(activeInstance.id);
  };

  const handleOpenEdit = () => {
    setEditName(activeInstance.name);
    setEditShape(
      (activeInstance.metadata as any)?.shape ||
        activeInstance.tags?.Shape ||
        'VM.Standard.E4.Flex'
    );
    setIsEditModalVisible(true);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) {
      Alert.alert('Nome Inválido', 'O nome da máquina não pode ficar em branco.');
      return;
    }
    editInstance(activeInstance.id, editName, editShape);
    setIsEditModalVisible(false);
    Alert.alert('Instância Atualizada', 'O nome do servidor foi atualizado com sucesso.');
  };

  const handleDelete = () => {
    Alert.alert(
      'Encerrar Servidor',
      'Tem certeza que deseja terminar esta instância permanentemente?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
          style: 'destructive',
          onPress: () => {
            deleteInstance(activeInstance.id);
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        {/* Header com Navegação de Retorno e Status Sóbrio */}
        <View style={styles.navHeader}>
          <TouchableOpacity style={styles.navBackBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.navBackIcon}>←</Text>
            <Text style={styles.navBackText}>Voltar</Text>
          </TouchableOpacity>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusBadge.bg, borderColor: statusBadge.border },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: statusBadge.text }]}>
              {statusBadge.label}
            </Text>
          </View>
        </View>

        {/* 🧭 Seletor Horizontal de Instâncias (Picker Carrossel) */}
        <View style={styles.pickerSection}>
          <Text style={styles.pickerSectionTitle}>SELETOR DE INSTÂNCIAS CONECTADAS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pickerScroll}
          >
            {resources.map((inst) => {
              const isSelected = activeInstance.id === inst.id;
              const isCrit = inst.status === 'CRITICAL' || (inst.status as string) === 'STOPPED';
              const isWarn = inst.status === 'WARNING';
              const pTheme = getProviderTheme(inst.provider);

              return (
                <TouchableOpacity
                  key={inst.id}
                  style={[
                    styles.instanceChip,
                    isSelected && {
                      backgroundColor: '#1E242C',
                      borderColor: pTheme.primaryColor,
                      borderWidth: 1.5,
                    },
                  ]}
                  onPress={() => setSelectedResource(inst)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.instanceChipDot,
                      {
                        backgroundColor: isCrit
                          ? colors.status.danger
                          : isWarn
                            ? colors.status.warning
                            : colors.status.healthy,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.instanceChipName,
                      isSelected && { color: '#FFFFFF', fontWeight: '800' },
                    ]}
                    numberOfLines={1}
                  >
                    {inst.name}
                  </Text>
                  <Text
                    style={[
                      styles.instanceChipCpu,
                      isSelected && { color: pTheme.primaryColor, fontWeight: '800' },
                    ]}
                  >
                    {inst.metricsSummary?.cpuPercent ?? 0}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Metadados e Título da Instância Ativa */}
        <View style={styles.metaSection}>
          <View
            style={[
              styles.providerPill,
              {
                backgroundColor: providerTheme.primaryBg,
                borderColor: providerTheme.borderColor,
              },
            ]}
          >
            <Text style={[styles.providerPillText, { color: providerTheme.accentColor }]}>
              {activeInstance.provider === 'OCI'
                ? 'ORACLE CLOUD (OCI)'
                : activeInstance.provider === 'AWS'
                  ? 'AMAZON WEB SERVICES (AWS)'
                  : 'GOOGLE CLOUD (GCP)'}
            </Text>
          </View>

          <Text style={styles.resourceTitle}>{activeInstance.name}</Text>
          <Text style={styles.resourceOcid} numberOfLines={1}>
            {activeInstance.ocid || activeInstance.arn || activeInstance.id}
          </Text>
        </View>

        {/* Gráfico Vetorial de Desempenho em Tempo Real */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleRow}>
              <View
                style={[
                  styles.chartDot,
                  {
                    backgroundColor:
                      (activeInstance.metricsSummary?.cpuPercent ?? 0) > 85
                        ? colors.status.danger
                        : colors.provider.oci,
                  },
                ]}
              />
              <Text style={styles.chartTitle}>Uso de CPU em Tempo Real (%)</Text>
            </View>
            <Text
              style={[
                styles.chartPeak,
                (activeInstance.metricsSummary?.cpuPercent ?? 0) > 85 && {
                  color: colors.status.danger,
                },
              ]}
            >
              Carga Atual: {activeInstance.metricsSummary?.cpuPercent ?? 0}%
            </Text>
          </View>

          {/* Canvas de Barras Vetoriais Proporcionais */}
          <View style={styles.chartCanvas}>
            <View style={styles.thresholdLine}>
              <Text style={styles.thresholdLabel}>Limite 80%</Text>
            </View>

            <View style={styles.barsContainer}>
              {timeSeries.slice(-16).map((pt, idx) => {
                const val = pt.value ?? 0;
                const heightPercent = Math.min(100, Math.max(10, val));
                const isOverThreshold = val > 80;

                return (
                  <View key={idx} style={styles.barCol}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${heightPercent}%`,
                          backgroundColor: isOverThreshold
                            ? colors.status.danger
                            : '#81C995',
                        },
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

        {/* 💻 Botão Expansível: Console Serial Linux Emulado */}
        <TouchableOpacity
          style={styles.serialConsoleBtn}
          onPress={() => setIsSerialConsoleOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.serialConsoleBtnIcon}>{'>_'}</Text>
          <Text style={styles.serialConsoleBtnText}>Abrir Console Serial da VM</Text>
        </TouchableOpacity>

        {/* 4 Métricas Chave do Recurso */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>CONSUMO ATUAL</Text>
            <Text
              style={[
                styles.metricValue,
                (activeInstance.metricsSummary?.cpuPercent ?? 0) > 85
                  ? { color: colors.status.danger }
                  : { color: colors.status.healthy },
              ]}
            >
              {activeInstance.metricsSummary?.cpuPercent ?? 0}% CPU
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>MEMÓRIA ALOCADA</Text>
            <Text style={styles.metricValue}>
              {activeInstance.metricsSummary?.memoryPercent || 48}% RAM
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>LATÊNCIA DE I/O</Text>
            <Text style={styles.metricValue}>
              {activeInstance.metricsSummary?.latencyMs || 4.2} ms
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>SLA DE DISPONIBILIDADE</Text>
            <Text
              style={[
                styles.metricValue,
                activeInstance.availabilitySla < 99.5
                  ? { color: colors.status.warning }
                  : { color: colors.status.healthy },
              ]}
            >
              {activeInstance.availabilitySla}%
            </Text>
          </View>
        </View>

        {/* Console de Auditoria e Logs Filtrado para a Máquina Ativa */}
        <View style={styles.logsSection}>
          <View style={styles.logsHeader}>
            <Text style={styles.logsTitle}>CONSOLE DE AUDITORIA & LOGS</Text>
            <View style={styles.logFilters}>
              <TouchableOpacity onPress={() => setLogFilter('ALL')}>
                <Text
                  style={[
                    styles.filterTag,
                    logFilter === 'ALL' && styles.filterTagActive,
                  ]}
                >
                  TODOS
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setLogFilter('ERROR')}>
                <Text
                  style={[
                    styles.filterTag,
                    logFilter === 'ERROR' && styles.filterTagActive,
                  ]}
                >
                  ERROR
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.logsTerminal}>
            {logs.length === 0 ? (
              <Text style={styles.emptyLogsText}>Nenhum registro de log encontrado.</Text>
            ) : (
              logs.map((log) => (
                <View key={log.id} style={styles.logRow}>
                  <Text
                    style={[
                      styles.logSeverity,
                      log.severity === 'ERROR' && { color: colors.status.danger },
                      log.severity === 'WARN' && { color: colors.status.warning },
                    ]}
                  >
                    [{log.severity}]
                  </Text>
                  <Text style={styles.logTime}>{log.timestamp}</Text>
                  <Text style={styles.logMsg} numberOfLines={2}>
                    {log.message}
                  </Text>
                </View>
              ))
            )}
          </View>
        </View>

        {/* Controles de Ciclo de Vida */}
        <View style={styles.lifecycleCard}>
          <Text style={styles.lifecycleTitle}>CONTROLES DE CICLO DE VIDA</Text>
          <View style={styles.lifecycleButtonsRow}>
            {/* Botão Reiniciar */}
            <TouchableOpacity
              style={[
                styles.lifecycleBtn,
                styles.lifecycleBtnRestart,
                activeInstance.status === 'REBOOTING' && styles.lifecycleBtnDisabled,
              ]}
              onPress={handleRestart}
              disabled={activeInstance.status === 'REBOOTING'}
              activeOpacity={0.7}
            >
              {activeInstance.status === 'REBOOTING' ? (
                <>
                  <ActivityIndicator size="small" color="#38BDF8" style={{ marginRight: 6 }} />
                  <Text style={styles.lifecycleBtnRestartText}>Reiniciando...</Text>
                </>
              ) : (
                <>
                  <Text style={styles.lifecycleBtnIcon}>🔄</Text>
                  <Text style={styles.lifecycleBtnRestartText}>Reiniciar</Text>
                </>
              )}
            </TouchableOpacity>

            {/* Botão Editar */}
            <TouchableOpacity
              style={[styles.lifecycleBtn, styles.lifecycleBtnEdit]}
              onPress={handleOpenEdit}
              activeOpacity={0.7}
            >
              <Text style={styles.lifecycleBtnIcon}>✏️</Text>
              <Text style={styles.lifecycleBtnEditText}>Editar</Text>
            </TouchableOpacity>

            {/* Botão Excluir */}
            <TouchableOpacity
              style={[styles.lifecycleBtn, styles.lifecycleBtnDelete]}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Text style={styles.lifecycleBtnIcon}>🗑️</Text>
              <Text style={styles.lifecycleBtnDeleteText}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Ações: PDF & Pin */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtnPdf, isExportingPdf && { opacity: 0.7 }]}
            onPress={handleExportPdf}
            disabled={isExportingPdf}
          >
            {isExportingPdf ? (
              <ActivityIndicator size="small" color="#81C995" />
            ) : (
              <Text style={styles.actionBtnIcon}>📄</Text>
            )}
            <Text style={styles.actionBtnPdfText}>
              {isExportingPdf ? 'Gerando PDF...' : 'Exportar Relatório PDF'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtnPin, isPinned && styles.actionBtnPinActive]}
            onPress={handlePin}
          >
            <Text style={styles.actionBtnIcon}>📌</Text>
            <Text
              style={[
                styles.actionBtnPinText,
                isPinned && styles.actionBtnPinTextActive,
              ]}
            >
              {isPinned ? 'Fixado no Topo' : 'Fixar no Início'}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal: Console Serial Linux Emulado */}
      <Modal
        visible={isSerialConsoleOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsSerialConsoleOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.serialConsoleCard}>
            <View style={styles.serialConsoleHeader}>
              <View style={styles.serialConsoleTitleRow}>
                <Text style={styles.serialConsoleDot}>●</Text>
                <Text style={styles.serialConsoleTitle}>Console Serial Linux (ttyS0)</Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsSerialConsoleOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.serialTerminalScreen}>
              <ScrollView
                style={styles.serialConsoleBody}
                contentContainerStyle={styles.serialConsoleContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.serialConsoleLine}>
                  <Text style={styles.serialConsoleGreen}>[ 0.000000] </Text>
                  <Text style={styles.serialConsoleWhite}>Linux version 6.5.0-oracle-aarch64 (root@builder)</Text>
                </Text>
                <Text style={styles.serialConsoleLine}>
                  <Text style={styles.serialConsoleGreen}>[ 1.204910] </Text>
                  <Text style={styles.serialConsoleWhite}>systemd[1]: Reached target Network (Pre).</Text>
                </Text>
                <Text style={styles.serialConsoleLine}>
                  <Text style={styles.serialConsoleGreen}>[ 2.100412] </Text>
                  <Text style={styles.serialConsoleWhite}>oci-agent[782]: Telemetry heartbeat acknowledged (sa-saopaulo-1).</Text>
                </Text>
                <Text style={styles.serialConsoleLine}>
                  <Text style={styles.serialConsoleGreen}>[ 3.409112] </Text>
                  <Text style={styles.serialConsoleWhite}>nginx[1042]: Listening on port 443 with TLS active.</Text>
                </Text>
                <Text style={styles.serialConsoleLine}>
                  <Text style={styles.serialConsoleGreen}>[ 12.890123] </Text>
                  <Text style={styles.serialConsoleWhite}>cloudwatch-probe: CPU utilization monitored via socket probe.</Text>
                </Text>
                <Text style={styles.serialConsolePromptRow}>
                  <Text style={styles.serialConsolePromptUser}>ubuntu@server-node:~$ </Text>
                  <Text style={styles.serialConsoleCursor}>_</Text>
                </Text>
              </ScrollView>
            </View>

            <TouchableOpacity
              style={styles.serialConsoleCloseBtn}
              onPress={() => setIsSerialConsoleOpen(false)}
            >
              <Text style={styles.serialConsoleCloseBtnText}>Fechar Console</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: Edição de Nome e Shape da Instância */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalCard}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>✏️ Editar Instância</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
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

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>ARQUITETURA / SHAPE</Text>
              <TextInput
                style={styles.formInput}
                value={editShape}
                onChangeText={setEditShape}
                placeholder="Shape (ex: VM.Standard.E4.Flex)"
                placeholderTextColor="#64748B"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={styles.cancelModalBtn}
                onPress={() => setIsEditModalVisible(false)}
              >
                <Text style={styles.cancelModalBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.saveModalBtn} onPress={handleSaveEdit}>
                <Text style={styles.saveModalBtnText}>Salvar Alterações</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0F1318',
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
    color: '#94A3B8',
    fontSize: 14,
    fontFamily: fonts.mono,
  },
  backBtn: {
    marginTop: 12,
    backgroundColor: '#1E242C',
    borderWidth: 1,
    borderColor: '#282E38',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#282E38',
  },
  navBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  navBackIcon: {
    color: '#81C995',
    fontSize: 16,
    fontWeight: '700',
  },
  navBackText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: fonts.mono,
  },
  pickerSection: {
    marginTop: 14,
    marginBottom: 4,
  },
  pickerSectionTitle: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: fonts.mono,
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  pickerScroll: {
    gap: 8,
    paddingRight: 10,
  },
  instanceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#181C22',
    borderWidth: 1,
    borderColor: '#282E38',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  instanceChipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  instanceChipName: {
    color: '#CBD5E1',
    fontSize: 11,
    fontFamily: fonts.mono,
    maxWidth: 130,
  },
  instanceChipCpu: {
    color: '#94A3B8',
    fontSize: 10,
    fontFamily: fonts.mono,
  },
  metaSection: {
    marginTop: 12,
  },
  providerPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    marginBottom: 6,
  },
  providerPillText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: fonts.mono,
  },
  resourceTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '900',
  },
  resourceOcid: {
    color: '#94A3B8',
    fontSize: 10,
    fontFamily: fonts.mono,
    marginTop: 2,
  },
  chartCard: {
    backgroundColor: '#181C22',
    borderWidth: 1,
    borderColor: '#282E38',
    borderRadius: 14,
    padding: 14,
    marginTop: 14,
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
  },
  chartTitle: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
  },
  chartPeak: {
    color: '#81C995',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: fonts.mono,
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
    borderTopColor: '#EF444460',
    borderStyle: 'dashed',
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  thresholdLabel: {
    color: '#F28B82',
    fontSize: 8,
    fontFamily: fonts.mono,
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
    borderRadius: 3,
    minHeight: 6,
    opacity: 0.9,
  },
  barLabel: {
    color: '#64748B',
    fontSize: 7,
    fontFamily: fonts.mono,
    marginTop: 4,
  },
  serialConsoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#05080C',
    borderWidth: 1,
    borderColor: '#1E242C',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 10,
    gap: 8,
  },
  serialConsoleBtnIcon: {
    color: '#81C995',
    fontSize: 13,
    fontWeight: '900',
    fontFamily: fonts.mono,
  },
  serialConsoleBtnText: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: fonts.mono,
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
    backgroundColor: '#181C22',
    borderWidth: 1,
    borderColor: '#282E38',
    borderRadius: 12,
    padding: 10,
  },
  metricLabel: {
    color: '#94A3B8',
    fontSize: 8,
    fontWeight: '800',
    fontFamily: fonts.mono,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '900',
    marginTop: 2,
    fontFamily: fonts.mono,
  },
  logsSection: {
    marginTop: 16,
  },
  logsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logsTitle: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: fonts.mono,
  },
  logFilters: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTag: {
    color: '#64748B',
    fontSize: 9,
    fontFamily: fonts.mono,
  },
  filterTagActive: {
    color: '#81C995',
    fontWeight: '800',
  },
  logsTerminal: {
    backgroundColor: '#05080C',
    borderWidth: 1,
    borderColor: '#1E242C',
    borderRadius: 12,
    padding: 10,
    gap: 8,
  },
  emptyLogsText: {
    color: '#64748B',
    fontSize: 10,
    fontFamily: fonts.mono,
    fontStyle: 'italic',
  },
  logRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  logSeverity: {
    color: '#81C995',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: fonts.mono,
  },
  logTime: {
    color: '#64748B',
    fontSize: 9,
    fontFamily: fonts.mono,
  },
  logMsg: {
    color: '#CBD5E1',
    fontSize: 9,
    fontFamily: fonts.mono,
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  actionBtnPdf: {
    flex: 1,
    backgroundColor: '#132B1D',
    borderWidth: 1,
    borderColor: '#1E462E',
    borderRadius: 10,
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
    color: '#81C995',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnPin: {
    flex: 1,
    backgroundColor: '#181C22',
    borderWidth: 1,
    borderColor: '#282E38',
    borderRadius: 10,
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
  actionBtnPinActive: {
    backgroundColor: '#1E242C',
    borderColor: '#81C995',
  },
  actionBtnPinTextActive: {
    color: '#81C995',
  },
  lifecycleCard: {
    marginTop: 16,
    backgroundColor: '#181C22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#282E38',
    padding: 12,
  },
  lifecycleTitle: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: fonts.mono,
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  lifecycleButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  lifecycleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  lifecycleBtnRestart: {
    backgroundColor: '#0B2538',
    borderColor: '#164E63',
  },
  lifecycleBtnEdit: {
    backgroundColor: '#1F242C',
    borderColor: '#374151',
  },
  lifecycleBtnDelete: {
    backgroundColor: '#2D1515',
    borderColor: '#4D1F1F',
  },
  lifecycleBtnDisabled: {
    opacity: 0.7,
  },
  lifecycleBtnIcon: {
    fontSize: 13,
  },
  lifecycleBtnRestartText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  lifecycleBtnEditText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  lifecycleBtnDeleteText: {
    color: '#F28B82',
    fontSize: 11,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  editModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#181C22',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#282E38',
    padding: 18,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#282E38',
  },
  editModalTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  modalCloseText: {
    color: '#94A3B8',
    fontSize: 16,
    fontWeight: '700',
    padding: 4,
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: fonts.mono,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#0F1318',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#282E38',
    color: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: fonts.mono,
  },
  modalActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  cancelModalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#1E242C',
    alignItems: 'center',
  },
  cancelModalBtnText: {
    color: '#94A3B8',
    fontWeight: '700',
    fontSize: 12,
  },
  saveModalBtn: {
    flex: 1.4,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#132B1D',
    borderWidth: 1,
    borderColor: '#1E462E',
    alignItems: 'center',
  },
  saveModalBtnText: {
    color: '#81C995',
    fontWeight: '800',
    fontSize: 12,
  },
  serialConsoleCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#05080C',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#1E242C',
    padding: 16,
  },
  serialConsoleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E242C',
  },
  serialConsoleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  serialConsoleDot: {
    color: '#81C995',
    fontSize: 12,
  },
  serialConsoleTitle: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: fonts.mono,
  },
  serialTerminalScreen: {
    backgroundColor: '#05080C',
    borderRadius: 8,
    padding: 10,
    minHeight: 160,
  },
  serialConsoleBody: {
    maxHeight: 220,
  },
  serialConsoleContent: {
    gap: 6,
  },
  serialConsoleLine: {
    fontSize: 10,
    fontFamily: fonts.mono,
    lineHeight: 16,
  },
  serialConsoleGreen: {
    color: '#81C995',
    fontFamily: fonts.mono,
  },
  serialConsoleWhite: {
    color: '#E2E8F0',
    fontFamily: fonts.mono,
  },
  serialConsolePromptRow: {
    marginTop: 8,
  },
  serialConsolePromptUser: {
    color: '#81C995',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: fonts.mono,
  },
  serialConsoleCursor: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: fonts.mono,
  },
  serialConsoleCloseBtn: {
    marginTop: 14,
    backgroundColor: '#1E242C',
    borderWidth: 1,
    borderColor: '#282E38',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  serialConsoleCloseBtnText: {
    color: '#E2E8F0',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: fonts.mono,
  },
});
