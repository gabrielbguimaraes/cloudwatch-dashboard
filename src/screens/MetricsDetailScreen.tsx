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
import { useCloud } from '../context/CloudContext';
import { CloudLogo } from '../components/common/CloudLogo';
import { CLOUD_PALETTES, NEUTRAL_THEME } from '../theme/tokens';
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

  // Sincronizacao automatica com route.params?.selectedInstanceId
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

  // Instancia ativa viva
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
  const activePalette = CLOUD_PALETTES[activeInstance.provider] || CLOUD_PALETTES.OCI;

  // Grafico vetorial de CPU proporcional a carga real
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

  // Console de auditoria filtrado para a maquina ativa
  const logs = useMemo(() => {
    const raw = generateSimulatedLogs(activeInstance.id);
    if (logFilter === 'ALL') return raw;
    return raw.filter((l) => l.severity === logFilter);
  }, [activeInstance.id, logFilter]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'RUNNING':
      case 'HEALTHY':
        return NEUTRAL_THEME.statusRunning;
      case 'REBOOTING':
      case 'WARNING':
      case 'DEGRADED':
        return NEUTRAL_THEME.statusDegraded;
      case 'STOPPED':
      case 'CRITICAL':
      default:
        return NEUTRAL_THEME.statusStopped;
    }
  };

  const statusStyle = getStatusStyle(activeInstance.status);

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
      Alert.alert('Erro ao Exportar PDF', error?.message || 'Falha ao gerar relatorio PDF.');
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handlePin = () => {
    togglePin(activeInstance.id);
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
        'VM.Standard.A1.Flex'
    );
    setIsEditModalVisible(true);
  };

  const handleSaveEdit = () => {
    if (!editName.trim()) {
      Alert.alert('Nome Invalido', 'O nome da maquina nao pode ficar em branco.');
      return;
    }
    editInstance(activeInstance.id, editName.trim(), editShape.trim());
    setIsEditModalVisible(false);
  };

  const handleDelete = () => {
    Alert.alert(
      'Encerrar Servidor',
      'Tem certeza que deseja terminar esta instancia permanentemente?',
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
        {/* Header com Navegacao de Retorno */}
        <View style={styles.navHeader}>
          <TouchableOpacity style={styles.navBackBtn} onPress={() => navigation.goBack()}>
            <Text style={styles.navBackIcon}>{'<'}</Text>
            <Text style={styles.navBackText}>Voltar</Text>
          </TouchableOpacity>

          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusStyle.bg, borderColor: statusStyle.border },
            ]}
          >
            <Text style={[styles.statusBadgeText, { color: statusStyle.text }]}>
              {activeInstance.status}
            </Text>
          </View>
        </View>

        {/* Seletor Horizontal de Instancias (Carrossel Picker) */}
        <View style={styles.pickerSection}>
          <Text style={styles.pickerSectionTitle}>SELETOR DE INSTANCIAS CONECTADAS</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.pickerScroll}
          >
            {resources.map((inst) => {
              const isSelected = activeInstance.id === inst.id;
              const pTheme = CLOUD_PALETTES[inst.provider] || CLOUD_PALETTES.OCI;
              const dotColor =
                inst.status === 'HEALTHY' || inst.lifecycleState === 'RUNNING'
                  ? NEUTRAL_THEME.statusRunning.text
                  : inst.status === 'WARNING' || inst.status === 'REBOOTING'
                    ? NEUTRAL_THEME.statusDegraded.text
                    : NEUTRAL_THEME.statusStopped.text;

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
                  <View style={[styles.instanceChipDot, { backgroundColor: dotColor }]} />
                  <Text
                    style={[
                      styles.instanceChipName,
                      isSelected && { color: '#E8EAED', fontWeight: '800' },
                    ]}
                    numberOfLines={1}
                  >
                    {inst.name}
                  </Text>
                  <Text
                    style={[
                      styles.instanceChipCpu,
                      isSelected && { color: pTheme.primary, fontWeight: '800' },
                    ]}
                  >
                    {inst.metricsSummary?.cpuPercent ?? 0}%
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Metadados e Titulo da Instancia Ativa */}
        <View style={styles.metaSection}>
          <View
            style={[
              styles.providerPill,
              {
                backgroundColor: activePalette.badgeBg,
                borderColor: activePalette.borderFocus,
              },
            ]}
          >
            <CloudLogo provider={activeInstance.provider} size={14} />
            <Text style={[styles.providerPillText, { color: activePalette.badgeText }]}>
              {activePalette.name}
            </Text>
          </View>

          <Text style={styles.resourceTitle}>{activeInstance.name}</Text>
          <Text style={styles.resourceOcid} numberOfLines={1}>
            {activeInstance.ocid || activeInstance.arn || activeInstance.id}
          </Text>
        </View>

        {/* Grafico Vetorial de Desempenho em Tempo Real */}
        <View style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View style={styles.chartTitleRow}>
              <View
                style={[
                  styles.chartDot,
                  {
                    backgroundColor:
                      (activeInstance.metricsSummary?.cpuPercent ?? 0) > 85
                        ? NEUTRAL_THEME.statusStopped.text
                        : activePalette.primary,
                  },
                ]}
              />
              <Text style={styles.chartTitle}>Uso de CPU em Tempo Real (%)</Text>
            </View>
            <Text
              style={[
                styles.chartPeak,
                (activeInstance.metricsSummary?.cpuPercent ?? 0) > 85 && {
                  color: NEUTRAL_THEME.statusStopped.text,
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
                            ? NEUTRAL_THEME.statusStopped.text
                            : NEUTRAL_THEME.statusRunning.text,
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

        {/* Botao Expansivel: Console Serial Linux Emulado */}
        <TouchableOpacity
          style={styles.serialConsoleBtn}
          onPress={() => setIsSerialConsoleOpen(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.serialConsoleBtnIcon}>{'>_'}</Text>
          <Text style={styles.serialConsoleBtnText}>Abrir Console Serial da VM</Text>
        </TouchableOpacity>

        {/* 4 Metricas Chave do Recurso */}
        <View style={styles.metricsGrid}>
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>CONSUMO ATUAL</Text>
            <Text
              style={[
                styles.metricValue,
                (activeInstance.metricsSummary?.cpuPercent ?? 0) > 85
                  ? { color: NEUTRAL_THEME.statusStopped.text }
                  : { color: NEUTRAL_THEME.statusRunning.text },
              ]}
            >
              {activeInstance.metricsSummary?.cpuPercent ?? 0}% CPU
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>MEMORIA ALOCADA</Text>
            <Text style={styles.metricValue}>
              {activeInstance.metricsSummary?.memoryPercent || 48}% RAM
            </Text>
          </View>

          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>LATENCIA DE I/O</Text>
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
                  ? { color: NEUTRAL_THEME.statusDegraded.text }
                  : { color: NEUTRAL_THEME.statusRunning.text },
              ]}
            >
              {activeInstance.availabilitySla}%
            </Text>
          </View>
        </View>

        {/* Console de Auditoria e Logs Filtrado para a Maquina Ativa */}
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
                      log.severity === 'ERROR' && { color: NEUTRAL_THEME.statusStopped.text },
                      log.severity === 'WARN' && { color: NEUTRAL_THEME.statusDegraded.text },
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

        {/* Controles de Ciclo de Vida (Sem Emojis) */}
        <View style={styles.lifecycleCard}>
          <Text style={styles.lifecycleTitle}>CONTROLES DE CICLO DE VIDA</Text>
          <View style={styles.lifecycleButtonsRow}>
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
                <ActivityIndicator size="small" color="#38BDF8" />
              ) : (
                <Text style={styles.lifecycleBtnRestartText}>Reiniciar</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.lifecycleBtn, styles.lifecycleBtnEdit]}
              onPress={handleOpenEdit}
              activeOpacity={0.7}
            >
              <Text style={styles.lifecycleBtnEditText}>Editar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.lifecycleBtn, styles.lifecycleBtnDelete]}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Text style={styles.lifecycleBtnDeleteText}>Excluir</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Acoes: PDF & Pin (Sem Emojis) */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionBtnPdf, isExportingPdf && { opacity: 0.7 }]}
            onPress={handleExportPdf}
            disabled={isExportingPdf}
          >
            {isExportingPdf ? (
              <ActivityIndicator size="small" color="#81C995" />
            ) : (
              <Text style={styles.actionBtnPdfText}>Exportar Relatorio PDF</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtnPin, isPinned && styles.actionBtnPinActive]}
            onPress={handlePin}
          >
            <Text
              style={[
                styles.actionBtnPinText,
                isPinned && styles.actionBtnPinTextActive,
              ]}
            >
              {isPinned ? 'Fixado no Topo' : 'Fixar no Topo'}
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
              <Text style={styles.serialConsoleTitle}>Console Serial Linux (ttyS0)</Text>
              <TouchableOpacity
                onPress={() => setIsSerialConsoleOpen(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.modalCloseText}>FECHAR</Text>
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

      {/* Modal: Edicao de Nome e Shape da Instancia (Sem Emojis) */}
      <Modal
        visible={isEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsEditModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.editModalCard}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Editar Instancia</Text>
              <TouchableOpacity
                onPress={() => setIsEditModalVisible(false)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.modalCloseText}>FECHAR</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>NOME DO SERVIDOR</Text>
              <TextInput
                style={styles.formInput}
                value={editName}
                onChangeText={setEditName}
                placeholder="Nome da instancia"
                placeholderTextColor="#5F6368"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>ARQUITETURA / SHAPE</Text>
              <TextInput
                style={styles.formInput}
                value={editShape}
                onChangeText={setEditShape}
                placeholder="Shape (ex: VM.Standard.A1.Flex)"
                placeholderTextColor="#5F6368"
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
                <Text style={styles.saveModalBtnText}>Salvar Alteracoes</Text>
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
    color: '#9AA0A6',
    fontSize: 14,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    color: '#E8EAED',
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
    fontSize: 14,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  navBackText: {
    color: '#9AA0A6',
    fontSize: 12,
    fontWeight: '600',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    borderWidth: 1,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  pickerSection: {
    marginTop: 14,
    marginBottom: 4,
  },
  pickerSectionTitle: {
    color: '#9AA0A6',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    borderRadius: 8,
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
    color: '#9AA0A6',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    maxWidth: 130,
  },
  instanceChipCpu: {
    color: '#5F6368',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  metaSection: {
    marginTop: 12,
  },
  providerPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 6,
  },
  providerPillText: {
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  resourceTitle: {
    color: '#E8EAED',
    fontSize: 18,
    fontWeight: '800',
  },
  resourceOcid: {
    color: '#5F6368',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    color: '#E8EAED',
    fontSize: 11,
    fontWeight: '700',
  },
  chartPeak: {
    color: '#81C995',
    fontSize: 11,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    borderRadius: 2,
    minHeight: 6,
    opacity: 0.9,
  },
  barLabel: {
    color: '#5F6368',
    fontSize: 7,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginTop: 4,
  },
  serialConsoleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#05080C',
    borderWidth: 1,
    borderColor: '#1E242C',
    borderRadius: 8,
    paddingVertical: 10,
    marginTop: 10,
    gap: 8,
  },
  serialConsoleBtnIcon: {
    color: '#81C995',
    fontSize: 12,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  serialConsoleBtnText: {
    color: '#E8EAED',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    borderRadius: 10,
    padding: 10,
  },
  metricLabel: {
    color: '#9AA0A6',
    fontSize: 8,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  metricValue: {
    color: '#E8EAED',
    fontSize: 13,
    fontWeight: '800',
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logFilters: {
    flexDirection: 'row',
    gap: 8,
  },
  filterTag: {
    color: '#5F6368',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  filterTagActive: {
    color: '#81C995',
    fontWeight: '800',
  },
  logsTerminal: {
    backgroundColor: '#05080C',
    borderWidth: 1,
    borderColor: '#1E242C',
    borderRadius: 10,
    padding: 10,
    gap: 8,
  },
  emptyLogsText: {
    color: '#5F6368',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logTime: {
    color: '#5F6368',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  logMsg: {
    color: '#E8EAED',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPdfText: {
    color: '#81C995',
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtnPin: {
    flex: 1,
    backgroundColor: '#181C22',
    borderWidth: 1,
    borderColor: '#282E38',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnPinText: {
    color: '#E8EAED',
    fontSize: 11,
    fontWeight: '700',
  },
  actionBtnPinActive: {
    backgroundColor: '#20242C',
    borderColor: '#81C995',
  },
  actionBtnPinTextActive: {
    color: '#81C995',
  },
  lifecycleCard: {
    marginTop: 16,
    backgroundColor: '#181C22',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#282E38',
    padding: 12,
  },
  lifecycleTitle: {
    color: '#9AA0A6',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 10,
    letterSpacing: 0.5,
  },
  lifecycleButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  lifecycleBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
  },
  lifecycleBtnRestart: {
    backgroundColor: '#0B2538',
    borderColor: '#164E63',
  },
  lifecycleBtnEdit: {
    backgroundColor: '#20242C',
    borderColor: '#3C4043',
  },
  lifecycleBtnDelete: {
    backgroundColor: '#2D1515',
    borderColor: '#4D1F1F',
  },
  lifecycleBtnDisabled: {
    opacity: 0.7,
  },
  lifecycleBtnRestartText: {
    color: '#38BDF8',
    fontSize: 11,
    fontWeight: '700',
  },
  lifecycleBtnEditText: {
    color: '#9AA0A6',
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
    backgroundColor: '#1A1D24',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2D3139',
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
    color: '#E8EAED',
    fontSize: 14,
    fontWeight: '800',
  },
  modalCloseText: {
    color: '#9AA0A6',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    color: '#9AA0A6',
    fontSize: 9,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#0F1318',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#282E38',
    color: '#E8EAED',
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    backgroundColor: '#282E38',
    alignItems: 'center',
  },
  cancelModalBtnText: {
    color: '#9AA0A6',
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
  serialConsoleTitle: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
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
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    lineHeight: 16,
  },
  serialConsoleGreen: {
    color: '#81C995',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  serialConsoleWhite: {
    color: '#E8EAED',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  serialConsolePromptRow: {
    marginTop: 8,
  },
  serialConsolePromptUser: {
    color: '#81C995',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  serialConsoleCursor: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '900',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  serialConsoleCloseBtn: {
    marginTop: 14,
    backgroundColor: '#20242C',
    borderWidth: 1,
    borderColor: '#2D3139',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
  },
  serialConsoleCloseBtnText: {
    color: '#E8EAED',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
