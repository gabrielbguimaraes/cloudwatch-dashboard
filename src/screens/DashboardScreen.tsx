/**
 * DashboardScreen - Console Executivo de Monitoramento Multi-Cloud
 * Progressive Disclosure Nivel 1 (Cabecalho Executivo) & Nivel 2 (Cards Minimalistas)
 * Zero emojis, zero jargões internos de engenharia, estetica Google Cloud / MD3.
 */

import React, { useState } from 'react';
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
import { SerialConsoleModal } from '../components/SerialConsoleModal';
import { Toast } from '../components/common/Toast';
import { CLOUD_PALETTES, NEUTRAL_THEME } from '../theme/tokens';
import { Print, sharePdfAsync } from '../services/pdfService';
import type { CloudResource } from '../types';
import type { SupportedCloud } from '../types/auth';

export const DashboardScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  const {
    filteredResources,
    kpis,
    refreshMetrics,
    restartInstance,
    deleteInstance,
    editInstance,
    provisionInstance,
    addCustomResource,
    setSelectedResource,
    injectChaosCpuOverload,
    crashPrimaryInstance,
    restoreInfrastructure,
    telemetrySource,
    isLiveCloud,
  } = useCloud();

  const { activeProvider, cloudAccounts, switchActiveProvider, linkCloudProvider } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedInstanceForAction, setSelectedInstanceForAction] = useState<CloudResource | null>(null);
  const [isActionSheetVisible, setIsActionSheetVisible] = useState(false);

  // Terminal Serial Linux Emulado
  const [terminalInstance, setTerminalInstance] = useState<CloudResource | null>(null);
  const [isTerminalModalVisible, setIsTerminalModalVisible] = useState(false);

  // Modal para conectar conta de nuvem diretamente do Dock
  const [quickLinkModalProvider, setQuickLinkModalProvider] = useState<SupportedCloud | null>(null);
  const [quickInputKey, setQuickInputKey] = useState('');
  const [quickInputSecret, setQuickInputSecret] = useState('');

  // Modal Executivo de Simulacao de Carga e Resiliencia
  const [isStressModalVisible, setIsStressModalVisible] = useState(false);

  // Modal de Cadastro de Recurso OCI Real (Host/IP Zabbix)
  const [isAddResourceModalVisible, setIsAddResourceModalVisible] = useState(false);
  const [newResourceName, setNewResourceName] = useState('');
  const [newResourceShape, setNewResourceShape] = useState('VM.Standard.A1.Flex (Compute)');
  const [newResourcePublicIp, setNewResourcePublicIp] = useState('167.234.241.171');
  const [newResourcePrivateIp, setNewResourcePrivateIp] = useState('10.0.0.10');
  const [newResourceOcpus, setNewResourceOcpus] = useState('2');
  const [newResourceMemoryGb, setNewResourceMemoryGb] = useState('16');
  const [isSavingResource, setIsSavingResource] = useState(false);

  const activePalette = CLOUD_PALETTES[activeProvider] || CLOUD_PALETTES.OCI;
  const activeAccountConfig = cloudAccounts[activeProvider];

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshMetrics();
    setRefreshing(false);
    setToastMessage('Telemetria sincronizada com o provedor');
  };

  const handleExportPdf = async () => {
    try {
      const target = filteredResources[0];
      if (!target) {
        setToastMessage('Nenhuma instancia disponivel para relatorio');
        return;
      }

      setToastMessage('Gerando relatorio executivo em PDF...');
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

  const handleSaveNewResource = async () => {
    if (!newResourceName.trim()) {
      Alert.alert('Atenção', 'Informe o nome do recurso OCI.');
      return;
    }
    setIsSavingResource(true);
    try {
      await addCustomResource({
        name: newResourceName.trim(),
        provider: activeProvider,
        shape: newResourceShape,
        resourceType: newResourceShape.includes('Database')
          ? 'Autonomous Database'
          : newResourceShape.includes('VCN')
            ? 'VCN Gateway'
            : 'Compute Instance',
        publicIp: newResourcePublicIp.trim() || '167.234.241.171',
        privateIp: newResourcePrivateIp.trim() || '10.0.0.10',
        region: activeAccountConfig?.region || 'sa-saopaulo-1',
        ocpus: Number(newResourceOcpus) || 2,
        memoryGb: Number(newResourceMemoryGb) || 16,
      });
      setIsAddResourceModalVisible(false);
      const savedName = newResourceName.trim();
      setNewResourceName('');
      setToastMessage(`Recurso "${savedName}" cadastrado no monitoramento!`);
    } catch (err: any) {
      Alert.alert('Erro', 'Falha ao cadastrar recurso.');
    } finally {
      setIsSavingResource(false);
    }
  };

  const handleSelectCloud = async (cloud: SupportedCloud) => {
    const isConfigured = cloudAccounts[cloud]?.isConfigured;
    if (isConfigured) {
      const switched = await switchActiveProvider(cloud);
      if (switched) {
        setToastMessage(`Console alternado para ${cloud}`);
      } else {
        setToastMessage(`Autorizacao para ${cloud} pendente`);
      }
    } else {
      setQuickLinkModalProvider(cloud);
      setQuickInputKey('');
      setQuickInputSecret('');
    }
  };

  const handlePasteQuickConfig = () => {
    if (!quickLinkModalProvider) return;
    if (quickLinkModalProvider === 'OCI') {
      setQuickInputKey('ocid1.tenancy.oc1..aaaaaaaab1234567890');
      setQuickInputSecret('0e:ed:6e:d2:98:cf:84:1e:7d:b7:16:37:ef:8c:e1:59');
      setToastMessage('Perfil OCI de homologação aplicado');
    } else if (quickLinkModalProvider === 'AWS') {
      setQuickInputKey('AKIAIOSFODNN7EXAMPLE');
      setQuickInputSecret('wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY');
      setToastMessage('Perfil AWS de homologação aplicado');
    } else {
      setQuickInputKey('cloudwatch-prd-421');
      setQuickInputSecret('sa-cloudwatch@cloudwatch-prd-421.iam.gserviceaccount.com');
      setToastMessage('Perfil GCP de homologação aplicado');
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
            setToastMessage(`Conta ${provider} conectada com sucesso`);
          },
        },
        {
          text: 'Ativar',
          onPress: async () => {
            await linkCloudProvider(provider, creds, true);
            await switchActiveProvider(provider);
            setToastMessage(`Conta ${provider} conectada com biometria ativa`);
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
    handleOpenActionSheet(resource);
  };

  const handleNavigateToMetrics = (resource: CloudResource) => {
    setSelectedResource(resource);
    navigation.navigate('MetricsDetail', {
      resourceId: resource.id,
      selectedInstanceId: resource.id,
    });
  };

  const handleOpenTerminalFromSheet = (instance: CloudResource) => {
    setTerminalInstance(instance);
    setIsTerminalModalVisible(true);
  };

  const getStatusDotColor = (status: string) => {
    switch (status) {
      case 'RUNNING':
      case 'HEALTHY':
        return '#22C55E'; // Verde solido
      case 'REBOOTING':
      case 'WARNING':
      case 'DEGRADED':
        return '#F59E0B'; // Ambar solido
      case 'STOPPED':
      case 'CRITICAL':
      default:
        return '#EF4444'; // Vermelho solido
    }
  };

  // Frase diagnostica executiva do Nivel 1
  let diagnosticMessage = 'Todos os sistemas operacionais';
  let diagnosticColor = '#22C55E';
  if (kpis.critical > 0) {
    diagnosticMessage = 'Incidente crítico em andamento';
    diagnosticColor = '#EF4444';
  } else if (kpis.warning > 0) {
    diagnosticMessage = 'Atenção: sobrecarga moderada detectada';
    diagnosticColor = '#F59E0B';
  }

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
        {/* Nivel 1: Cabecalho Executivo Simplificado MD3 */}
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
                  {activePalette.name}
                </Text>
                {/* Badge discreto de conexao */}
                <View style={styles.connectionBadge}>
                  <View
                    style={[
                      styles.connectionDot,
                      { backgroundColor: isLiveCloud ? '#22C55E' : '#38BDF8' },
                    ]}
                  />
                  <Text style={styles.connectionText} numberOfLines={1}>
                    Conectado à {activeProvider} ({activeAccountConfig?.region || activePalette.defaultRegion})
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.actionGroup}>
              <TouchableOpacity
                style={styles.addResourceBtn}
                onPress={() => setIsAddResourceModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.addResourceBtnText} numberOfLines={1}>
                  + Recurso
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.stressBtn}
                onPress={() => setIsStressModalVisible(true)}
                activeOpacity={0.7}
              >
                <Text style={styles.stressBtnText} numberOfLines={1}>
                  Simular Carga
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pdfBtn}
                onPress={handleExportPdf}
                activeOpacity={0.7}
              >
                <Text style={styles.pdfBtnText} numberOfLines={1}>
                  Relatório PDF
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Resumo de Saude Limpo: SLA + Frase Diagnostica Executiva */}
          <View style={styles.healthSummaryCard}>
            <View style={styles.healthSummaryMain}>
              <Text style={styles.healthSlaValue}>{kpis.uptimeSla}% SLA</Text>
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
                <Text style={styles.healthCounterLabel}>OPERACIONAIS</Text>
              </View>
              <View style={styles.healthCounterItem}>
                <Text
                  style={[
                    styles.healthCounterNum,
                    (kpis.critical + kpis.warning) > 0 && { color: '#F59E0B' },
                    kpis.critical > 0 && { color: '#EF4444' },
                  ]}
                >
                  {kpis.critical + kpis.warning}
                </Text>
                <Text style={styles.healthCounterLabel}>ALERTAS</Text>
              </View>
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

        {/* Nivel 2: Lista de Cards de Servidor Minimalistas (4 Elementos Essenciais) */}
        <View style={styles.resourceSection}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              SERVIDORES MONITORADOS ({filteredResources.length})
            </Text>
            <Text style={styles.sectionSub}>Atualização Contínua</Text>
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

              return (
                <TouchableOpacity
                  key={resource.id}
                  style={styles.minimalCard}
                  onPress={() => handleCardPress(resource)}
                  activeOpacity={0.7}
                >
                  {/* Elemento 1, 2 e 4: Ponto Semaforico + Nome/Logo + Botao Opcoes */}
                  <View style={styles.cardHeaderRow}>
                    <View style={styles.cardHeaderLeft}>
                      {/* 1. Ponto Semaforico Solido */}
                      <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
                      {/* 2. Logo discreto e Nome da Instancia */}
                      <CloudLogo provider={resource.provider} size={15} />
                      <Text style={styles.cardTitle} numberOfLines={1}>
                        {resource.name}
                      </Text>
                    </View>

                    {/* 4. Botao de Opcoes (...) para abrir Bottom Sheet */}
                    <TouchableOpacity
                      style={styles.moreActionBtn}
                      onPress={() => handleOpenActionSheet(resource)}
                      hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                    >
                      <Text style={styles.moreActionText}>...</Text>
                    </TouchableOpacity>
                  </View>

                  {/* Elemento 3: Uma Unica Barra de Progresso Horizontal com Valor a Direita */}
                  <View style={styles.singleProgressBarContainer}>
                    <View style={styles.progressBarTrack}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {
                            width: `${Math.min(100, Math.max(3, cpuPercent))}%`,
                            backgroundColor: dotColor,
                          },
                        ]}
                      />
                    </View>
                    <Text style={[styles.cardCpuValue, { color: dotColor }]}>
                      {cpuPercent}% CPU
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>

      {/* Bottom Sheet de Detalhes Tecnicos e Ciclo de Vida */}
      <InstanceActionSheet
        visible={isActionSheetVisible}
        instance={selectedInstanceForAction}
        onClose={() => setIsActionSheetVisible(false)}
        onRestart={(id) => restartInstance(id)}
        onEdit={(id, newName, shape) => editInstance(id, newName, shape)}
        onDelete={(id) => deleteInstance(id)}
        onShowToast={(msg) => setToastMessage(msg)}
        onOpenTerminal={(inst) => handleOpenTerminalFromSheet(inst)}
        onStressTest={() => injectChaosCpuOverload()}
        onViewMetrics={(inst) => handleNavigateToMetrics(inst)}
      />

      {/* Console Serial Linux Emulado */}
      <SerialConsoleModal
        visible={isTerminalModalVisible}
        onClose={() => setIsTerminalModalVisible(false)}
        instance={terminalInstance}
        onRestartInstance={(id) => restartInstance(id)}
      />

      {/* Modal de Conectar Conta de Nuvem com Botao de Colar JSON Rapido */}
      <Modal
        visible={quickLinkModalProvider !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setQuickLinkModalProvider(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.quickModalCard}>
            <Text style={styles.quickModalTitle}>
              Conectar Conta: {quickLinkModalProvider}
            </Text>
            <Text style={styles.quickModalSubtitle}>
              Insira as credenciais para autorizar a observabilidade nesta nuvem:
            </Text>

            {/* Botao Discreto: Colar JSON de Configuracao Rapida */}
            <TouchableOpacity
              style={styles.pasteJsonBtn}
              onPress={handlePasteQuickConfig}
              activeOpacity={0.8}
            >
              <Text style={styles.pasteJsonBtnText}>Colar JSON de Configuração Rápida</Text>
            </TouchableOpacity>

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
                <Text style={styles.quickSaveText}>Salvar e Conectar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal de Cadastro de Recurso OCI Real (Host/IP Zabbix) */}
      <Modal
        visible={isAddResourceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsAddResourceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.addResourceModalCard}>
            <View style={styles.stressModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.stressModalTitle}>Cadastrar Recurso OCI</Text>
                <Text style={styles.addResourceSubtitle}>
                  Monitore recursos reais com IP público para sondagem Zabbix
                </Text>
              </View>
              <TouchableOpacity onPress={() => setIsAddResourceModalVisible(false)}>
                <Text style={styles.modalCloseText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Seletor Rapido de Tipo / Shape */}
            <Text style={styles.formLabel}>TIPO / SHAPE DO RECURSO</Text>
            <View style={styles.shapeSelectorRow}>
              {[
                'VM.Standard.A1.Flex (Compute)',
                'VM.Standard.E2.1.Micro',
                'Autonomous Database',
                'VCN / Load Balancer',
              ].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.shapePill,
                    newResourceShape === s && styles.shapePillActive,
                  ]}
                  onPress={() => {
                    setNewResourceShape(s);
                    if (s.includes('A1.Flex')) {
                      setNewResourceOcpus('4');
                      setNewResourceMemoryGb('24');
                    } else if (s.includes('Micro')) {
                      setNewResourceOcpus('1');
                      setNewResourceMemoryGb('1');
                    } else if (s.includes('Database')) {
                      setNewResourceOcpus('2');
                      setNewResourceMemoryGb('16');
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.shapePillText,
                      newResourceShape === s && styles.shapePillTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {s.split(' ')[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Nome do Recurso */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>NOME DO RECURSO OCI</Text>
              <TextInput
                style={styles.formInput}
                value={newResourceName}
                onChangeText={setNewResourceName}
                placeholder="Ex: vnic-sidebrain-prd ou db-oracle-prod"
                placeholderTextColor="#5F6368"
                autoCapitalize="none"
              />
            </View>

            {/* Endereco IP Publico para Sondagem Zabbix */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>ENDEREÇO IP PÚBLICO (SONDAGEM ZABBIX)</Text>
              <TextInput
                style={styles.formInput}
                value={newResourcePublicIp}
                onChangeText={setNewResourcePublicIp}
                placeholder="Ex: 167.234.241.171"
                placeholderTextColor="#5F6368"
                autoCapitalize="none"
              />
            </View>

            {/* Endereco IP Privado */}
            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>ENDEREÇO IP PRIVADO (VCN SUBNET)</Text>
              <TextInput
                style={styles.formInput}
                value={newResourcePrivateIp}
                onChangeText={setNewResourcePrivateIp}
                placeholder="Ex: 10.0.0.10"
                placeholderTextColor="#5F6368"
                autoCapitalize="none"
              />
            </View>

            {/* OCPUs e Memoria (GB) */}
            <View style={styles.formRowTwoCols}>
              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>OCPUS</Text>
                <TextInput
                  style={styles.formInput}
                  value={newResourceOcpus}
                  onChangeText={setNewResourceOcpus}
                  placeholder="2"
                  placeholderTextColor="#5F6368"
                  keyboardType="numeric"
                />
              </View>

              <View style={[styles.formGroup, { flex: 1 }]}>
                <Text style={styles.formLabel}>MEMÓRIA (GB)</Text>
                <TextInput
                  style={styles.formInput}
                  value={newResourceMemoryGb}
                  onChangeText={setNewResourceMemoryGb}
                  placeholder="16"
                  placeholderTextColor="#5F6368"
                  keyboardType="numeric"
                />
              </View>
            </View>

            {/* Acoes do Modal */}
            <View style={styles.quickModalActions}>
              <TouchableOpacity
                style={styles.quickCancelBtn}
                onPress={() => setIsAddResourceModalVisible(false)}
              >
                <Text style={styles.quickCancelText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickSaveBtn, isSavingResource && { opacity: 0.6 }]}
                onPress={handleSaveNewResource}
                disabled={isSavingResource}
              >
                <Text style={styles.quickSaveText}>
                  {isSavingResource ? 'Cadastrando...' : 'Cadastrar Recurso OCI'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Executivo: Simulacao de Carga e Resiliencia */}
      <Modal
        visible={isStressModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsStressModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.stressModalCard}>
            <View style={styles.stressModalHeader}>
              <Text style={styles.stressModalTitle}>Simulação de Carga e Resiliência</Text>
              <TouchableOpacity onPress={() => setIsStressModalVisible(false)}>
                <Text style={styles.modalCloseText}>FECHAR</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.stressModalDesc}>
              Avalie a reação do ecossistema de observabilidade a anomalias e picos de demanda operacional:
            </Text>

            <View style={styles.stressActionList}>
              <TouchableOpacity
                style={styles.stressItem}
                onPress={() => {
                  injectChaosCpuOverload();
                  setIsStressModalVisible(false);
                  setToastMessage('Pico de carga induzido (98% CPU)');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.stressItemTitle}>Simular Pico de Carga (CPU 98%)</Text>
                <Text style={styles.stressItemSub}>
                  Injeta sobrecarga severa no host para aferir violação de limiar crítico de SLA (85%).
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.stressItem, styles.stressItemCrash]}
                onPress={() => {
                  crashPrimaryInstance();
                  setIsStressModalVisible(false);
                  setToastMessage('Queda de host induzida (Failover)');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.stressItemTitle, styles.stressCrashText]}>
                  Simular Queda de Host (0% CPU / Failover)
                </Text>
                <Text style={styles.stressItemSub}>
                  Derruba a máquina primária para avaliar isolamento de falha e acionamento de contingência.
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.stressItem, styles.stressItemRestore]}
                onPress={() => {
                  restoreInfrastructure();
                  setIsStressModalVisible(false);
                  setToastMessage('Infraestrutura restaurada para estado saudável');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.stressItemTitle, styles.stressRestoreText]}>
                  Restabelecer Normalidade Operacional
                </Text>
                <Text style={styles.stressItemSub}>
                  Normaliza telemetria de CPU e Memória para todos os servidores da conta ativa.
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
  addResourceBtn: {
    backgroundColor: '#0F382A',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#22C55E',
  },
  addResourceBtnText: {
    color: '#86EFAC',
    fontSize: 11,
    fontWeight: '700',
  },
  stressBtn: {
    backgroundColor: '#262C36',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#374151',
  },
  stressBtnText: {
    color: '#E8EAED',
    fontSize: 11,
    fontWeight: '700',
  },
  pdfBtn: {
    backgroundColor: '#1E3A5F',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
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
  },
  healthSlaValue: {
    color: '#E8EAED',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
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
    fontSize: 12,
    fontWeight: '700',
  },
  healthCounters: {
    flexDirection: 'row',
    gap: 16,
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
  dockWrapper: {
    paddingHorizontal: 18,
    marginTop: 14,
    marginBottom: 6,
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
  dockChipUnconfigured: {
    opacity: 0.7,
  },
  dockChipText: {
    color: '#9AA0A6',
    fontSize: 12,
    fontWeight: '700',
  },
  dockChipTextFaded: {
    color: '#6B7280',
  },
  unconfiguredBadge: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#374151',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unconfiguredBadgeText: {
    color: '#D1D5DB',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
  },
  provisionBar: {
    paddingHorizontal: 18,
    marginTop: 10,
  },
  provisionButton: {
    backgroundColor: '#1E232B',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#282E38',
    paddingVertical: 10,
    alignItems: 'center',
  },
  provisionButtonText: {
    color: '#8AB4F8',
    fontSize: 12,
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
  emptyText: {
    color: '#9AA0A6',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  emptyAddBtn: {
    backgroundColor: '#8AB4F8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyAddBtnText: {
    color: '#0F1318',
    fontSize: 12,
    fontWeight: '700',
  },
  minimalCard: {
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
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
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
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  moreActionText: {
    color: '#9AA0A6',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
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
    minWidth: 64,
    textAlign: 'right',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  quickModalCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D3139',
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  quickModalTitle: {
    color: '#E8EAED',
    fontSize: 16,
    fontWeight: '700',
  },
  quickModalSubtitle: {
    color: '#9AA0A6',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 14,
  },
  pasteJsonBtn: {
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderColor: '#38BDF8',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 14,
  },
  pasteJsonBtnText: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '700',
  },
  formGroup: {
    marginBottom: 12,
  },
  formLabel: {
    color: '#9AA0A6',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  formInput: {
    backgroundColor: '#0F1318',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D3139',
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#E8EAED',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  quickModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 14,
  },
  quickCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2D3139',
  },
  quickCancelText: {
    color: '#9AA0A6',
    fontSize: 12,
    fontWeight: '600',
  },
  quickSaveBtn: {
    backgroundColor: '#8AB4F8',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  quickSaveText: {
    color: '#0F1318',
    fontSize: 12,
    fontWeight: '700',
  },
  addResourceModalCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: '#2D3139',
    width: '100%',
    maxWidth: 440,
  },
  addResourceSubtitle: {
    color: '#9AA0A6',
    fontSize: 12,
    marginTop: 4,
    marginBottom: 12,
  },
  shapeSelectorRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 14,
  },
  shapePill: {
    backgroundColor: '#0F1318',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#2D3139',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  shapePillActive: {
    backgroundColor: '#1E3A5F',
    borderColor: '#38BDF8',
  },
  shapePillText: {
    color: '#9AA0A6',
    fontSize: 11,
    fontWeight: '600',
  },
  shapePillTextActive: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  formRowTwoCols: {
    flexDirection: 'row',
    gap: 10,
  },
  stressModalCard: {
    backgroundColor: '#1A1D24',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2D3139',
    padding: 20,
    width: '100%',
    maxWidth: 420,
  },
  stressModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stressModalTitle: {
    color: '#E8EAED',
    fontSize: 15,
    fontWeight: '800',
  },
  modalCloseText: {
    color: '#9AA0A6',
    fontSize: 11,
    fontWeight: '700',
  },
  stressModalDesc: {
    color: '#9AA0A6',
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 16,
  },
  stressActionList: {
    gap: 10,
  },
  stressItem: {
    backgroundColor: '#20242C',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2D3139',
    padding: 12,
  },
  stressItemCrash: {
    borderColor: '#4D1F1F',
    backgroundColor: '#2D151520',
  },
  stressItemRestore: {
    borderColor: '#1E3A2F',
    backgroundColor: '#0F291E20',
  },
  stressItemTitle: {
    color: '#E8EAED',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  stressCrashText: {
    color: '#F28B82',
  },
  stressRestoreText: {
    color: '#81C995',
  },
  stressItemSub: {
    color: '#9AA0A6',
    fontSize: 11,
    lineHeight: 16,
  },
});
