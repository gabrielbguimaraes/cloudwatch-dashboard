import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  RefreshControl,
  LayoutAnimation,
  Platform,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useCloud } from '../context/CloudContext';
import { useAuth } from '../context/AuthContext';
import { CloudLogo } from '../components/common/CloudLogo';
import { InstanceActionSheet } from '../components/InstanceActionSheet';
import { Toast } from '../components/common/Toast';
import { CLOUD_PALETTES, NEUTRAL_THEME } from '../theme/tokens';
import { Print, sharePdfAsync } from '../services/pdfService';
import type { CloudResource } from '../types';
import type { SupportedCloud } from '../types/auth';

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    filteredResources,
    pinnedResources,
    kpis,
    refreshMetrics,
    restartInstance,
    deleteInstance,
    editInstance,
    provisionInstance,
    setSelectedResource,
    injectChaosCpuOverload,
    crashPrimaryInstance,
    restoreInfrastructure,
  } = useCloud();

  const { activeProvider, cloudAccounts, switchActiveProvider, linkCloudProvider } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedInstanceForAction, setSelectedInstanceForAction] = useState<CloudResource | null>(null);
  const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);

  // Modal para vincular nuvem diretamente do Dock
  const [quickLinkModalProvider, setQuickLinkModalProvider] = useState<SupportedCloud | null>(null);
  const [quickInputKey, setQuickInputKey] = useState('');
  const [quickInputSecret, setQuickInputSecret] = useState('');

  // Modal do Chaos Monkey corporativo (sem emojis)
  const [isChaosModalVisible, setIsChaosModalVisible] = useState(false);

  const activePalette = CLOUD_PALETTES[activeProvider] || CLOUD_PALETTES.OCI;
  const activeAccountConfig = cloudAccounts[activeProvider];

  const handleRefresh = async () => {
    setRefreshing(true);
    refreshMetrics();
    setRefreshing(false);
    setToastMessage('Metricas de telemetria sincronizadas');
  };

  const handleExportPdf = async () => {
    try {
      const target = filteredResources[0];
      if (!target) {
        setToastMessage('Nenhuma instancia disponivel para relatorio');
        return;
      }

      setToastMessage('Gerando relatorio executivo PDF...');
      const html = Print.generateExecutiveReportHtml(target);
      const pdfResult = await Print.printToFileAsync({
        html,
        serverName: target.name,
        provider: target.provider,
        region: target.region,
        status: target.status,
        cpu: `${target.metricsSummary?.cpuPercent ?? 12}%`,
        memory: `${target.metricsSummary?.memoryPercent ?? 45}%`,
        ocid: target.ocid || target.arn || target.id,
        sla: `${kpis.uptimeSla}%`,
        auditor: 'Joao Gabriel Barros Guimaraes - FATEC 4DSM',
      });

      await sharePdfAsync(pdfResult.uri, `Relatorio Executivo - ${activePalette.name}`);
    } catch (err: any) {
      setToastMessage('Falha ao exportar relatorio PDF');
    }
  };

  const handleSelectCloud = async (cloud: SupportedCloud) => {
    const isConfigured = cloudAccounts[cloud]?.isConfigured;
    if (isConfigured) {
      const switched = await switchActiveProvider(cloud);
      if (switched) {
        setToastMessage(`Console alternado para ${cloud}`);
      } else {
        setToastMessage(`Autorizacao para ${cloud} cancelada`);
      }
    } else {
      // Abre modal para cadastrar credenciais na hora
      setQuickLinkModalProvider(cloud);
      setQuickInputKey('');
      setQuickInputSecret('');
    }
  };

  const handleSaveQuickLink = async () => {
    if (!quickLinkModalProvider) return;
    if (!quickInputKey.trim()) {
      Alert.alert('Atencao', 'Informe o identificador da conta.');
      return;
    }

    const provider = quickLinkModalProvider;
    const creds: Record<string, string> = {
      accountIdentifier: quickInputKey.trim(),
      accessKey: quickInputSecret.trim(),
      region: provider === 'OCI' ? 'sa-saopaulo-1' : provider === 'AWS' ? 'us-east-1' : 'southamerica-east1',
    };

    setQuickLinkModalProvider(null);

    Alert.alert(
      'Autenticacao Biometrica',
      `Deseja ativar autenticacao biometrica nativa para a conta ${provider}?`,
      [
        {
          text: 'Pular',
          style: 'cancel',
          onPress: async () => {
            await linkCloudProvider(provider, creds, false);
            await switchActiveProvider(provider);
            setToastMessage(`Conta ${provider} vinculada com sucesso`);
          },
        },
        {
          text: 'Ativar',
          onPress: async () => {
            await linkCloudProvider(provider, creds, true);
            await switchActiveProvider(provider);
            setToastMessage(`Conta ${provider} vinculada com biometria ativa`);
          },
        },
      ]
    );
  };

  const handleOpenActionSheet = (resource: CloudResource) => {
    setSelectedInstanceForAction(resource);
    setIsActionSheetVisible(true);
  };

  const handleCardPress = (resource: CloudResource) => {
    setSelectedResource(resource);
    navigation.navigate('MetricsDetail', {
      resourceId: resource.id,
      selectedInstanceId: resource.id,
    });
  };

  // Helper para cor do ponto de semaforo de 8x8 sem emojis
  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'RUNNING':
      case 'HEALTHY':
        return NEUTRAL_THEME.statusRunning.text; // #81C995
      case 'REBOOTING':
      case 'WARNING':
      case 'DEGRADED':
        return NEUTRAL_THEME.statusDegraded.text; // #FDD663
      case 'STOPPED':
      case 'CRITICAL':
      default:
        return NEUTRAL_THEME.statusStopped.text; // #F28B82
    }
  };

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
        {/* Cabecalho Dinamico MD3 */}
        <View
          style={[
            styles.headerCurved,
            {
              backgroundColor: activePalette.surfaceHeader,
              borderBottomColor: activePalette.borderFocus,
            },
          ]}
        >
          <View style={styles.headerTopRow}>
            <View style={styles.headerLeft}>
              <CloudLogo provider={activeProvider} size={32} />
              <View style={styles.headerMeta}>
                <Text style={styles.providerName}>{activePalette.name}</Text>
                <View style={styles.regionBadge}>
                  <Text style={styles.regionText}>
                    {activeAccountConfig?.region || activePalette.defaultRegion}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.actionGroup}>
              <TouchableOpacity
                style={styles.chaosBtn}
                onPress={() => setIsChaosModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.chaosBtnText} numberOfLines={1}>
                  Incidentes
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pdfBtn}
                onPress={handleExportPdf}
                activeOpacity={0.7}
              >
                <Text style={styles.pdfBtnText} numberOfLines={1}>
                  Relatorio PDF
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* SLA e KPIs de Saude */}
          <View style={styles.kpiContainer}>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiBoxLabel}>DISPONIBILIDADE SLA</Text>
              <Text style={[styles.kpiBoxValue, { color: activePalette.badgeText }]}>
                {kpis.uptimeSla}%
              </Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiBoxLabel}>ATIVAS / TOTAL</Text>
              <Text style={styles.kpiBoxValue}>
                {kpis.healthy} / {kpis.total}
              </Text>
            </View>
            <View style={styles.kpiBox}>
              <Text style={styles.kpiBoxLabel}>ANOMALIAS</Text>
              <Text
                style={[
                  styles.kpiBoxValue,
                  kpis.critical > 0 && { color: NEUTRAL_THEME.statusStopped.text },
                ]}
              >
                {kpis.critical + kpis.warning}
              </Text>
            </View>
          </View>
        </View>

        {/* Floating Dock: Seletor Central de Nuvem (Segmented Control) */}
        <View style={styles.dockWrapper}>
          <View style={styles.dockContainer}>
            {(['OCI', 'AWS', 'GCP'] as SupportedCloud[]).map((cloud) => {
              const isSelected = activeProvider === cloud;
              const isConfigured = cloudAccounts[cloud]?.isConfigured;

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
                    !isConfigured && styles.dockChipUnconfigured,
                  ]}
                  onPress={() => handleSelectCloud(cloud)}
                  activeOpacity={0.7}
                >
                  <CloudLogo provider={cloud} size={18} />
                  <Text
                    style={[
                      styles.dockChipText,
                      isSelected && { color: '#E8EAED', fontWeight: '800' },
                      !isConfigured && styles.dockChipTextFaded,
                    ]}
                  >
                    {cloud}
                  </Text>
                  {!isConfigured && (
                    <View style={styles.unconfiguredBadge}>
                      <Text style={styles.unconfiguredBadgeText}>+</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Botao Corporativo de Provisionamento */}
        <View style={styles.provisionBar}>
          <TouchableOpacity
            style={styles.provisionButton}
            onPress={() => {
              const newInst = provisionInstance();
              setToastMessage(`Instancia ${newInst.name} provisionada em ${activeProvider}`);
            }}
            activeOpacity={0.8}
          >
            <Text style={styles.provisionButtonText}>+ Provisionar Servidor ({activeProvider})</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de Recursos Corporativos */}
        <View style={styles.resourceSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              INSTANCIAS CONECTADAS ({filteredResources.length})
            </Text>
            <Text style={styles.sectionSub}>Atualizacao automatica</Text>
          </View>

          {filteredResources.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                Nenhum servidor monitorado nesta conta de nuvem.
              </Text>
              <TouchableOpacity
                style={styles.emptyAddBtn}
                onPress={() => provisionInstance()}
              >
                <Text style={styles.emptyAddBtnText}>Provisionar Primeiro Servidor</Text>
              </TouchableOpacity>
            </View>
          ) : (
            filteredResources.map((resource) => {
              const cpuPercent = resource.metricsSummary?.cpuPercent ?? 0;
              const dotColor = getStatusDotColor(resource.status);
              const shapeText =
                (resource.metadata as any)?.shape ||
                resource.tags?.Shape ||
                (resource.provider === 'OCI' ? 'VM.Standard.A1.Flex' : 't3.medium');
              const privateIp = (resource.metadata as any)?.privateIp || '10.0.0.4';

              return (
                <TouchableOpacity
                  key={resource.id}
                  style={styles.resourceCard}
                  onPress={() => handleCardPress(resource)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderLeft}>
                      {/* Ponto de Semaforo Geometrico 8x8 */}
                      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {resource.name}
                      </Text>
                    </View>

                    {/* Botao de Acao Contextual [...] */}
                    <TouchableOpacity
                      style={styles.moreActionBtn}
                      onPress={() => handleOpenActionSheet(resource)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.moreActionText}>...</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.metaRow}>
                    <Text style={styles.metaMono}>{shapeText}</Text>
                    <Text style={styles.metaSeparator}>|</Text>
                    <Text style={styles.metaMono}>{privateIp}</Text>
                  </View>

                  {/* Barra de Progresso Linear Fina de CPU */}
                  <View style={styles.cpuProgressContainer}>
                    <View style={styles.cpuLabelRow}>
                      <Text style={styles.cpuLabel}>USO DE CPU</Text>
                      <Text style={[styles.cpuValue, { color: dotColor }]}>
                        {cpuPercent}%
                      </Text>
                    </View>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(100, Math.max(2, cpuPercent))}%`,
                            backgroundColor: dotColor,
                          },
                        ]}
                      />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Bottom Sheet Corporativo de Ciclo de Vida */}
      <InstanceActionSheet
        visible={isActionSheetVisible}
        instance={selectedInstanceForAction}
        onClose={() => setIsActionSheetVisible(false)}
        onRestart={(id) => restartInstance(id)}
        onEdit={(id, newName, shape) => editInstance(id, newName, shape)}
        onDelete={(id) => deleteInstance(id)}
        onShowToast={(msg) => setToastMessage(msg)}
      />

      {/* Modal de Vinculacao Rapida de Nuvem */}
      <Modal
        visible={quickLinkModalProvider !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setQuickLinkModalProvider(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.quickModalCard}>
            <Text style={styles.quickModalTitle}>
              Vincular Conta: {quickLinkModalProvider}
            </Text>
            <Text style={styles.quickModalSubtitle}>
              Insira as credenciais para autorizar a governanca nesta nuvem:
            </Text>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                {quickLinkModalProvider === 'OCI'
                  ? 'TENANCY OCID'
                  : quickLinkModalProvider === 'AWS'
                    ? 'AWS ACCESS KEY ID'
                    : 'GCP PROJECT ID'}
              </Text>
              <TextInput
                style={styles.formInput}
                value={quickInputKey}
                onChangeText={setQuickInputKey}
                placeholder="Identificador da conta"
                placeholderTextColor="#5F6368"
                autoCapitalize="none"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>
                {quickLinkModalProvider === 'AWS' ? 'SECRET ACCESS KEY' : 'API KEY / TOKEN'}
              </Text>
              <TextInput
                style={styles.formInput}
                value={quickInputSecret}
                onChangeText={setQuickInputSecret}
                placeholder="Chave secreta de operacao"
                placeholderTextColor="#5F6368"
                secureTextEntry
              />
            </View>

            <View style={styles.quickModalActions}>
              <TouchableOpacity
                style={styles.quickCancelBtn}
                onPress={() => setQuickLinkModalProvider(null)}
              >
                <Text style={styles.quickCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.quickSaveBtn} onPress={handleSaveQuickLink}>
                <Text style={styles.quickSaveText}>Salvar e Vincular</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Chaos Monkey Corporativo (Sem Emojis) */}
      <Modal
        visible={isChaosModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsChaosModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.chaosCard}>
            <View style={styles.chaosHeader}>
              <Text style={styles.chaosTitle}>Injetor de Incidentes (Chaos Test)</Text>
              <TouchableOpacity onPress={() => setIsChaosModalVisible(false)}>
                <Text style={styles.modalCloseText}>FECHAR</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.chaosDesc}>
              Simule variacoes operacionais de contingencia em tempo real na nuvem {activeProvider}:
            </Text>

            <View style={styles.chaosActionList}>
              <TouchableOpacity
                style={styles.chaosItem}
                onPress={() => {
                  injectChaosCpuOverload();
                  setIsChaosModalVisible(false);
                  setToastMessage('Sobrecarga de CPU (98%) injetada');
                }}
              >
                <Text style={styles.chaosItemTitle}>Injetar Sobrecarga de CPU (98%)</Text>
                <Text style={styles.chaosItemSub}>
                  Dispara vibracao haptica dupla e transita status para CRITICAL
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chaosItem, styles.chaosItemCrash]}
                onPress={() => {
                  crashPrimaryInstance();
                  setIsChaosModalVisible(false);
                  setToastMessage('Instancia principal desconectada (0% CPU)');
                }}
              >
                <Text style={[styles.chaosItemTitle, styles.chaosCrashText]}>
                  Derrubar Instancia Principal (STOPPED)
                </Text>
                <Text style={styles.chaosItemSub}>
                  Simula falha grave de host e zera consumo de CPU
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.chaosItem, styles.chaosItemRestore]}
                onPress={() => {
                  restoreInfrastructure();
                  setIsChaosModalVisible(false);
                  setToastMessage('Infraestrutura normalizada com 100% de saude');
                }}
              >
                <Text style={[styles.chaosItemTitle, styles.chaosRestoreText]}>
                  Restaurar Infraestrutura (HEALTHY)
                </Text>
                <Text style={styles.chaosItemSub}>
                  Normaliza todos os nos para operacao estavel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Toast Feedback */}
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />
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
  headerCurved: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    borderBottomWidth: 1,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerMeta: {
    gap: 2,
  },
  providerName: {
    color: '#E8EAED',
    fontSize: 16,
    fontWeight: '800',
  },
  regionBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#282E38',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  regionText: {
    color: '#9AA0A6',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontWeight: '700',
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  chaosBtn: {
    height: 36,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#20242C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chaosBtnText: {
    color: '#F28B82',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  pdfBtn: {
    height: 36,
    paddingHorizontal: 12,
    paddingVertical: 0,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: '#20242C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfBtnText: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    textAlign: 'center',
  },
  kpiContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  kpiBox: {
    flex: 1,
    backgroundColor: '#181C22',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#282E38',
  },
  kpiBoxLabel: {
    color: '#9AA0A6',
    fontSize: 8,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 4,
  },
  kpiBoxValue: {
    color: '#E8EAED',
    fontSize: 16,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dockWrapper: {
    paddingHorizontal: 20,
    marginTop: -12,
    marginBottom: 12,
  },
  dockContainer: {
    flexDirection: 'row',
    backgroundColor: '#181C22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#282E38',
    padding: 4,
    gap: 6,
  },
  dockChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    gap: 6,
  },
  dockChipUnconfigured: {
    borderStyle: 'dashed',
    borderColor: '#3C4043',
    opacity: 0.6,
  },
  dockChipText: {
    color: '#9AA0A6',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  dockChipTextFaded: {
    color: '#5F6368',
  },
  unconfiguredBadge: {
    backgroundColor: '#282E38',
    borderRadius: 10,
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unconfiguredBadgeText: {
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '800',
  },
  provisionBar: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  provisionButton: {
    backgroundColor: '#20242C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3C4043',
    paddingVertical: 10,
    alignItems: 'center',
  },
  provisionButtonText: {
    color: '#E8EAED',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  resourceSection: {
    paddingHorizontal: 20,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 0.5,
  },
  sectionSub: {
    color: '#5F6368',
    fontSize: 9,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  emptyContainer: {
    backgroundColor: '#181C22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#282E38',
    padding: 24,
    alignItems: 'center',
  },
  emptyText: {
    color: '#9AA0A6',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 12,
  },
  emptyAddBtn: {
    backgroundColor: '#282E38',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  emptyAddBtnText: {
    color: '#E8EAED',
    fontSize: 11,
    fontWeight: '700',
  },
  resourceCard: {
    backgroundColor: '#181C22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#282E38',
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
    gap: 8,
    flex: 1,
    marginRight: 8,
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
  moreActionBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: '#20242C',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#2D3139',
  },
  moreActionText: {
    color: '#9AA0A6',
    fontSize: 12,
    fontWeight: '900',
    lineHeight: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  metaMono: {
    color: '#9AA0A6',
    fontSize: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  metaSeparator: {
    color: '#3C4043',
    fontSize: 10,
  },
  cpuProgressContainer: {
    gap: 4,
  },
  cpuLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cpuLabel: {
    color: '#5F6368',
    fontSize: 9,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  cpuValue: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  progressBarTrack: {
    height: 4,
    backgroundColor: '#0F1318',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    padding: 20,
  },
  quickModalCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2D3139',
    padding: 18,
  },
  quickModalTitle: {
    color: '#E8EAED',
    fontSize: 15,
    fontWeight: '800',
  },
  quickModalSubtitle: {
    color: '#9AA0A6',
    fontSize: 11,
    marginTop: 4,
    marginBottom: 14,
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
  quickModalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  quickCancelBtn: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#282E38',
    borderRadius: 8,
    alignItems: 'center',
  },
  quickCancelText: {
    color: '#9AA0A6',
    fontSize: 12,
    fontWeight: '700',
  },
  quickSaveBtn: {
    flex: 1.4,
    paddingVertical: 10,
    backgroundColor: '#132B1D',
    borderWidth: 1,
    borderColor: '#1E462E',
    borderRadius: 8,
    alignItems: 'center',
  },
  quickSaveText: {
    color: '#81C995',
    fontSize: 12,
    fontWeight: '800',
  },
  chaosCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#2D3139',
    padding: 18,
  },
  chaosHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  chaosTitle: {
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
  chaosDesc: {
    color: '#9AA0A6',
    fontSize: 11,
    marginBottom: 14,
    lineHeight: 16,
  },
  chaosActionList: {
    gap: 10,
  },
  chaosItem: {
    backgroundColor: '#20242C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D3139',
    padding: 10,
  },
  chaosItemCrash: {
    borderColor: '#4D1F1F',
  },
  chaosItemRestore: {
    borderColor: '#1E462E',
  },
  chaosItemTitle: {
    color: '#E8EAED',
    fontSize: 12,
    fontWeight: '700',
  },
  chaosCrashText: {
    color: '#F28B82',
  },
  chaosRestoreText: {
    color: '#81C995',
  },
  chaosItemSub: {
    color: '#5F6368',
    fontSize: 9,
    marginTop: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});
